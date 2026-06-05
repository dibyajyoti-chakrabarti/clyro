"""Step 3 canvas service layer.

Backs the canvas endpoints. In **stub mode** (no ``ORCHESTRATOR_RUNTIME_ARN``)
it runs a deterministic, rule-based agent on top of ``canvas_core`` so the whole
UI + persistence flow can be exercised before any AWS agent is deployed. When the
ARN is set (Phase 6) it delegates to the deployed AgentCore Orchestrator runtime.

All canvas mutation, cost, layout, and constraint logic comes from
``canvas_core`` — the single source of truth shared with the agents.
"""

from __future__ import annotations

import json
from typing import Any

import boto3
from django.conf import settings
from django.utils import timezone

from canvas_core import canvas_ops, constraints, cost_engine, layout_solver
from canvas_core.cost_engine import DISPLAY_NAME
from core.models import CanvasVersion, IntentRecord, Project

from .serializers import serialize_version

# ── Helpers ──────────────────────────────────────────────────────────────────

_NODE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "backend": ("backend", "django", "api server", "app server"),
    "frontend": ("frontend", "react", "ui", "client app"),
    "db": ("database", "postgres", "postgresql", " db"),
    "cache": ("cache", "redis"),
    "worker": ("worker", "celery", "background job", "background task"),
    "queue": ("queue", "sqs"),
}


def latest_version(project: Project) -> CanvasVersion | None:
    return CanvasVersion.objects.filter(project=project).order_by("-version_number").first()


def intent_dict(project: Project) -> dict[str, Any]:
    intent = IntentRecord.objects.filter(project=project).order_by("-created_at").first()
    if not intent:
        return {}
    return {
        "scale": intent.scale,
        "criticality": intent.criticality,
        "environment": intent.environment,
        "description": intent.description,
    }


def _pretty(aws_service: str | None) -> str:
    return DISPLAY_NAME.get(aws_service or "", aws_service or "")


def _find_node(canvas: dict, prompt: str) -> dict | None:
    for nid, keywords in _NODE_KEYWORDS.items():
        if any(k in prompt for k in keywords):
            node = canvas_ops.node_by_id(canvas, nid)
            if node:
                return node
    return None


def _compute_target(canvas: dict, prompt: str) -> str | None:
    if any(k in prompt for k in ("worker", "celery")) and canvas_ops.node_by_id(canvas, "worker"):
        return "worker"
    if any(k in prompt for k in ("backend", "django", "api", "compute", "server")) and canvas_ops.node_by_id(canvas, "backend"):
        return "backend"
    return None


def _answer(message: str) -> dict[str, Any]:
    return {"outcome": "answer", "message": message}


def _propose(canvas: dict, intent: dict, operation: dict, explanation: str) -> dict[str, Any]:
    """Validate, attach a cost delta, and return a proposal (or an explanatory
    answer if a hard constraint blocks it)."""
    check = constraints.check_operation(canvas, operation)
    if not check.ok:
        message = check.reason or "That change isn't allowed."
        if check.alternative:
            message += " " + check.alternative
        return _answer(message)
    try:
        after, _ = canvas_ops.apply_operation(canvas, operation)
    except canvas_ops.CanvasOpError as exc:
        return _answer(str(exc))

    delta = cost_engine.cost_delta(canvas, after, intent)
    if delta["delta"] == 0:
        cost_sentence = f" Your estimated monthly cost stays at ${delta['after']}."
    else:
        sign = "+" if delta["delta"] > 0 else "-"
        cost_sentence = (
            f" Your estimated monthly cost will go from ${delta['before']} to "
            f"${delta['after']} ({sign}${abs(delta['delta'])}/month)."
        )
    return {
        "outcome": "proposal",
        "message": explanation + cost_sentence + " Want me to make the change?",
        "operation": operation,
        "cost_before": delta["before"],
        "cost_after": delta["after"],
        "cost_delta": delta["delta"],
    }


# ── Rule-based classifier (stub agent) ───────────────────────────────────────

