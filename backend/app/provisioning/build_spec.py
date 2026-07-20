"""Compose the deterministic Step 4 *build spec* — the distilled, typed contract
``cfn_generator`` deterministically authors CloudFormation from (the IacArchitect
agent only consumes this spec for ``refine()``, not the initial ``generate()``).

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


def _broker_for(resources: list[dict[str, Any]]) -> dict[str, Any]:
    """Which provisioned resource backs the task queue's message broker.

    Nothing upstream detects this today — RepoRecon (Step 1) is the right place to
    read it off the app's deps + Celery config, and until it does, this is the
    fallback. Precedence is deliberate: prefer a transport the app can use with **no
    application-side configuration**. Redis needs only a URL. SQS does not: kombu
    resolves the queue from Celery's own queue name (`celery`), not from the queue
    this template provisions, so pointing an app at a named SQS queue requires
    `broker_transport_options={"predefined_queues": ...}` in the app's settings —
    which Clyro cannot inject, since Celery reads Django settings, not the
    environment. `requires_app_config` carries that contract forward so the template
    checks can fail loudly instead of shipping a worker that crash-loops.
    """
    cache = next((r for r in resources if r.get("type") == "cache"), None)
    if cache:
        return {"transport": "redis", "node_id": cache["node_id"], "requires_app_config": False}
    queue = next((r for r in resources if r.get("type") == "queue"), None)
    if queue:
        return {"transport": "sqs", "node_id": queue["node_id"], "requires_app_config": True}
    return {"transport": None, "node_id": None, "requires_app_config": False}


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



# Env vars whose production value Clyro can state outright, rather than derive from
# a resource the template creates. A `value` entry means "the template must set this
# key to exactly this literal" — iac.enforce_env_values renders it and
# iac.enforce_required_env inserts it when the agent leaves it out entirely.
#
# ALLOWED_HOSTS: found live. RepoRecon classifies it `optional`, so it never reached
# generated_env, so the container ran with Django's empty default and answered every
# request — including the ALB's health check — with 400 DisallowedHost. The stack was
# healthy; the app was unreachable. Host validation genuinely belongs to the load
# balancer and CloudFront here, not to Django, and scanner/compliance.py already tells
# the user Clyro "sets this permissively at deploy time".
_LITERAL_ENV_VALUES = {
    "ALLOWED_HOSTS": "*",
}

# The contract scanner/compliance.py already states to the user and gates on:
# "Clyro's ALB target group health check is hardcoded to GET /health". Nothing
# actually pinned it — the agent chose the path, and got `/health/` on one
# generation and `/` on the next. The app under test routes `path("health", ...)`
# with no trailing slash and has no root route, so both 404 and the target never
# goes healthy. Pin it here so the promise is real.
#
# Limitation: an app serving its check at, say, `/api/health` passes the Step-1
# compliance check (the route merely has to contain "health") but would fail this.
# Threading the matched route out of the scanner is the proper fix.
_HEALTH_CHECK_PATH = "/health"

# The command that applies database schema migrations, per detected backend
# framework. Found live: the container image's CMD is the app server only
# (gunicorn), and `manage.py migrate` lives exclusively in the docker-compose
# override, which ECS never reads — so RDS came up with no tables and every ORM
# query 500'd even though the ALB target was healthy. This runs the framework's
# own migrate command once, on the app's own image, before the service scales up.
#
# Keyed by the framework RepoRecon detects (build_spec receives it via `frameworks`),
# so a static site or a Go binary — anything not in this map — gets no migration
# step at all rather than a bogus `manage.py migrate`. Add a framework here only
# once its migrate command is known to be idempotent (safe to re-run on retry).
_MIGRATE_COMMANDS: dict[str, list[str]] = {
    "django": ["python", "manage.py", "migrate", "--noinput"],
}


def _add_literal_env(generated_env: list[dict[str, Any]], env_vars: list[dict[str, Any]]) -> None:
    """Promote a declared-but-unclassified env var to a generated one with a fixed
    value. Only for keys the app actually reads: if the repo never mentions
    ALLOWED_HOSTS, injecting it would be noise, and the Step-1 compliance check
    already flags a hardcoded one."""
    declared = {var.get("key_name") for var in env_vars or []}
    present = {entry.get("key_name") for entry in generated_env}
    for key, value in _LITERAL_ENV_VALUES.items():
        if key in declared and key not in present:
            generated_env.append({
                "key_name": key,
                "hint": f"set to {value} — the load balancer is the host gate, not the app",
                "value": value,
            })


def build_spec(
    canvas: dict[str, Any],
    intent: dict[str, Any],
    env_vars: list[dict[str, Any]],
    region: str = "us-east-1",
    frameworks: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Map a finalized ``canvas`` (``{nodes, connections, ...}``) + ``intent`` +
    ``env_vars`` into the typed build spec the IaC agent authors CFN from.

    ``intent`` keys read: ``scale``, ``criticality``, ``environment``,
    ``domain_has``, ``domain_name``, ``aws_account_type`` (paid | free_tier).
    ``env_vars`` is a list of dicts shaped like
    the ``EnvVarKey`` rows (``key_name``, ``classification``, ``secrets_manager_arn``,
    ``production_default``, ``context_block``).
    ``frameworks`` maps a node id to its RepoRecon-detected framework (e.g.
    ``{"backend": "django"}``) — used only to decide the database-migration step.
    """
    canvas = canvas or {}
    intent = intent or {}
    frameworks = frameworks or {}
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
    domain_name = intent.get("domain_name") if has_domain else None
    # The registrable domain (last two labels) is the Route53 hosted zone name
    # convention (e.g. "app.example.com" -> "example.com"). Known limitation:
    # this heuristic is wrong for multi-part public suffixes (co.uk, etc.) —
    # acceptable for now since an explicit route53_hosted_zone_id always wins.
    hosted_zone_name = ".".join(domain_name.split(".")[-2:]) if domain_name else None

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
            entry["framework"] = frameworks.get(node_id)
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

    _add_literal_env(generated_env, env_vars)

    # The one service whose schema must be migrated before any traffic reaches it.
    # A service framework with a known migrate command wins; a public (ALB-fronted)
    # one is preferred when several qualify. None → no migration step (see
    # _MIGRATE_COMMANDS). The worker shares the backend image but must NOT also run
    # migrate — one run is enough, and two racing migrations can deadlock.
    migrate: dict[str, Any] | None = None
    migratable = [
        (entry, _MIGRATE_COMMANDS[(frameworks.get(entry["node_id"]) or "").lower()])
        for entry in resources
        if entry["type"] == "service"
        and (frameworks.get(entry["node_id"]) or "").lower() in _MIGRATE_COMMANDS
    ]
    if migratable:
        entry, command = next((mc for mc in migratable if mc[0].get("public")), migratable[0])
        migrate = {
            "node_id": entry["node_id"],
            "framework": frameworks.get(entry["node_id"]),
            "command": command,
        }

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
            "domain_name": domain_name,
            "acm": has_domain,
            "hosted_zone_id": intent.get("route53_hosted_zone_id") if has_domain else None,
            "hosted_zone_name": hosted_zone_name,
        },
        "placement": {
            "public_subnets": (["ALB", "CloudFront(origin)"]
                               + (["ECS tasks"] if task_placement == "public" else [])),
            "private_subnets": ((["ECS tasks"] if task_placement == "private" else [])
                                + ["RDS", "ElastiCache"]),
        },
        "resources": resources,
        "network_edges": network_edges,
        "health_check_path": _HEALTH_CHECK_PATH,
        # The database-migration step (or None). Read by deploy.run_migrations, which
        # runs `command` once on the `node_id` service's own image before scale-up.
        "migrate": migrate,
        "secrets": secrets,
        "generated_env": generated_env,
        # Which provisioned resource backs the Celery/task broker. Read by
        # iac.enforce_env_values to render a valid transport URL.
        "broker": _broker_for(resources),
    }
