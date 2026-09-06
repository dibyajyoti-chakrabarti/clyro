"""Step 3 canvas service layer.

Backs the canvas endpoints. A new prompt is delegated to the deployed Reasoning
runtime (required — no local fallback); confirmed mutations are always applied +
persisted here via ``canvas_core``.

All canvas mutation, cost, layout, and constraint logic comes from
``canvas_core`` — the single source of truth shared with the agent.
"""

from __future__ import annotations

from typing import Any

from django.utils import timezone

from canvas_core import canvas_builder, canvas_ops, cost_engine, layout_solver
from core.models import AWSAccountConnection, CanvasVersion, IntentRecord, Project, ScanResult

from app import agentcore

from . import chat_memory
from .serializers import serialize_version

# ── Helpers ──────────────────────────────────────────────────────────────────


def latest_version(project: Project) -> CanvasVersion | None:
    return CanvasVersion.objects.filter(project=project).order_by("-version_number").first()


def _intent_to_dict(intent: IntentRecord | None) -> dict[str, Any]:
    """An IntentRecord as the dict the engine + builder read. ``estimate_cost``
    uses scale/criticality/environment; ``build_canvas_from_detection`` uses the
    ``*_choice`` fields. Extra keys are ignored by consumers that don't need them."""
    if not intent:
        return {}
    return {
        "scale": intent.scale,
        "criticality": intent.criticality,
        "environment": intent.environment,
        "description": intent.description,
        "compute_choice": intent.compute_choice,
        "database_choice": intent.database_choice,
        "worker_compute_choice": intent.worker_compute_choice,
        "aws_account_type": intent.aws_account_type,
    }


def intent_dict(project: Project) -> dict[str, Any]:
    intent = IntentRecord.objects.filter(project=project).order_by("-created_at").first()
    return _intent_to_dict(intent)


def _pricing_context(project: Project) -> dict[str, Any]:
    """The ``estimate_cost`` kwargs that come from the AWS connection rather
    than from the canvas: which account type to price against, and where.

    ``account_type`` prefers AWSAccountConnection.verified_account_type (queried
    live from AWS via freetier:GetAccountPlanState at connect time) over the
    user's own claimed_account_type self-report, mirroring the precedence
    already used by deploy._deterministic_template_fix.

    ``region`` matters because estimate_cost defaults its override to us-east-1
    and multiplies every hourly line item by REGION_MULTIPLIER. Nothing used to
    pass it, so a project deploying to ap-south-1 was quoted at us-east-1 prices
    and the panel said "us-east-1 pricing" underneath, contradicting the region
    the user picked two steps earlier. The multipliers range from 0.95 to 1.10,
    so the number was wrong as well as the label."""
    connection = (
        AWSAccountConnection.objects.filter(project=project).order_by("-created_at").first()
    )
    if not connection:
        return {}
    context: dict[str, Any] = {
        "account_type": connection.verified_account_type or connection.claimed_account_type,
    }
    if connection.aws_region:
        context["overrides"] = {"region": connection.aws_region}
    return context


def ensure_initial_canvas(project: Project) -> CanvasVersion | None:
    """Build ``CanvasVersion`` v1 from the real Step 1 (``ScanResult.detected_resources``)
    + Step 2 (``IntentRecord``) records the first time Step 3 is entered. Idempotent:
    returns the existing latest version if one already exists, or ``None`` when there's
    no completed scan to build from. This is the Step 1/2 → Step 3 bridge — it replaces
    the old ``seed_step3`` fixture with the real records."""
    existing = latest_version(project)
    if existing is not None:
        return existing

    scan = (
        ScanResult.objects.filter(project=project, status=ScanResult.Status.COMPLETE)
        .order_by("-scan_timestamp")
        .first()
    )
    if scan is None or not scan.detected_resources:
        return None

    intent_record = IntentRecord.objects.filter(project=project).order_by("-created_at").first()
    intent = _intent_to_dict(intent_record)

    canvas = canvas_builder.build_canvas_from_detection(scan.detected_resources, intent)
    positions = layout_solver.compute_positions(canvas)
    cost = cost_engine.estimate_cost(canvas, intent, **_pricing_context(project))

    version = CanvasVersion.objects.create(
        project=project,
        intent_record=intent_record,
        version_number=1,
        status=CanvasVersion.Status.DRAFT,
        canvas_yaml=canvas_ops.dump_canvas(canvas),
        canvas_snapshot=canvas_ops.build_canvas_snapshot(canvas, positions, cost),
        operation=CanvasVersion.Operation.INITIAL,
        estimated_cost=cost,
    )
    if project.status not in (Project.Status.CANVAS_DRAFT, Project.Status.CANVAS_FINALIZED):
        project.status = Project.Status.CANVAS_DRAFT
        project.save(update_fields=["status", "updated_at"])
    return version


