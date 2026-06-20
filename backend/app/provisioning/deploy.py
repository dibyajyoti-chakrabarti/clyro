"""Step 4.5 provisioning service — submit the validated CloudFormation template to
the user's AWS account and stream back a plain-English live feed.

Deterministic + Django-driven (no agent): ``start`` submits the stack via the
assumed cross-account role; ``poll`` reads stack events on each frontend tick,
translates them (``cfn_events``), persists ``ProvisioningLogEntry`` rows, and
captures outputs on success. Re-provisioning a *live* stack is blocked; a
rolled-back stack is deleted so a fresh ``CreateStack`` (retry) can run.
"""

from __future__ import annotations

from typing import Any

from botocore.exceptions import ClientError
from django.utils import timezone

from core.models import Deployment, DeploymentStackOutput, Project, ProvisioningLogEntry

from . import aws_client, cfn_events


class DeployError(Exception):
    """A precondition for provisioning is missing or AWS rejected the request."""


def _slug(name: str) -> str:
    out = "".join(c if c.isalnum() or c == "-" else "-" for c in (name or "")).lower()
    return out.strip("-") or "app"


def _ready_deployment(project: Project) -> Deployment:
    """The Deployment carrying the validated template (from the IaC step)."""
    deployment = (
        Deployment.objects.filter(project=project)
        .exclude(status=Deployment.Status.COMPLETE)
        .order_by("-created_at")
        .first()
    )
    if deployment is None or not deployment.cloudformation_template:
        raise DeployError("Generate and validate a CloudFormation template before provisioning.")
    return deployment


def _active_deployment(project: Project) -> Deployment | None:
    """The Deployment that has a submitted stack (for status polling)."""
    return (
        Deployment.objects.filter(project=project, cloudformation_stack_id__isnull=False)
        .exclude(cloudformation_stack_id="")
        .order_by("-created_at")
        .first()
    )


def _assume(deployment: Deployment) -> tuple[dict, str]:
    conn = deployment.aws_connection
    try:
        creds = aws_client.assume_role(
            conn.iam_role_arn, conn.bootstrap_stack_id, session_name=f"Clyro-{deployment.project_id}"
        )
    except ClientError as exc:
        raise DeployError(f"Could not access your AWS account: {exc.response['Error']['Message']}")
    return creds, (conn.aws_region or "us-east-1")


def _stack_name(deployment: Deployment) -> str:
    slug = _slug(deployment.project.name)
    return f"clyro-{slug}-{deployment.environment}"[:120]


# ── Submit / retry ─────────────────────────────────────────────────────────────

def start(project: Project) -> dict[str, Any]:
    """Submit the template (CreateStack). Retry-safe: a rolled-back stack is deleted
    first; a live stack is blocked."""
    deployment = _ready_deployment(project)
    if deployment.status != Deployment.Status.IAC_READY:
        raise DeployError("The template hasn't been validated yet — validate it, then provision.")

    creds, region = _assume(deployment)
    stack_name = _stack_name(deployment)
    existing = aws_client.find_stack(creds, region, stack_name)

    if cfn_events.is_live(existing):
        raise DeployError("This project is already provisioned and live. Re-provisioning a live stack isn't supported yet.")
    if existing and existing.endswith("_IN_PROGRESS"):
        # A submit (or delete) is already running — just let the frontend poll it.
        deployment.status = Deployment.Status.IN_PROGRESS
        deployment.save(update_fields=["status", "updated_at"])
        return {"status": deployment.status}
    if cfn_events.is_rolled_back(existing):
        aws_client.delete_stack(creds, region, stack_name)  # clear it before recreating

    deployment.status = Deployment.Status.SUBMITTING
    deployment.save(update_fields=["status", "updated_at"])
    try:
        stack_id = aws_client.create_stack(creds, region, stack_name, deployment.cloudformation_template)
    except ClientError as exc:
        msg = exc.response["Error"]["Message"]
        deployment.status = Deployment.Status.IAC_READY  # not submitted; allow another try
        deployment.save(update_fields=["status", "updated_at"])
        if "already exists" in msg or "_IN_PROGRESS" in msg:
            raise DeployError("Removing the previous failed stack — click Provision again in a few seconds.")
        raise DeployError(f"AWS error submitting the stack: {msg}")

    deployment.cloudformation_stack_id = stack_id
    deployment.cloudformation_stack_name = stack_name
    deployment.status = Deployment.Status.IN_PROGRESS
    deployment.started_at = timezone.now()
    deployment.save(update_fields=[
        "cloudformation_stack_id", "cloudformation_stack_name", "status", "started_at", "updated_at",
    ])
    if project.status != Project.Status.PROVISIONING:
        project.status = Project.Status.PROVISIONING
        project.save(update_fields=["status", "updated_at"])
    return {"status": deployment.status}


