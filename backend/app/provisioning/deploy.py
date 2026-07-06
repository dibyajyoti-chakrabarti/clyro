"""Step 4.5 provisioning service — submit the validated CloudFormation template to
the user's AWS account and stream back a plain-English live feed.

Deterministic + Django-driven (no agent): ``start`` submits the stack via the
assumed cross-account role; ``poll`` reads stack events on each frontend tick,
translates them (``cfn_events``), persists ``ProvisioningLogEntry`` rows, and
captures outputs on success. Re-provisioning a *live* stack is blocked; a
rolled-back stack is deleted so a fresh ``CreateStack`` (retry) can run.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from botocore.exceptions import ClientError
from django.conf import settings
from django.utils import timezone

from core.models import Deployment, DeploymentStackOutput, Project, ProvisioningLogEntry

from . import aws_client, cfn_events

log = logging.getLogger(__name__)


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

_RETRYABLE_STATUSES = (
    Deployment.Status.IAC_READY, Deployment.Status.FAILED, Deployment.Status.ROLLED_BACK,
)


def start(project: Project) -> dict[str, Any]:
    """Submit the template (CreateStack). Retry-safe: a rolled-back stack is deleted
    first; a live stack is blocked. A previous FAILED/ROLLED_BACK attempt is a valid
    starting point too — the frontend's "Retry" button calls this directly, and the
    template itself is presumably still fine (the failure was an AWS-side issue, not a
    template defect); only require re-validating from scratch (GENERATING_IAC/PENDING)."""
    deployment = _ready_deployment(project)
    if deployment.status not in _RETRYABLE_STATUSES:
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

    # A retry reuses the same Deployment row (see _ready_deployment) — clear the
    # previous attempt's log entries first, or the new attempt's feed would show old
    # failed-attempt entries (e.g. a since-fixed error) mixed in with current ones,
    # making a successful retry look like it's still hitting the old failure.
    ProvisioningLogEntry.objects.filter(deployment=deployment).delete()
    DeploymentStackOutput.objects.filter(deployment=deployment).delete()

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


_ARN_ACCOUNT_RE = re.compile(r"arn:aws[a-z-]*:[a-z0-9-]*:[a-z0-9-]*:(\d{12}):")


def _is_safe_output(deployment: Deployment, value: str) -> bool:
    """Defense-in-depth: the stack template is authored fresh by an LLM on every
    generation, so nothing deterministically guarantees it never references
    Clyro's own account. Every provisioning call runs post-assume-role inside the
    user's account, so this should never trip in practice — but if an Output ever
    names Clyro's account ID, or an ARN scoped to some OTHER account (neither
    Clyro's nor the user's own connected account), drop it rather than let it
    reach the user's browser."""
    clyro_account = getattr(settings, "CLYRO_AWS_ACCOUNT_ID", "")
    if clyro_account and clyro_account in value:
        return False
    user_account = deployment.aws_connection.aws_account_id
    for account in _ARN_ACCOUNT_RE.findall(value):
        if account != user_account:
            return False
    return True


def _save_outputs(deployment: Deployment, outputs: list[dict]) -> None:
    for o in outputs:
        if not o.get("output_key"):
            continue
        value = o.get("output_value") or ""
        if not _is_safe_output(deployment, value):
            log.error(
                "Dropping unsafe stack output %s for deployment %s: references an "
                "unexpected AWS account", o["output_key"], deployment.id,
            )
            continue
        DeploymentStackOutput.objects.update_or_create(
            deployment=deployment,
            output_key=o["output_key"],
            defaults={"output_value": value, "description": o.get("description")},
        )


def poll(project: Project) -> dict[str, Any]:
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to report on.")

    # Pause/resume never touch the CFN stack itself (ECS/RDS only stay stopped —
    # the stack remains CREATE_COMPLETE throughout), so the CFN-status-driven logic
    # below would otherwise flip a PAUSED deployment straight back to COMPLETE.
    if deployment.status == Deployment.Status.PAUSED:
        return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": [], "error": None}

    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)

    try:
        info = aws_client.describe_stack(creds, region, stack_name)
        events = aws_client.describe_stack_events(creds, region, stack_name)
    except ClientError as exc:
        if "does not exist" in exc.response["Error"]["Message"]:
            if deployment.status == Deployment.Status.DELETING:
                deployment.status = Deployment.Status.DELETED
                deployment.completed_at = timezone.now()
                deployment.save(update_fields=["status", "completed_at", "updated_at"])
                project.status = Project.Status.DELETED
                project.save(update_fields=["status", "updated_at"])
            # Stack was deleted (e.g. mid-retry cleanup, or a completed teardown) —
            # report current state, keep polling.
            return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": [], "error": None}
        raise DeployError(f"AWS error reading stack status: {exc.response['Error']['Message']}")

    _persist_new_events(deployment, events)

    if deployment.status == Deployment.Status.DELETING:
        # Stack still exists — deletion is in progress; don't let the CREATE_COMPLETE
        # branch below resurrect the deployment to COMPLETE while it's tearing down.
        return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": [], "error": None}
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


