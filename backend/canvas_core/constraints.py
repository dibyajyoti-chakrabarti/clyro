"""Hard constraints and allowed-service enums for the Step 3 canvas.

This is the single source of truth for *what is allowed* on the canvas. It is
imported by the Django backend (stub mode + persistence) and by the Reasoning /
Layout agents, so the rules can never drift between them.

The rules mirror the Step 1 §1.6 enum table and the Step 3 "Agent Hard
Constraints" section of the design docs.
"""

from __future__ import annotations

from dataclasses import dataclass

from .types import Canvas, Node, Operation

# --- Node taxonomy -----------------------------------------------------------

NODE_TYPES: tuple[str, ...] = (
    "service",
    "static",
    "database",
    "cache",
    "worker",
    "queue",
    "storage",
)

# Allowed aws_service values per node type (Step 1 §1.6).
ALLOWED_AWS_SERVICES: dict[str, tuple[str, ...]] = {
    "service": ("ecs_fargate", "ecs_ec2", "ec2"),
    "static": ("s3_cloudfront",),
    "database": ("rds_postgres", "aurora_postgres"),
    "cache": ("elasticache",),
    "worker": ("ecs_fargate", "ecs_ec2", "ec2"),
    "queue": ("sqs",),
    "storage": ("s3",),
}

# Node types whose aws_service is fixed (no user choice).
FIXED_SERVICE_TYPES: dict[str, str] = {
    "static": "s3_cloudfront",
    "cache": "elasticache",
    "queue": "sqs",
    "storage": "s3",
}

# Networking is derived from the connection graph at Step 4, never placed on the
# canvas. Any attempt to add these is rejected.
NETWORKING_KEYWORDS: tuple[str, ...] = (
    "alb",
    "nlb",
    "elb",
    "vpc",
    "subnet",
    "security_group",
    "securitygroup",
    "api_gateway",
    "apigateway",
    "load_balancer",
    "loadbalancer",
    "nat_gateway",
    "internet_gateway",
)

OPERATIONS: tuple[str, ...] = (
    "ADD_NODE",
    "REMOVE_NODE",
    "UPDATE_NODE",
    "ADD_CONNECTION",
    "REMOVE_CONNECTION",
)

# The backend node is mandatory and cannot be removed.
BACKEND_NODE_ID = "backend"


@dataclass
class ConstraintResult:
    """Outcome of a constraint check.

    ``ok`` is True when the operation is permitted. When False, ``reason`` is a
    plain-English explanation suitable for showing the user and ``alternative``
    is an optional suggested next step.
    """

    ok: bool
    reason: str | None = None
    alternative: str | None = None


def _node_by_id(canvas: Canvas, node_id: str | None) -> Node | None:
    for node in canvas.get("nodes", []):
        if node.get("id") == node_id:
            return node
    return None


def _looks_like_networking(*values: object) -> bool:
    for value in values:
        if not value:
            continue
        text = str(value).lower().replace("-", "_").replace(" ", "_")
        if any(keyword in text for keyword in NETWORKING_KEYWORDS):
            return True
    return False


def is_backend_node(node: Node) -> bool:
    """The mandatory backend is identified by its canonical id."""
    return node.get("id") == BACKEND_NODE_ID


def check_operation(canvas: Canvas, operation: Operation) -> ConstraintResult:
    """Validate a single bounded operation against the hard constraints.

    ``operation`` shape::

        {"op": "UPDATE_NODE", "target_node": "db", "params": {"aws_service": ...}}
        {"op": "ADD_NODE", "params": {"node": {...}}}
        {"op": "REMOVE_NODE", "target_node": "cache"}
        {"op": "ADD_CONNECTION", "params": {"from": .., "to": .., "label": ..}}
        {"op": "REMOVE_CONNECTION", "params": {"from": .., "to": ..}}
    """

    op = operation.get("op")
    if op not in OPERATIONS:
        return ConstraintResult(
            ok=False,
            reason=f"'{op}' is not a supported canvas operation.",
        )

    params = operation.get("params") or {}

    if op == "ADD_NODE":
        node = params.get("node") or operation.get("node") or {}
        node_type = node.get("type")
        node_id = node.get("id")
        aws_service = node.get("aws_service")

        if _looks_like_networking(node_id, node.get("label"), aws_service, node_type):
            return ConstraintResult(
                ok=False,
                reason=(
                    "Networking resources (ALB, VPC, subnets, security groups) "
                    "aren't placed on the canvas — they're derived from your "
                    "connection graph when the infrastructure is generated."
                ),
            )
        if node_type not in NODE_TYPES:
            return ConstraintResult(
                ok=False,
                reason=(
                    f"'{node_type}' isn't a supported node type. Supported types: "
                    f"{', '.join(NODE_TYPES)}."
                ),
            )
        if not node_id:
            return ConstraintResult(ok=False, reason="A new node needs an id.")
        if _node_by_id(canvas, node_id) is not None:
            return ConstraintResult(
                ok=False, reason=f"A node with id '{node_id}' already exists."
            )
        return _check_aws_service(node_type, aws_service)

    if op == "REMOVE_NODE":
        target = operation.get("target_node")
        node = _node_by_id(canvas, target)
        if node is None:
            return ConstraintResult(ok=False, reason=f"No node '{target}' to remove.")
        if is_backend_node(node):
            return ConstraintResult(
                ok=False,
                reason="Every Crylo project needs a backend — it can't be removed.",
            )
        return ConstraintResult(ok=True)

    if op == "UPDATE_NODE":
        target = operation.get("target_node")
        node = _node_by_id(canvas, target)
        if node is None:
            return ConstraintResult(ok=False, reason=f"No node '{target}' to update.")
        if "image" in params and params.get("image") != node.get("image"):
            return ConstraintResult(
                ok=False,
                reason=(
                    "Containerization is standardized — the backend and workers "
                    "always ship as a container image to ECR, so this can't change."
                ),
            )
        new_service = params.get("aws_service")
        if new_service is None:
            return ConstraintResult(ok=True)
        return _check_aws_service(node["type"], new_service)

    if op in ("ADD_CONNECTION", "REMOVE_CONNECTION"):
        frm = params.get("from")
        to = params.get("to")
        if _node_by_id(canvas, frm) is None:
            return ConstraintResult(ok=False, reason=f"No node '{frm}' for the connection.")
        if _node_by_id(canvas, to) is None:
            return ConstraintResult(ok=False, reason=f"No node '{to}' for the connection.")
        return ConstraintResult(ok=True)

    return ConstraintResult(ok=False, reason=f"Unhandled operation '{op}'.")


def _check_aws_service(node_type: str, aws_service: str | None) -> ConstraintResult:
    allowed = ALLOWED_AWS_SERVICES.get(node_type, ())
    if node_type in FIXED_SERVICE_TYPES:
        fixed = FIXED_SERVICE_TYPES[node_type]
        if aws_service != fixed:
            return ConstraintResult(
                ok=False,
                reason=f"The '{node_type}' node always uses {fixed}; it isn't configurable.",
            )
        return ConstraintResult(ok=True)
    if aws_service not in allowed:
        return ConstraintResult(
            ok=False,
            reason=f"'{aws_service}' isn't valid for a '{node_type}' node.",
            alternative=f"Supported options: {', '.join(allowed)}.",
        )
    return ConstraintResult(ok=True)
