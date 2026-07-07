"""Compose the deterministic Step 4 *build spec* — the distilled, typed contract
the IacArchitect agent authors CloudFormation from.

This is the Step 3 → Step 4 bridge, analogous to ``canvas_core.canvas_builder``
(which maps detection + intent → canvas). Here we map the finalized canvas
(nodes + connections) + the intent record + the env-var records into one resolved
JSON brief so the agent never has to re-derive ports, subnet layout, sizing, or
naming from raw YAML. Per the design doc, *the records are the contract*: the
agent receives typed fields, not raw repo content.

Pure Python (no Django imports) so it is unit-testable in isolation, the same way
``canvas_core`` is. The thin model→dict adaptation lives in
``provisioning/iac.py``.
"""

from __future__ import annotations

from typing import Any

from canvas_core.cost_engine import SIZING_BY_SCALE

# Free-tier target accounts get the smallest burstable footprint regardless of scale —
# overrides SIZING_BY_SCALE. Paired with no-NAT networking below, this is what the Step 2
# "free tier" answer promises ("stay within free limits / avoid charges"). Note Fargate
# itself is not Free-Tier-eligible; this minimizes spend, it is not a literal $0 guarantee.
FREE_TIER_SIZING: dict[str, Any] = {
    "fargate_vcpu": 0.25, "fargate_gb": 0.5,
    "rds_class": "db.t3.micro", "aurora_class": "db.t3.medium",
    "cache_node": "cache.t3.micro", "tasks": 1,
}

# Per-target ingress ports derived from the connection graph (design Step4 §Networking).
_PORT_BY_TARGET_TYPE: dict[str, int] = {
    "database": 5432,  # PostgreSQL (rds_postgres / aurora_postgres)
    "cache": 6379,     # Redis (elasticache)
}

# Node types that own an EC2 security group (others — static/queue/storage — don't).
_SG_NODE_TYPES = frozenset({"service", "worker", "database", "cache"})

# CloudFormation resource set per (node type, aws_service) — design Step4 §4.3.
_CFN_RESOURCES: dict[tuple[str, str], list[str]] = {
    ("service", "ecs_fargate"): [
        "AWS::ECS::Cluster", "AWS::ECS::TaskDefinition", "AWS::ECS::Service",
        "AWS::IAM::Role (execution)", "AWS::IAM::Role (task)",
        "AWS::Logs::LogGroup", "AWS::EC2::SecurityGroup",
        "AWS::ElasticLoadBalancingV2::LoadBalancer",
        "AWS::ElasticLoadBalancingV2::TargetGroup",
        "AWS::ElasticLoadBalancingV2::Listener",
    ],
    ("service", "ec2"): [
        "AWS::EC2::Instance", "AWS::EC2::SecurityGroup", "AWS::IAM::InstanceProfile",
        "AWS::ElasticLoadBalancingV2::LoadBalancer",
        "AWS::ElasticLoadBalancingV2::TargetGroup",
        "AWS::ElasticLoadBalancingV2::Listener",
    ],
    ("static", "s3_cloudfront"): [
        "AWS::S3::Bucket", "AWS::CloudFront::Distribution",
        "AWS::CloudFront::OriginAccessControl",
    ],
    ("database", "rds_postgres"): [
        "AWS::RDS::DBInstance", "AWS::RDS::DBSubnetGroup",
        "AWS::EC2::SecurityGroup", "AWS::SecretsManager::Secret",
    ],
    ("database", "aurora_postgres"): [
        "AWS::RDS::DBCluster", "AWS::RDS::DBInstance", "AWS::RDS::DBSubnetGroup",
        "AWS::EC2::SecurityGroup", "AWS::SecretsManager::Secret",
    ],
    ("cache", "elasticache"): [
        "AWS::ElastiCache::ReplicationGroup", "AWS::ElastiCache::SubnetGroup",
        "AWS::EC2::SecurityGroup",
    ],
    ("worker", "ecs_fargate"): [
        "AWS::ECS::TaskDefinition", "AWS::ECS::Service",
        "AWS::IAM::Role (execution)", "AWS::IAM::Role (task)",
        "AWS::Logs::LogGroup", "AWS::EC2::SecurityGroup",
    ],
    ("queue", "sqs"): ["AWS::SQS::Queue", "AWS::SQS::QueuePolicy"],
    ("storage", "s3"): ["AWS::S3::Bucket", "AWS::S3::BucketPolicy"],
}