# ── Pause / resume (reversible scale-to-zero) ───────────────────────────────────

def _live_deployment(project: Project) -> Deployment:
    deployment = _active_deployment(project)
    if deployment is None or deployment.status not in (
        Deployment.Status.COMPLETE, Deployment.Status.PAUSED,
    ):
        raise DeployError("This project has no live infrastructure to pause/resume.")
    return deployment


def pause(project: Project) -> dict[str, Any]:
    """Reversible cost-saving pause: scale every ECS service in the stack to 0
    desired tasks and stop every RDS instance/Aurora cluster. The CFN stack itself
    is untouched — nothing is deleted, so ``resume`` can bring it back."""
    deployment = _live_deployment(project)
    if deployment.status == Deployment.Status.PAUSED:
        return {"status": deployment.status}

    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)
    resources = aws_client.list_stack_resources(creds, region, stack_name)

    ecs_state: list[dict[str, Any]] = []
    for r in resources:
        if r["resource_type"] != "AWS::ECS::Service" or not r["physical_id"]:
            continue
        parsed = aws_client.parse_ecs_service_arn(r["physical_id"])
        if not parsed:
            continue
        cluster, service = parsed
        desired = aws_client.get_ecs_service_desired_count(creds, region, cluster, service)
        ecs_state.append({"cluster": cluster, "service": service, "desired": desired})
        if desired:
            aws_client.set_ecs_service_desired_count(creds, region, cluster, service, 0)

    rds_clusters = [
        r["physical_id"] for r in resources
        if r["resource_type"] == "AWS::RDS::DBCluster" and r["physical_id"]
    ]
    for cluster_id in rds_clusters:
        aws_client.stop_db_cluster(creds, region, cluster_id)

    rds_instances = [
        r["physical_id"] for r in resources
        if r["resource_type"] == "AWS::RDS::DBInstance" and r["physical_id"]
        and not aws_client.is_db_cluster_member(creds, region, r["physical_id"])
    ]
    for instance_id in rds_instances:
        aws_client.stop_db_instance(creds, region, instance_id)

    deployment.paused_state = {
        "ecs": ecs_state, "rds_clusters": rds_clusters, "rds_instances": rds_instances,
    }
    deployment.status = Deployment.Status.PAUSED
    deployment.save(update_fields=["paused_state", "status", "updated_at"])
    project.status = Project.Status.PAUSED
    project.save(update_fields=["status", "updated_at"])
    return {"status": deployment.status}


def resume(project: Project) -> dict[str, Any]:
    """Undo ``pause``: restore each ECS service's prior desired count and start
    the RDS instances/clusters back up."""
    deployment = _live_deployment(project)
    if deployment.status != Deployment.Status.PAUSED:
        return {"status": deployment.status}

    creds, region = _assume(deployment)
    state = deployment.paused_state or {}

    for entry in state.get("ecs", []):
        aws_client.set_ecs_service_desired_count(
            creds, region, entry["cluster"], entry["service"], entry["desired"])
    for cluster_id in state.get("rds_clusters", []):
        aws_client.start_db_cluster(creds, region, cluster_id)
    for instance_id in state.get("rds_instances", []):
        aws_client.start_db_instance(creds, region, instance_id)

    deployment.paused_state = None
    deployment.status = Deployment.Status.COMPLETE
    deployment.save(update_fields=["paused_state", "status", "updated_at"])
    project.status = Project.Status.LIVE
    project.save(update_fields=["status", "updated_at"])
    return {"status": deployment.status}


# ── Teardown (full delete) ───────────────────────────────────────────────────────