def classify(canvas: dict, intent: dict, prompt: str) -> dict[str, Any]:
    """Classify a prompt into exactly one outcome — a mutation *proposal* or an
    *answer* — mirroring the Reasoning agent's contract."""
    p = f" {prompt.lower()} "

    if any(k in p for k in ("cost", "how much", "price", "pricing", "per month", "monthly")):
        cost = cost_engine.estimate_cost(canvas, intent)
        lines = "\n".join(f"  {i['label']}: ${i['monthly']}/mo" for i in cost["line_items"])
        return _answer(f"Your estimated cost is ${cost['total']}/month.\n{lines}")

    db = canvas_ops.node_by_id(canvas, "db")
    if "aurora" in p and db and db.get("aws_service") != "aurora_postgres":
        return _propose(
            canvas, intent,
            {"op": "UPDATE_NODE", "target_node": "db", "params": {"aws_service": "aurora_postgres"}},
            "Aurora PostgreSQL offers better read performance and automatic failover, but costs more than RDS at your scale.",
        )
    if ("rds" in p or "standard postgres" in p) and "aurora" not in p and db and db.get("aws_service") == "aurora_postgres":
        return _propose(
            canvas, intent,
            {"op": "UPDATE_NODE", "target_node": "db", "params": {"aws_service": "rds_postgres"}},
            "RDS PostgreSQL is reliable and lower cost than Aurora for your scale.",
        )

    target = _compute_target(canvas, p)
    if target:
        node = canvas_ops.node_by_id(canvas, target) or {}
        current = node.get("aws_service")
        if "fargate" in p and current != "ecs_fargate":
            return _propose(canvas, intent,
                {"op": "UPDATE_NODE", "target_node": target, "params": {"aws_service": "ecs_fargate"}},
                f"ECS Fargate is fully managed — AWS runs your {target} container with no servers to patch.")
        if ("ecs on ec2" in p or "ecs ec2" in p) and current != "ecs_ec2":
            return _propose(canvas, intent,
                {"op": "UPDATE_NODE", "target_node": target, "params": {"aws_service": "ecs_ec2"}},
                f"ECS on EC2 gives more control and can be cheaper at sustained load, but you manage the cluster.")
        if "ec2" in p and current != "ec2":
            return _propose(canvas, intent,
                {"op": "UPDATE_NODE", "target_node": target, "params": {"aws_service": "ec2"}},
                f"EC2 gives full control of the server for your {target}, but you manage OS updates and scaling yourself.")

    if any(k in p for k in ("remove", "delete", "drop", "get rid of")):
        node = _find_node(canvas, p)
        if node:
            return _propose(canvas, intent,
                {"op": "REMOVE_NODE", "target_node": node["id"]},
                f"Removing the {node.get('label', node['id'])} means anything that depends on it loses that capability.")
        return _answer("I couldn't tell which node to remove — you can remove the cache, worker, queue, or frontend.")

    if ("cdn" in p or "cloudfront" in p) and "add" in p:
        return _answer(
            "Your React frontend already uses S3 + CloudFront, which includes a CDN — CloudFront is the CDN layer, so it's already there."
        )

    if any(k in p for k in ("compare", "difference", "vs ", "versus")):
        return _answer(
            "ECS Fargate is fully managed: you define the container, AWS runs it — no patching or capacity planning. "
            "EC2 gives you the server to manage yourself — cheaper at sustained load but more operational overhead. "
            "For a small production app, Fargate is usually the better fit."
        )

    if any(k in p for k in ("explain", "what is", "what's", "tell me about", "describe")):
        node = _find_node(canvas, p)
        if node:
            return _answer(f"The {node.get('label', node['id'])} runs as {_pretty(node.get('aws_service'))} ({node.get('type')}).")
        return _answer("Ask me about any node — e.g. 'explain the database' or 'what is the cache for'.")

    return _answer(
        "I can change a service (e.g. 'use Aurora instead of RDS', 'move the backend to EC2'), "
        "remove a node, compare options, or estimate cost. What would you like to do?"
    )


# ── Apply + persist ──────────────────────────────────────────────────────────