_ENV_SHORT = {"production": "prod", "staging": "staging", "development": "dev"}


def _slug(value: str | None) -> str:
    out = "".join(c if c.isalnum() or c == "-" else "-" for c in (value or "").strip()).lower()
    return out.strip("-") or "app"


def _sg_name(node_id: str) -> str:
    return f"{node_id}-sg"


def _cfn_resources(node_type: str, aws_service: str) -> list[str]:
    """The CFN resource set for a node, with sensible fallbacks: ECS-on-EC2 mirrors
    Fargate (same ECS constructs, different capacity provider)."""
    if (node_type, aws_service) in _CFN_RESOURCES:
        return list(_CFN_RESOURCES[(node_type, aws_service)])
    if node_type in ("service", "worker") and aws_service == "ecs_ec2":
        return list(_CFN_RESOURCES[(node_type, "ecs_fargate")])
    if node_type in ("service", "worker"):
        return list(_CFN_RESOURCES[(node_type, "ecs_fargate")])
    return []


def _public_service_ids(nodes: list[dict], connections: list[dict]) -> set[str]:
    """Service nodes targeted by a static (frontend) node are public-facing and
    front an ALB — same rule the cost engine uses."""
    by_id = {n.get("id"): n for n in nodes}
    public: set[str] = set()
    for conn in connections:
        src = by_id.get(conn.get("from"))
        dst = by_id.get(conn.get("to"))
        if src and dst and src.get("type") == "static" and dst.get("type") == "service":
            public.add(dst["id"])
    return public