# ── Poll status / live feed ────────────────────────────────────────────────────

def _persist_new_events(deployment: Deployment, events: list[dict]) -> None:
    existing = ProvisioningLogEntry.objects.filter(deployment=deployment)
    seen = {(e.raw_event or {}).get("EventId") for e in existing}
    seq = existing.count()
    rows = []
    for event in events:
        if event.get("EventId") in seen:
            continue
        entry = cfn_events.translate_event(event, seq)
        rows.append(ProvisioningLogEntry(
            deployment=deployment,
            sequence=entry["sequence"],
            resource_type=entry["resource_type"],
            resource_id=entry["resource_id"],
            status=entry["status"],
            plain_message=entry["plain_message"],
            raw_event=entry["raw_event"],
            event_timestamp=entry["event_timestamp"],
        ))
        seen.add(event.get("EventId"))
        seq += 1
    if rows:
        ProvisioningLogEntry.objects.bulk_create(rows)


def _serialize_log(deployment: Deployment) -> list[dict]:
    return [
        {
            "sequence": e.sequence,
            "status": e.status,
            "plain_message": e.plain_message,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
        }
        for e in ProvisioningLogEntry.objects.filter(deployment=deployment).order_by("sequence")
    ]


def _save_outputs(deployment: Deployment, outputs: list[dict]) -> None:
    for o in outputs:
        if not o.get("output_key"):
            continue
        DeploymentStackOutput.objects.update_or_create(
            deployment=deployment,
            output_key=o["output_key"],
            defaults={"output_value": o.get("output_value") or "", "description": o.get("description")},
        )


def poll(project: Project) -> dict[str, Any]:
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to report on.")

    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)

    try:
        info = aws_client.describe_stack(creds, region, stack_name)
        events = aws_client.describe_stack_events(creds, region, stack_name)
    except ClientError as exc:
        if "does not exist" in exc.response["Error"]["Message"]:
            # Stack was deleted (e.g. mid-retry cleanup) — report current state, keep polling.
            return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": [], "error": None}
        raise DeployError(f"AWS error reading stack status: {exc.response['Error']['Message']}")

    _persist_new_events(deployment, events)
    stack_status = info["status"]
    error = None

    if cfn_events.is_live(stack_status):
        _save_outputs(deployment, info["outputs"])
        if deployment.status != Deployment.Status.COMPLETE:
            deployment.status = Deployment.Status.COMPLETE
            deployment.completed_at = timezone.now()
            deployment.save(update_fields=["status", "completed_at", "updated_at"])
        if project.status != Project.Status.LIVE:
            project.status = Project.Status.LIVE
            project.save(update_fields=["status", "updated_at"])
    elif cfn_events.is_terminal(stack_status) and cfn_events.is_failure(stack_status):
        new_status = (
            Deployment.Status.ROLLED_BACK if "ROLLBACK" in stack_status else Deployment.Status.FAILED
        )
        if deployment.status != new_status:
            deployment.status = new_status
            deployment.completed_at = timezone.now()
            deployment.save(update_fields=["status", "completed_at", "updated_at"])
        if project.status != Project.Status.FAILED:
            project.status = Project.Status.FAILED
            project.save(update_fields=["status", "updated_at"])
        error = _root_failure(deployment) or info.get("reason")
    else:
        if deployment.status != Deployment.Status.IN_PROGRESS:
            deployment.status = Deployment.Status.IN_PROGRESS
            deployment.save(update_fields=["status", "updated_at"])

    outputs = [
        {"key": o.output_key, "value": o.output_value, "description": o.description}
        for o in DeploymentStackOutput.objects.filter(deployment=deployment)
    ]
    return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": outputs, "error": error}


def _root_failure(deployment: Deployment) -> str | None:
    """The first failed resource event (root cause) — later failures are usually
    'Resource creation cancelled' cascades."""
    first = (
        ProvisioningLogEntry.objects.filter(deployment=deployment, status="failed")
        .exclude(resource_type="AWS::CloudFormation::Stack")
        .order_by("sequence")
        .first()
    )
    return first.plain_message if first else None