def apply_operation_and_persist(
    project: Project, version: CanvasVersion, canvas: dict, intent: dict, operation: dict
) -> dict[str, Any]:
    try:
        new_canvas, change = canvas_ops.apply_operation(canvas, operation)
    except canvas_ops.CanvasOpError as exc:
        return _answer(str(exc))

    existing = (version.canvas_snapshot or {}).get("positions", {})
    positions = layout_solver.compute_positions(new_canvas, existing=existing)
    cost = cost_engine.estimate_cost(new_canvas, intent)

    new_version = CanvasVersion.objects.create(
        project=project,
        intent_record=version.intent_record,
        version_number=version.version_number + 1,
        status=CanvasVersion.Status.DRAFT,
        canvas_yaml=canvas_ops.dump_canvas(new_canvas),
        canvas_snapshot=canvas_ops.build_canvas_snapshot(new_canvas, positions, cost),
        operation=change["operation"],
        changed_node_id=change["changed_node_id"],
        previous_value=change["previous_value"],
        new_value=change["new_value"],
        estimated_cost=cost,
    )
    if project.status != Project.Status.CANVAS_DRAFT:
        project.status = Project.Status.CANVAS_DRAFT
        project.save(update_fields=["status", "updated_at"])

    return {"outcome": "applied", "message": "Done — I've updated the canvas.", "version": serialize_version(new_version)}


def revert_to(project: Project, version_number: int) -> dict[str, Any] | None:
    target = CanvasVersion.objects.filter(project=project, version_number=version_number).first()
    latest = latest_version(project)
    if target is None or latest is None:
        return None
    canvas = canvas_ops.parse_canvas(target.canvas_yaml)
    intent = intent_dict(project)
    positions = (target.canvas_snapshot or {}).get("positions", {})
    cost = cost_engine.estimate_cost(canvas, intent)
    new_version = CanvasVersion.objects.create(
        project=project,
        intent_record=target.intent_record,
        version_number=latest.version_number + 1,
        status=CanvasVersion.Status.DRAFT,
        canvas_yaml=target.canvas_yaml,
        canvas_snapshot=canvas_ops.build_canvas_snapshot(canvas, positions, cost),
        operation=CanvasVersion.Operation.REVERT,
        changed_node_id=None,
        previous_value=None,
        new_value={"reverted_to": version_number},
        estimated_cost=cost,
    )
    return serialize_version(new_version)


def finalize(project: Project) -> dict[str, Any] | None:
    version = latest_version(project)
    if version is None:
        return None
    version.status = CanvasVersion.Status.FINALIZED
    version.finalized_at = timezone.now()
    version.save(update_fields=["status", "finalized_at"])
    project.status = Project.Status.CANVAS_FINALIZED
    project.save(update_fields=["status", "updated_at"])
    return serialize_version(version)


# ── Orchestrator entrypoint ──────────────────────────────────────────────────

def run_canvas_agent(
    project: Project, prompt: str, confirm: bool = False, pending_operation: dict | None = None
) -> dict[str, Any]:
    version = latest_version(project)
    if version is None:
        return _answer("This project doesn't have a canvas yet.")
    canvas = canvas_ops.parse_canvas(version.canvas_yaml)
    intent = intent_dict(project)

    if settings.ORCHESTRATOR_RUNTIME_ARN:
        return _invoke_runtime(prompt, confirm, pending_operation, project, version, canvas, intent)

    if confirm and pending_operation:
        return apply_operation_and_persist(project, version, canvas, intent, pending_operation)
    return classify(canvas, intent, prompt)


def _invoke_runtime(prompt, confirm, pending_operation, project, version, canvas, intent) -> dict[str, Any]:
    """Phase 6: call the deployed AgentCore Orchestrator runtime. The agent
    returns the same {outcome, ...} contract; a confirmed mutation is persisted
    here so the DB stays the system of record."""
    client = boto3.client("bedrock-agentcore", region_name=settings.AWS_REGION)
    payload = {
        "prompt": prompt,
        "confirm": confirm,
        "pending_operation": pending_operation,
        "canvas": canvas,
        "intent": intent,
    }
    response = client.invoke_agent_runtime(
        agentRuntimeArn=settings.ORCHESTRATOR_RUNTIME_ARN,
        qualifier="DEFAULT",
        runtimeSessionId=str(project.id),
        payload=json.dumps(payload).encode(),
    )
    body = response["response"].read()
    result = json.loads(body.decode() if isinstance(body, bytes) else body)

    if result.get("outcome") == "applied" and result.get("operation"):
        return apply_operation_and_persist(project, version, canvas, intent, result["operation"])
    return result
