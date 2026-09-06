"""Periodic reconciliation of AWS state Clyro's own DB can silently drift from.

Found live: 12 AWSAccountConnection rows pointed at nonexistent IAM roles (the
customer tore down the bootstrap stack out-of-band), and 3 Deployment rows were
stuck in status='deleting' forever — teardown()'s first step (_assume()) always
fails for a dead connection, so poll()'s DELETING -> DELETED transition
(deploy.py's describe_stack "does not exist" branch) never got a chance to run
if the user closed the tab after that failure. The existing mitigation
(_assume() surfacing "reconnect your AWS account") is reactive — only fires on
the user's next action. This sweep is proactive: it runs on a schedule
(CELERY_BEAT_SCHEDULE, config/settings.py) so a dead connection or a stuck
deletion is caught and surfaced before the user has to trip over it.

AWS gives no way to distinguish "role deleted" from "role exists but wrong
permissions" (AssumeRole returns the same AccessDenied for both, deliberately —
see deploy._assume's own docstring) — so this never guesses; it only records
what AssumeRole actually told us, either now or on any given tick.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from botocore.exceptions import ClientError
from django.db.models import Q
from django.utils import timezone

from core.models import AWSAccountConnection, AgentJob, Deployment, Project, ProvisioningLogEntry

from . import aws_client, deploy

log = logging.getLogger(__name__)

# Skip a connection checked more recently than this, so a short beat interval
# doesn't hammer STS on every tick for connections we already know about.
_MIN_RECHECK_INTERVAL = timedelta(minutes=10)


def _check_connection(conn: AWSAccountConnection) -> tuple[bool | None, dict | None]:
    """(healthy, creds). healthy is True/False for a confirmed answer, or None
    when the check itself failed for a reason unrelated to the role's
    validity (throttling, network) — the caller should leave the connection's
    recorded state untouched rather than guessing from a transient error.
    creds is populated only when healthy is True, so callers never need a
    second assume_role call to get working credentials."""
    try:
        creds = aws_client.assume_role(
            conn.iam_role_arn, conn.bootstrap_stack_id,
            session_name=f"Clyro-Reconcile-{conn.project_id}",
        )
        return True, creds
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in ("AccessDenied", "AccessDeniedException"):
            return False, None
        log.warning("Reconcile: transient error checking connection %s: %s", conn.id, exc)
        return None, None
    except Exception:
        log.exception("Reconcile: unexpected error checking connection %s", conn.id)
        return None, None


def _append_log_entry(deployment: Deployment, message: str) -> None:
    seq = ProvisioningLogEntry.objects.filter(deployment=deployment).count()
    ProvisioningLogEntry.objects.create(
        deployment=deployment,
        sequence=seq,
        resource_type=None,
        resource_id=None,
        status="info",
        plain_message=message,
        raw_event=None,
        event_timestamp=timezone.now(),
    )


def _resolve_stuck_deletion(deployment: Deployment) -> bool:
    """Returns True if this deployment's state was actually changed."""
    conn = deployment.aws_connection
    if conn is None or not deployment.cloudformation_stack_name:
        return False

    healthy, creds = _check_connection(conn)
    if healthy is None:
        return False  # transient — leave it for the next tick

    if not healthy:
        deployment.status = Deployment.Status.FAILED
        deployment.save(update_fields=["status", "updated_at"])
        _append_log_entry(
            deployment,
            "Could not confirm deletion: your AWS connection is no longer valid. "
            "If you deleted the bootstrap stack yourself, this infrastructure is "
            "gone; reconnect your AWS account if you need to confirm or manage it further.",
        )
        return True

    region = conn.aws_region or "us-east-1"
    try:
        stack_status = aws_client.find_stack(creds, region, deployment.cloudformation_stack_name)
    except ClientError as exc:
        log.warning("Reconcile: could not describe stack for deployment %s: %s", deployment.id, exc)
        return False

    if stack_status is not None:
        return False  # genuinely still deleting — nothing to reconcile yet

    project = deployment.project

    # A full project delete (AgentJob(kind=DELETE) — any status, since a DONE
    # one would already have cascaded the project row away) got cut off
    # mid-flight, most likely by run_delete_project_task's own poll timeout.
    # Flipping statuses alone would leave a permanent ghost: Project.DELETED's
    # own contract is that the row disappears, not that it parks here forever
    # with its secrets and connector stack never purged. Finish what the task
    # started instead of just marking it resolved.
    if AgentJob.objects.filter(project=project, kind=AgentJob.Kind.DELETE).exists():
        try:
            deploy.destroy(project)
            project.deployments.all().delete()
            project.delete()
        except Exception:
            log.exception("Reconcile: failed to finish full delete for project %s", project.pk)
            return False
        return True

    deployment.status = Deployment.Status.DELETED
    deployment.completed_at = timezone.now()
    deployment.save(update_fields=["status", "completed_at", "updated_at"])
    project.status = Project.Status.DELETED
    project.save(update_fields=["status", "updated_at"])
    return True


def sweep() -> dict[str, int]:
    """Run one reconciliation pass. Cheap and idempotent — safe to call from a
    Celery beat schedule or a one-off management command."""
    counts = {
        "connections_checked": 0, "connections_marked_dead": 0,
        "deployments_checked": 0, "deployments_resolved": 0,
    }

    cutoff = timezone.now() - _MIN_RECHECK_INTERVAL
    connections = AWSAccountConnection.objects.filter(connected_at__isnull=False).filter(
        Q(last_reconciled_at__isnull=True) | Q(last_reconciled_at__lt=cutoff)
    )
    for conn in connections:
        counts["connections_checked"] += 1
        healthy, _creds = _check_connection(conn)
        if healthy is None:
            continue
        conn.health_status = (
            AWSAccountConnection.HealthStatus.HEALTHY if healthy
            else AWSAccountConnection.HealthStatus.UNREACHABLE
        )
        conn.last_reconciled_at = timezone.now()
        conn.save(update_fields=["health_status", "last_reconciled_at", "updated_at"])
        if not healthy:
            counts["connections_marked_dead"] += 1

    stuck = Deployment.objects.filter(status=Deployment.Status.DELETING).select_related("aws_connection", "project")
    for deployment in stuck:
        counts["deployments_checked"] += 1
        if _resolve_stuck_deletion(deployment):
            counts["deployments_resolved"] += 1

    log.info("Reconcile sweep: %s", counts)
    return counts