def _answer(message: str) -> dict[str, Any]:
    return {"outcome": "answer", "message": message}


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
    cost = cost_engine.estimate_cost(new_canvas, intent, **_pricing_context(project))

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

    return {"outcome": "applied", "message": "Done. I've updated the canvas.", "version": serialize_version(new_version)}


def revert_to(project: Project, version_number: int) -> dict[str, Any] | None:
    target = CanvasVersion.objects.filter(project=project, version_number=version_number).first()
    latest = latest_version(project)
    if target is None or latest is None:
        return None
    canvas = canvas_ops.parse_canvas(target.canvas_yaml)
    intent = intent_dict(project)
    positions = (target.canvas_snapshot or {}).get("positions", {})
    cost = cost_engine.estimate_cost(canvas, intent, **_pricing_context(project))
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
    chat_memory.flush(project)  # the canvas conversation has no use after finalize
    # Warm the IaC runtime now (finalize is the step right before Step-4 Generate)
    # so the container is hot and Generate skips cold-start. Flag-gated + best-effort.
    from django.conf import settings
    if getattr(settings, "IAC_WARMUP_ENABLED", False):
        from app import tasks
        tasks.run_warmup_task.delay(str(project.id))
    return serialize_version(version)


# ── Agent entrypoint ─────────────────────────────────────────────────────────

def run_canvas_agent(
    project: Project,
    prompt: str,
    confirm: bool = False,
    pending_operation: dict | None = None,
    history: list | None = None,
) -> dict[str, Any]:
    version = ensure_initial_canvas(project)
    if version is None:
        return _answer("This project doesn't have a canvas yet.")
    canvas = canvas_ops.parse_canvas(version.canvas_yaml)
    intent = intent_dict(project)

    # A confirmed mutation is deterministic — apply + persist directly via
    # canvas_core (no model needed).
    if confirm and pending_operation:
        result = apply_operation_and_persist(project, version, canvas, intent, pending_operation)
        # Record the resolution so the restored chat no longer shows a pending Apply.
        chat_memory.save_exchange(
            project, agent_payload={"outcome": result.get("outcome"), "message": result.get("message")},
        )
        return result

    # A new prompt needs the model — the deployed Reasoning runtime (required).
    result = _invoke_reasoning(prompt, canvas, intent, project, history or [])
    chat_memory.save_exchange(
        project,
        user_text=prompt,
        agent_payload={
            "outcome": result.get("outcome"),
            "message": result.get("message"),
            "operation": result.get("operation"),
            "cost_before": result.get("cost_before"),
            "cost_after": result.get("cost_after"),
            "cost_delta": result.get("cost_delta"),
        },
    )
    return result


def dismiss_proposal(project: Project) -> dict[str, Any]:
    """Record that the user dismissed a pending proposal so the restored chat no
    longer prompts to apply it."""
    message = "Okay, leaving it as is."
    chat_memory.save_exchange(project, agent_payload={"outcome": "dismissed", "message": message})
    return {"outcome": "dismissed", "message": message}


def _invoke_reasoning(prompt, canvas, intent, project, history=None) -> dict[str, Any]:
    """Call the deployed Reasoning runtime for a new prompt. It returns the
    {outcome, message, operation?, cost_*} contract; on a proposal the frontend
    confirms and the confirmed op is applied + persisted here (DB is the system
    of record). ``history`` carries the recent chat turns for conversational
    context."""
    arn = agentcore.require_runtime_arn("REASONING_RUNTIME_ARN")
    payload = {"prompt": prompt, "canvas": canvas, "intent": intent, "history": history or []}
    return agentcore.invoke_runtime(arn, payload, str(project.id))