def build_spec(
    canvas: dict[str, Any],
    intent: dict[str, Any],
    env_vars: list[dict[str, Any]],
    region: str = "us-east-1",
) -> dict[str, Any]:
    """Map a finalized ``canvas`` (``{nodes, connections, ...}``) + ``intent`` +
    ``env_vars`` into the typed build spec the IaC agent authors CFN from.

    ``intent`` keys read: ``scale``, ``criticality``, ``environment``,
    ``domain_has``, ``domain_name``, ``aws_account_type`` (paid | free_tier).
    ``env_vars`` is a list of dicts shaped like
    the ``EnvVarKey`` rows (``key_name``, ``classification``, ``secrets_manager_arn``,
    ``production_default``, ``context_block``).
    """
    canvas = canvas or {}
    intent = intent or {}
    nodes = canvas.get("nodes") or []
    connections = canvas.get("connections") or []

    scale = intent.get("scale") or "small"
    environment = intent.get("environment") or "production"
    criticality = intent.get("criticality") or "medium"
    account_type = intent.get("aws_account_type") or "paid"
    free_tier = account_type == "free_tier"
    # Multi-AZ redundancy (doubles RDS/cache) only when high *and* production —
    # matches canvas_core.cost_engine so the review cost reconciles with Step 3. A
    # free-tier target never gets Multi-AZ (it doubles cost).
    multi_az = (not free_tier) and criticality == "high" and environment == "production"
    # Free tier drops the NAT gateway (its biggest always-on cost) and instead runs ECS
    # tasks in public subnets with a public IP so they can still reach ECR. RDS/cache
    # stay in private subnets — they need no outbound internet, so they need no NAT.
    nat_gateway = not free_tier
    task_placement = "public" if free_tier else "private"

    project = _slug(canvas.get("project"))
    prefix = f"{project}-{_ENV_SHORT.get(environment, 'prod')}"
    # Separate, longer prefix ONLY for the four resource types bootstrap.yaml's IAM
    # policy actually scopes by name (IAM roles, S3 buckets, SQS queues, log groups —
    # see Issue 2C). Using this everywhere (as an earlier version of this function did)
    # broke resources with tight AWS length limits: ALB/Target Group names cap at 32
    # chars, and "clyro-" + a real project-env prefix routinely blows past that. Every
    # other resource type (ALB, Target Group, ECS Cluster/Service, RDS, ElastiCache)
    # keeps the short `prefix` — bootstrap.yaml leaves those Resource: "*" anyway, so
    # they never needed the "clyro-" marker for security scoping.
    iam_scoped_prefix = f"clyro-{prefix}"
    # Deterministic, pre-truncated prefix for ALB names and Target Group names — the
    # tightest AWS limit in this template is 32 chars TOTAL including the suffix (e.g.
    # "-backend-tg", 11 chars), and a real project name plus "-staging"/"-prod" alone
    # can exceed that even without any extra prefix (e.g. "a-test-project-staging" is
    # already 22 chars). Rather than trust the authoring LLM to notice and truncate
    # this correctly every time, compute a safe prefix here: cap at 18 chars, which
    # leaves room for the longest suffix used in this template ("-backend-tg").
    short_prefix = prefix[:18].rstrip("-") or "app"
    sizing = dict(FREE_TIER_SIZING if free_tier else SIZING_BY_SCALE.get(scale, SIZING_BY_SCALE["small"]))

    has_domain = (intent.get("domain_has") == "yes") and bool(intent.get("domain_name"))

    by_id = {n.get("id"): n for n in nodes}
    public_ids = _public_service_ids(nodes, connections)

    resources: list[dict[str, Any]] = []
    for node in nodes:
        node_id = node.get("id")
        node_type = node.get("type")
        aws_service = node.get("aws_service")
        entry: dict[str, Any] = {
            "node_id": node_id,
            "label": node.get("label"),
            "type": node_type,
            "aws_service": aws_service,
            "cfn_resources": _cfn_resources(node_type, aws_service or ""),
        }
        if node_type in _SG_NODE_TYPES:
            entry["security_group"] = _sg_name(node_id)
        if node_type in ("service", "worker"):
            entry["image"] = node.get("image", "ecr")
            entry["container_port"] = node.get("port", 8000)
            entry["public"] = node_id in public_ids
            entry["sizing"] = {
                "fargate_vcpu": sizing["fargate_vcpu"],
                "fargate_gb": sizing["fargate_gb"],
                "tasks": sizing["tasks"] if node_type == "service" else 1,
            }
            entry["build_path"] = node.get("path") or "."
            entry["dockerfile_generated"] = bool(node.get("dockerfile_generated"))
        elif node_type == "static":
            entry["build_path"] = node.get("path") or "."
        elif node_type == "database":
            entry["instance_class"] = (
                sizing["aurora_class"] if aws_service == "aurora_postgres" else sizing["rds_class"]
            )
            entry["multi_az"] = multi_az
            entry["engine"] = "postgres"
        elif node_type == "cache":
            entry["node_class"] = sizing["cache_node"]
            entry["replicas"] = 1 if multi_az else 0
        resources.append(entry)

    # Networking rules derived from the connection graph. Each edge is classified:
    #   sg_ingress — security-group ingress on the target (db/cache) from the source
    #   alb        — public ALB in front of a service (static → service)
    #   none       — no SG ingress needed (async via queue, SQS via IAM, etc.)
    alb_sg = f"{prefix}-alb-sg"
    network_edges: list[dict[str, Any]] = []
    for conn in connections:
        frm, to = conn.get("from"), conn.get("to")
        from_node, to_node = by_id.get(frm), by_id.get(to)
        if not from_node or not to_node:
            continue
        from_type, to_type = from_node.get("type"), to_node.get("type")
        if to_type in _PORT_BY_TARGET_TYPE:
            port = _PORT_BY_TARGET_TYPE[to_type]
            network_edges.append({
                "kind": "sg_ingress",
                "from": frm, "to": to,
                "from_sg": _sg_name(frm), "to_sg": _sg_name(to),
                "port": port, "protocol": "tcp",
                "description": f"{frm} -> {to} ({to_type}:{port})",
            })
        elif from_type == "static" and to_type == "service":
            network_edges.append({
                "kind": "alb",
                "from": frm, "to": to,
                "alb_sg": alb_sg, "target_sg": _sg_name(to),
                "listener_port": 443 if has_domain else 80,
                "redirect_http": has_domain,
                "target_port": to_node.get("port", 8000),
                "description": f"internet -> ALB -> {to} (HTTPS)" if has_domain
                               else f"internet -> ALB -> {to} (HTTP)",
            })
        else:
            network_edges.append({
                "kind": "none",
                "from": frm, "to": to,
                "reason": "asynchronous / IAM-scoped access — no security-group ingress required",
                "description": f"{frm} -> {to} (no ingress)",
            })

    # Secrets already written to Secrets Manager (user-provided) → dynamic refs.
    # Generated env vars the template itself must synthesize and inject.
    secrets: list[dict[str, Any]] = []
    generated_env: list[dict[str, Any]] = []
    for var in env_vars or []:
        classification = var.get("classification")
        if classification == "generated":
            generated_env.append({
                "key_name": var.get("key_name"),
                "hint": var.get("production_default") or var.get("context_block"),
            })
        elif var.get("secrets_manager_arn"):
            secrets.append({
                "key_name": var.get("key_name"),
                "secretsmanager_arn": var.get("secrets_manager_arn"),
                "classification": classification,
            })

    return {
        "project": project,
        "environment": environment,
        "account_type": account_type,   # "paid" | "free_tier" (from Step 2)
        "naming_prefix": prefix,
        # Use ONLY for IAM role names, S3 bucket names, SQS queue names, and
        # CloudWatch Log Group names — required for bootstrap.yaml's cross-account
        # IAM scoping. Every other resource name uses naming_prefix (see comment above).
        "iam_scoped_prefix": iam_scoped_prefix,
        # Use ONLY for the ALB name and Target Group name(s) — pre-truncated so the
        # 32-char AWS limit on those two resource types can't be exceeded regardless
        # of how long the project name is.
        "short_prefix": short_prefix,
        "region": region,
        "sizing": {
            "scale": scale,
            "fargate_vcpu": sizing["fargate_vcpu"],
            "fargate_gb": sizing["fargate_gb"],
            "tasks": sizing["tasks"],
        },
        "networking": {
            "vpc_cidr": "10.0.0.0/16",
            "az_count": 2,            # ALB requires >= 2 AZs; subnets are free
            "public_subnets": 2,
            "private_subnets": 2,     # RDS/cache live here even on free tier (no NAT needed)
            "nat_gateway": nat_gateway,      # free tier: no NAT gateway
            "task_placement": task_placement,  # where ECS tasks run: "private" | "public"
            "multi_az": multi_az,     # controls RDS Multi-AZ + cache replicas
            "criticality": criticality,
        },
        "domain": {
            "has_domain": has_domain,
            "domain_name": intent.get("domain_name") if has_domain else None,
            "acm": has_domain,
        },
        "placement": {
            "public_subnets": (["ALB", "CloudFront(origin)"]
                               + (["ECS tasks"] if task_placement == "public" else [])),
            "private_subnets": ((["ECS tasks"] if task_placement == "private" else [])
                                + ["RDS", "ElastiCache"]),
        },
        "resources": resources,
        "network_edges": network_edges,
        "secrets": secrets,
        "generated_env": generated_env,
    }