def teardown(project: Project) -> dict[str, Any]:
    """Permanently delete the user's CFN stack. Irreversible — unlike ``pause``,
    this destroys every resource the stack created. ``poll`` picks up the
    DELETING -> DELETED transition once the stack disappears."""
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No provisioned infrastructure to delete.")
    if deployment.status in (Deployment.Status.DELETING, Deployment.Status.DELETED):
        return {"status": deployment.status}

    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)
    try:
        aws_client.delete_stack(creds, region, stack_name)
    except ClientError as exc:
        raise DeployError(f"AWS error deleting the stack: {exc.response['Error']['Message']}")

    deployment.status = Deployment.Status.DELETING
    deployment.save(update_fields=["status", "updated_at"])
    return {"status": deployment.status}


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


# ── Provisioning feedback loop ───────────────────────────────────────────────
#
# No agent one-shots provisioning reliably — this session alone hit three
# distinct real-AWS-only failures (a hallucinated CloudFront policy ID, an
# ElastiCache Retain policy wedging rollback, a secret referenced as JSON that
# was actually a plain string) that no amount of static analysis (cfn-lint/
# cfn-guard/security_scan) could have caught ahead of time — each only surfaces
# at the real CreateStack call. `provision_with_feedback` closes that gap: it
# supervises a submit-and-poll attempt end-to-end, and on a real deploy
# failure, feeds the actual AWS error back into ONE bounded `iac.refine()`
# correction round (same shape as the existing lint-fix/security-fix loops in
# iac.py) before retrying once. If the retry also fails, it stops and hands
# the real error back to the user rather than compounding CFN churn further.

_TERMINAL_STATUSES = (Deployment.Status.COMPLETE, Deployment.Status.FAILED, Deployment.Status.ROLLED_BACK)
_POLL_INTERVAL_SECONDS = 8
# 15 min per attempt — the UI's own copy says a healthy deploy typically takes
# 8-12 min. This task supervises for one correction round, not indefinitely; if
# a stack is still non-terminal past this ceiling (e.g. an ECS service that
# never reaches steady state because the user's own image crash-loops), this
# task simply stops watching and returns the current in-progress state — the
# frontend's own deploy-status polling keeps reflecting real AWS state either
# way. Two attempts at this ceiling plus one refine() round must fit inside
# run_provision_task's soft_time_limit (app/tasks.py) with margin.
_POLL_TIMEOUT_SECONDS = 900


def _poll_to_terminal(project: Project) -> dict[str, Any]:
    import time

    elapsed = 0
    result = poll(project)
    while result["status"] not in _TERMINAL_STATUSES and elapsed < _POLL_TIMEOUT_SECONDS:
        time.sleep(_POLL_INTERVAL_SECONDS)
        elapsed += _POLL_INTERVAL_SECONDS
        result = poll(project)
    return result


def _correction_instruction(root_cause: str) -> str:
    return (
        "The last deployment attempt failed with this real AWS error (not a static-"
        "analysis finding — this happened during the actual CreateStack/UpdateStack "
        f"call). Fix ONLY what's needed to resolve it, changing nothing else:\n{root_cause}"
    )


def provision_with_feedback(project: Project) -> dict[str, Any]:
    """Assumes `start()` has already been submitted (the view does this
    synchronously — it's a fast precondition-checked CreateStack call, not the
    slow part). Poll to a terminal state, and — on a real deploy failure — make
    ONE bounded attempt to self-correct from the actual AWS error before
    handing control back to the user. Returns the final `poll()`-shaped dict."""
    from . import iac

    result = _poll_to_terminal(project)

    if result["status"] in (Deployment.Status.FAILED, Deployment.Status.ROLLED_BACK):
        deployment = _active_deployment(project)
        root_cause = (deployment and _root_failure(deployment)) or result.get("error")
        if root_cause:
            try:
                refine_result = iac.refine(project, _correction_instruction(root_cause))
                # refine() leaves the deployment in GENERATING_IAC even on a clean
                # fix — validate() is what promotes it to IAC_READY, the
                # precondition start() requires before it will resubmit.
                validate_result = iac.validate(project, refine_result["template"])
            except iac.IacError:
                return result  # couldn't even refine — surface the original failure
            if validate_result["status"] != Deployment.Status.IAC_READY:
                return result  # the correction didn't produce a clean template — stop here
            # start()'s own rolled-back-stack cleanup issues delete_stack() but
            # doesn't wait for it to finish before this resubmits — found live,
            # this races and raises a transient DeployError ("Removing the
            # previous failed stack...") exactly the way a human retrying too
            # quickly would hit it. A person just clicks Provision again a few
            # seconds later; do the same here, bounded.
            import time
            for attempt in range(3):
                try:
                    start(project)
                    break
                except DeployError:
                    if attempt == 2:
                        raise
                    time.sleep(10)
            result = _poll_to_terminal(project)

    return result
