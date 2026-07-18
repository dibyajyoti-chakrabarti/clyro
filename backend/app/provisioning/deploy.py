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
import time
from typing import Any

from botocore.exceptions import ClientError
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import Deployment, DeploymentStackOutput, IntentRecord, Project, ProvisioningLogEntry

from . import aws_client, cfn_events, runtime_probe

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
    if conn is None:
        raise DeployError("Connect your AWS account before provisioning.")
    # AWS does not expose a way to check whether a role in ANOTHER account
    # still exists without already having access to that account — IAM:GetRole
    # is account-scoped to the caller's own credentials, and AssumeRole itself
    # deliberately returns the same AccessDenied for "role deleted" and "role
    # exists but trust/permissions are wrong" (a security property, not a gap).
    # So the only honest signal we have is AssumeRole's own AccessDenied —
    # surface it as "reconnect", since a stale connection (bootstrap stack torn
    # down out-of-band) is by far the common real-world cause.
    try:
        creds = aws_client.assume_role(
            conn.iam_role_arn, conn.bootstrap_stack_id, session_name=f"Clyro-{deployment.project_id}"
        )
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code in ("AccessDenied", "AccessDeniedException"):
            raise DeployError("Your AWS connection is no longer valid — reconnect your AWS account.")
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

    # Re-check the template against the CURRENT blocker set — never trust a stale
    # IAC_READY. A template validated before a blocker check existed (e.g. the
    # CloudFront S3-origin gate, or the new capability gate) would otherwise deploy
    # unchecked; this nearly re-shipped a known-bad template from the review screen.
    # Deterministic and agent-free, so it stays a fast precondition (no AWS call yet).
    from . import iac
    spec = iac._spec_for(deployment)
    blockers = [f for f in iac._collect_findings(deployment.cloudformation_template, spec)
                if f["severity"] == "blocker"]
    if blockers:
        raise DeployError(
            "This template has unresolved issues and can't be provisioned yet:\n- "
            + "\n- ".join(b["message"] for b in blockers[:5])
            + "\n\nRegenerate or refine the template to resolve them, then provision."
        )

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

    # Domain support: generate()/refine()/validate() make no live AWS calls by
    # design (the account may not even be connected yet at template-generation
    # time), so the Route53 hosted zone lookup happens here instead, right
    # after credentials are confirmed — the earliest point it can be resolved.
    stack_parameters = None
    domain = spec.get("domain") or {}
    if domain.get("has_domain") and domain.get("hosted_zone_name"):
        zone_id = domain.get("hosted_zone_id") or aws_client.find_hosted_zone_id(
            creds, region, domain["hosted_zone_name"],
        )
        stack_parameters = {"DomainHostedZoneId": zone_id or ""}

    # Found live: the delete_stack() above is fire-and-forget (CFN deletes
    # asynchronously) — create_stack moments later can race it and fail with
    # "already exists"/"_IN_PROGRESS" even though the delete is genuinely still
    # in flight, not stuck. A human clicking Provision again a few seconds later
    # just works; do the same automatically, bounded, rather than surfacing a
    # transient race as a hard failure to both the manual Retry button and the
    # automated correction path in provision_with_feedback.
    stack_id = None
    last_exc = None
    for attempt in range(4):
        try:
            stack_id = aws_client.create_stack(
                creds, region, stack_name, deployment.cloudformation_template, stack_parameters,
            )
            last_exc = None
            break
        except ClientError as exc:
            last_exc = exc
            msg = exc.response["Error"]["Message"]
            if not ("already exists" in msg or "_IN_PROGRESS" in msg) or attempt == 3:
                break
            time.sleep(5)
    if last_exc is not None:
        msg = last_exc.response["Error"]["Message"]
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
        # Found live: with provisioning now supervised by a background Celery task
        # (provision_with_feedback's own _poll_to_terminal) while the frontend is
        # ALSO still polling deploy_status directly for the live log feed, two
        # concurrent poll() calls can both read the same existing.count() and race
        # to insert the same (deployment, sequence) pair, violating the unique
        # constraint. ignore_conflicts makes the losing writer a no-op instead of a
        # crash — the winning writer's row is equivalent, and the next poll() call
        # re-reads a consistent count from the DB regardless of which one won.
        ProvisioningLogEntry.objects.bulk_create(rows, ignore_conflicts=True)


def _serialize_log(deployment: Deployment, since: int | None = None) -> list[dict]:
    qs = ProvisioningLogEntry.objects.filter(deployment=deployment)
    if since is not None:
        qs = qs.filter(sequence__gt=since)
    return [
        {
            "sequence": e.sequence,
            "status": e.status,
            "plain_message": e.plain_message,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
        }
        for e in qs.order_by("sequence")
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
    user_account = deployment.aws_connection.aws_account_id
    # Unless the user connected the account Clyro itself runs in — dogfooding, where
    # every legitimate output names it. Found live: FrontendBucketName, SQSQueueURL
    # and ECRRepositoryURI were all silently dropped from the user's own deployment.
    if clyro_account and clyro_account != user_account and clyro_account in value:
        return False
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


def poll(project: Project, since: int | None = None) -> dict[str, Any]:
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to report on.")

    # Pause/resume never touch the CFN stack itself (ECS/RDS only stay stopped —
    # the stack remains CREATE_COMPLETE throughout), so the CFN-status-driven logic
    # below would otherwise flip a PAUSED deployment straight back to COMPLETE.
    if deployment.status == Deployment.Status.PAUSED:
        return {"status": deployment.status, "log": _serialize_log(deployment, since), "outputs": [], "error": None}

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
            return {"status": deployment.status, "log": _serialize_log(deployment, since), "outputs": [], "error": None}
        raise DeployError(f"AWS error reading stack status: {exc.response['Error']['Message']}")

    _persist_new_events(deployment, events)

    if deployment.status == Deployment.Status.DELETING:
        # Stack still exists — deletion is in progress; don't let the CREATE_COMPLETE
        # branch below resurrect the deployment to COMPLETE while it's tearing down.
        return {"status": deployment.status, "log": _serialize_log(deployment, since), "outputs": [], "error": None}
    stack_status = info["status"]
    error = None

    if cfn_events.is_live(stack_status):
        _save_outputs(deployment, info["outputs"])
        # The stack itself is up, but nothing has built the customer's code into
        # it yet (see build.py) — BUILDING is the signal for
        # provision_with_feedback to hand off to the build step next; poll()
        # itself never promotes straight to COMPLETE/LIVE anymore, since a
        # CREATE_COMPLETE stack with empty ECR repos / an empty S3 bucket isn't
        # actually usable. A deployment already past BUILDING (COMPLETE,
        # BUILD_FAILED, etc.) is left alone here — this branch only fires the
        # first time CFN goes live.
        #
        # FAILED belongs in this list too: a service that never stabilizes is a
        # *runtime* failure on a stack that stays CREATE_COMPLETE, so this branch
        # would otherwise flip it back to BUILDING on the frontend's next poll and
        # bury the diagnosis. Found live on deploy #3.
        #
        # The exclusion check must run against a FRESH status under a row lock, not
        # this poll()'s in-memory copy: poll() runs in a web request and races the
        # provision task's status writes (celery worker), and the describe_stack
        # calls above take seconds — long enough for the build step to write FAILED
        # in between. A stale IN_PROGRESS read here would pass the check and clobber
        # that FAILED back to BUILDING, stranding the deploy at "building" with no
        # failure screen. Found live testing the migration-failure path.
        with transaction.atomic():
            locked = Deployment.objects.select_for_update().get(pk=deployment.pk)
            if locked.status not in (
                Deployment.Status.BUILDING, Deployment.Status.BUILD_FAILED,
                Deployment.Status.COMPLETE, Deployment.Status.FAILED,
            ):
                locked.status = Deployment.Status.BUILDING
                locked.save(update_fields=["status", "updated_at"])
            deployment.status = locked.status
    elif cfn_events.is_rolling_back(stack_status):
        if deployment.status != Deployment.Status.ROLLING_BACK:
            deployment.status = Deployment.Status.ROLLING_BACK
            deployment.save(update_fields=["status", "updated_at"])
        error = _root_failure(deployment) or info.get("reason")
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
    return {"status": deployment.status, "log": _serialize_log(deployment, since), "outputs": outputs, "error": error}


# ── Pause / resume (reversible scale-to-zero) ───────────────────────────────────

# ── Cold-start scale-up (the other half of iac.enforce_ecs_desired_count) ─────

_STEADY_POLL_SECONDS = 10
# ECS pulls the image, starts the task, and (for the ALB-fronted service) waits out
# the target group's health checks before it counts as running. Well under the ~3h
# CFN would have burned; long enough for a cold Fargate pull plus health checks.
_STEADY_TIMEOUT_SECONDS = 480
# Found live: a service that reaches its task count and is killed three minutes
# later by a failing health check was reported steady, because the old check
# dropped a service from the wait list the first time it observed
# `running >= desired`. A single sample cannot distinguish "running" from
# "running, for now". Require the condition to hold across consecutive polls so
# a kill/replace cycle resets the streak instead of going unnoticed.
_STEADY_CONFIRM_POLLS = 3


_SERVICE_NAME_SUFFIXES = ("-service", "-svc", "-ecs")


def _desired_for_service(service_name: str, counts_by_node: dict[str, int]) -> int:
    """Match an ECS service's *name* back to its canvas node. Service names are
    LLM-chosen, but every one observed ends with the node id it runs
    (`taskboard-prod-backend`). Anchor on that suffix rather than any substring:
    `taskboard-prod-backend-worker` contains "backend" but *is* the worker."""
    name = service_name.lower()
    for suffix in _SERVICE_NAME_SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    ends_with = [node for node in counts_by_node if name.endswith(node)]
    if ends_with:
        return counts_by_node[max(ends_with, key=len)]
    contains = [node for node in counts_by_node if node in name]
    if contains:
        return counts_by_node[max(contains, key=len)]
    log.warning("scale: ECS service %r matched no canvas node; defaulting to 1 task",
                service_name)
    return 1


def _service_is_serving(creds: dict, region: str, cluster: str, service: str,
                        desired: int, since) -> tuple[bool, str]:
    """Is this service running its tasks *and* actually able to serve? Returns
    ``(ok, reason_if_not)``.

    Three independent ways a scaled-up service can still be broken, in the order
    they are cheapest to detect:

    1. It never reaches its task count (image won't pull, or the container exits
       immediately).
    2. It reaches the count, then a task is killed and replaced — a crash loop.
       Detected by any task stopping *after* the scale-up began; `since` is what
       separates this run's kills from stopped tasks left over from earlier.
    3. It reaches the count and stays there, but the load balancer never marks
       the target healthy, so no traffic ever reaches it. This is the one that
       stayed invisible: from ECS's side the service looks perfect.
    """
    counts = aws_client.get_ecs_service_counts(creds, region, cluster, service)
    if counts["running"] != desired or counts["pending"]:
        return False, (f"running={counts['running']} pending={counts['pending']} "
                       f"desired={desired}")

    for task in aws_client.describe_stopped_tasks(creds, region, cluster, service):
        stopped_at = task.get("stoppedAt")
        if stopped_at and stopped_at >= since:
            return False, "a task was stopped after scale-up — the service is replacing tasks"

    service_detail = aws_client.describe_ecs_service(creds, region, cluster, service)
    for load_balancer in service_detail.get("loadBalancers") or []:
        target_group_arn = load_balancer.get("targetGroupArn")
        if not target_group_arn:
            continue
        targets = aws_client.describe_target_health(creds, region, target_group_arn)
        if not targets:
            return False, "no targets registered with the load balancer"
        unhealthy = [t for t in targets if t["state"] != "healthy"]
        if unhealthy:
            return False, f"load balancer target is {unhealthy[0]['state']}"

    return True, ""


def _ecs_services_from_resources(resources: list[dict]) -> list[tuple[str, str]]:
    services = []
    for resource in resources:
        if resource["resource_type"] != "AWS::ECS::Service" or not resource["physical_id"]:
            continue
        parsed = aws_client.parse_ecs_service_arn(resource["physical_id"])
        if parsed:
            services.append(parsed)
    return services


def _stack_ecs_services(creds: dict, region: str, stack_name: str) -> list[tuple[str, str]]:
    return _ecs_services_from_resources(aws_client.list_stack_resources(creds, region, stack_name))


def _lb_dimension_value(lb_arn: str) -> str | None:
    """arn:...:loadbalancer/app/name/id -> app/name/id, the dimension value
    ApplicationELB CloudWatch metrics key on."""
    marker = ":loadbalancer/"
    idx = lb_arn.find(marker)
    return lb_arn[idx + len(marker):] if idx != -1 else None


def health(project: Project) -> dict[str, Any]:
    """Live health snapshot for Step 5: ECS service/ALB target status plus a
    handful of CloudWatch metrics for the service that's actually serving
    traffic. Returns ``stack_status: "not_found"`` (instead of raising) when the
    stack's ECS resources are gone — the caller had already gone live once, so a
    missing stack means it was torn down outside Clyro, not a real error."""
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No provisioned infrastructure to check.")

    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)

    try:
        resources = aws_client.list_stack_resources(creds, region, stack_name)
        stack_info = aws_client.describe_stack(creds, region, stack_name)
    except ClientError:
        return {"stack_status": "not_found", "health_items": [], "metrics": {}, "alerts": []}

    services = _ecs_services_from_resources(resources)
    if not services:
        return {"stack_status": "not_found", "health_items": [], "metrics": {}, "alerts": []}

    lb_arn = next(
        (r["physical_id"] for r in resources
         if r["resource_type"] == "AWS::ElasticLoadBalancingV2::LoadBalancer" and r["physical_id"]),
        None,
    )

    health_items: list[dict[str, Any]] = []
    alerts: list[dict[str, str]] = []
    fired_at = timezone.now().isoformat()  # observation time — the poll noticed it now
    serving: tuple[str, str] | None = None  # (cluster, service) with a load balancer attached

    for cluster, service in services:
        detail = aws_client.describe_ecs_service(creds, region, cluster, service)
        running = detail.get("runningCount", 0)
        desired = detail.get("desiredCount", 0)
        state = "healthy" if (desired == 0 or running >= desired) else "scaling"
        health_items.append({
            "name": service, "cluster": cluster,
            "running": running, "desired": desired, "state": state,
        })
        if desired > 0 and running < desired:
            alerts.append({
                "message": f"{service}: {running}/{desired} tasks running",
                "severity": "warning",
                "fired_at": fired_at,
            })

        for lb in detail.get("loadBalancers") or []:
            target_group_arn = lb.get("targetGroupArn")
            if not target_group_arn:
                continue
            serving = serving or (cluster, service)
            targets = aws_client.describe_target_health(creds, region, target_group_arn)
            unhealthy = [t for t in targets if t["state"] != "healthy"]
            if unhealthy:
                alerts.append({
                    "message": f"{service}: {len(unhealthy)} unhealthy load balancer target(s)",
                    "severity": "critical",
                    "fired_at": fired_at,
                })

    metrics = {"response_time_ms": None, "request_rate": None, "error_rate": None, "cpu_percent": None}
    lb_dimension = _lb_dimension_value(lb_arn) if lb_arn else None
    if lb_dimension:
        dims = [{"Name": "LoadBalancer", "Value": lb_dimension}]
        response_time = aws_client.get_cloudwatch_metric(
            creds, region, "AWS/ApplicationELB", "TargetResponseTime", dims, stat="Average")
        metrics["response_time_ms"] = round(response_time * 1000, 1) if response_time is not None else None
        request_count = aws_client.get_cloudwatch_metric(
            creds, region, "AWS/ApplicationELB", "RequestCount", dims, stat="Sum")
        metrics["request_rate"] = round(request_count / 5, 2) if request_count is not None else None
        error_count = aws_client.get_cloudwatch_metric(
            creds, region, "AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", dims, stat="Sum")
        if error_count is not None and request_count:
            metrics["error_rate"] = round(100 * error_count / request_count, 2)
        elif error_count is not None:
            metrics["error_rate"] = 0.0

    if serving:
        cluster, service = serving
        cpu = aws_client.get_cloudwatch_metric(
            creds, region, "AWS/ECS", "CPUUtilization", [
                {"Name": "ClusterName", "Value": cluster},
                {"Name": "ServiceName", "Value": service},
            ], stat="Average")
        metrics["cpu_percent"] = round(cpu, 1) if cpu is not None else None

    return {
        "stack_status": "ok",
        "health_items": health_items,
        "metrics": metrics,
        "alerts": alerts,
        "stack": {
            "name": stack_info["stack_name"] or stack_name,
            "status": stack_info["status"],
            "last_updated": stack_info["last_updated_time"],
        },
    }


def scale_services_to_spec(project: Project) -> dict[str, Any]:
    """Scale every ECS service from its cold-start 0 up to the spec's task count,
    then wait for the tasks to actually run. Called once the build has pushed a real
    image; before that there is nothing for ECS to pull.

    Returns ``{scaled: [...], steady: bool, error: str|None}``. `steady` is False when
    a service never reached its desired count — the image starts and immediately dies,
    or the ALB never marks it healthy — which means the stack is up but the app is not.
    """
    from . import iac

    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to scale.")
    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)

    counts_by_node = iac.desired_counts_by_node(iac._spec_for(deployment))
    services = _stack_ecs_services(creds, region, stack_name)
    if not services:
        return {"scaled": [], "steady": True, "error": None}

    scaled = []
    for cluster, service in services:
        target = _desired_for_service(service, counts_by_node)
        aws_client.set_ecs_service_desired_count(creds, region, cluster, service, target)
        scaled.append({"cluster": cluster, "service": service, "desired": target})
        log.info("scale_services_to_spec: %s -> %d task(s)", service, target)

    started_at = timezone.now()
    streaks = {entry["service"]: 0 for entry in scaled}
    reasons: dict[str, str] = {}
    elapsed = 0
    while elapsed < _STEADY_TIMEOUT_SECONDS:
        time.sleep(_STEADY_POLL_SECONDS)
        elapsed += _STEADY_POLL_SECONDS
        for entry in scaled:
            ok, reason = _service_is_serving(
                creds, region, entry["cluster"], entry["service"], entry["desired"], started_at)
            if ok:
                streaks[entry["service"]] += 1
            else:
                # Reset, don't decrement: a service that flaps must start its
                # confirmation window over, not creep toward steady on average.
                streaks[entry["service"]] = 0
                reasons[entry["service"]] = reason
        if all(streaks[entry["service"]] >= _STEADY_CONFIRM_POLLS for entry in scaled):
            return {"scaled": scaled, "steady": True, "error": None}

    stuck = [e for e in scaled if streaks[e["service"]] < _STEADY_CONFIRM_POLLS]
    summary = "; ".join(f"{e['service']} ({reasons.get(e['service'], 'unknown')})" for e in stuck)
    error = (f"ECS service(s) never stabilized: {summary}. The image was pushed, so this is a "
             "runtime failure, not a provisioning one.")
    diagnosis = runtime_probe.services_root_cause(
        creds, region, [(e["cluster"], e["service"]) for e in stuck])
    if diagnosis:
        error += f"\n\n{diagnosis}"
    return {"scaled": scaled, "steady": False, "error": error}


# ── Database migrations (run once, before scale-up) ────────────────────────────
#
# CloudFormation brings up an empty database; the app image's CMD is the server
# only. Without this step every ORM query 500s against a schema that was never
# created. This runs the framework's migrate command ONCE on the app's own task
# definition (image, DB secret, execution role, log config all inherited), lifting
# the live service's exact network config so the one-off task reaches RDS the same
# way the app does. Idempotent by design (a framework only earns a migrate command
# in build_spec once its command is safe to re-run), so a build retry re-runs it
# harmlessly. Best-effort to LOCATE (a service it can't map is skipped, not failed);
# strict on OUTCOME (a migrate that runs and exits non-zero fails the deploy).

_MIGRATE_TIMEOUT_SECONDS = 300
_MIGRATE_POLL_SECONDS = 6


def _service_for_node(services: list[tuple[str, str]], node_id: str) -> tuple[str, str] | None:
    """Pick the ``(cluster, service)`` whose ECS service name maps to ``node_id`` —
    same suffix-anchored matching as _desired_for_service, so a `-backend-worker`
    service is never mistaken for `backend`."""
    for cluster, service in services:
        name = service.lower()
        for suffix in _SERVICE_NAME_SUFFIXES:
            if name.endswith(suffix):
                name = name[: -len(suffix)]
                break
        if name.endswith(node_id.lower()):
            return cluster, service
    for cluster, service in services:  # looser fallback
        if node_id.lower() in service.lower():
            return cluster, service
    return None


def _migrate_container(creds: dict, region: str, task_def: str, node_id: str) -> str:
    """Which container in the task definition to run the migrate command in — the app
    container, matched by name suffix, else the first one."""
    containers = aws_client.task_definition_containers(creds, region, task_def)
    names = [c["name"] for c in containers if c.get("name")]
    for name in names:
        if name.lower().endswith(node_id.lower()):
            return name
    return names[0] if names else node_id


def _wait_migrate_task(creds: dict, region: str, cluster: str, task_arn: str,
                       task_def: str) -> dict[str, Any]:
    """Poll a one-off task to STOPPED and turn its exit into ``{ran, ok, error}``.
    On failure, enrich with the stopped reason and a tail of the task's log group so
    the user sees the actual migration error, not 'the task stopped'."""
    elapsed = 0
    task: dict[str, Any] = {}
    while elapsed < _MIGRATE_TIMEOUT_SECONDS:
        task = aws_client.describe_task(creds, region, cluster, task_arn)
        if task.get("lastStatus") == "STOPPED":
            break
        time.sleep(_MIGRATE_POLL_SECONDS)
        elapsed += _MIGRATE_POLL_SECONDS

    if task.get("lastStatus") != "STOPPED":
        return {"ran": True, "ok": False, "error": "Database migration timed out."}

    containers = task.get("containers") or []
    failed = [c for c in containers if c.get("exitCode") not in (0, None)]
    could_not_start = [c for c in containers if c.get("exitCode") is None and c.get("reason")]
    if not failed and not could_not_start:
        return {"ran": True, "ok": True, "error": None}

    if could_not_start and not failed:
        reason = could_not_start[0]["reason"]
        return {"ran": True, "ok": False,
                "error": f"The database migration task could not start: {reason}"}

    error = "Database migrations failed."
    if task.get("stoppedReason"):
        error += f" {task['stoppedReason']}"
    tail: list[str] = []
    for group in aws_client.task_definition_log_groups(creds, region, task_def):
        tail += aws_client.tail_log_group(creds, region, group, limit=15)
    if tail:
        error += "\n\n" + "\n".join(tail[-15:])
    return {"ran": True, "ok": False, "error": error}


def run_migrations(project: Project) -> dict[str, Any]:
    """Run the spec's database-migration command once, before services scale up.
    Returns ``{ran, ok, error}``: ``ran=False`` means there was nothing to do (no
    migrate framework, or the service couldn't be located) and is never a failure;
    ``ok=False`` means the migration ran and failed, which must stop the deploy."""
    from . import iac

    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to migrate.")
    migrate = iac._spec_for(deployment).get("migrate")
    if not migrate:
        return {"ran": False, "ok": True, "error": None}

    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)
    match = _service_for_node(_stack_ecs_services(creds, region, stack_name), migrate["node_id"])
    if not match:
        log.warning("run_migrations: no ECS service matched node %s; skipping", migrate["node_id"])
        return {"ran": False, "ok": True, "error": None}

    cluster, service = match
    detail = aws_client.describe_ecs_service(creds, region, cluster, service)
    task_def = detail.get("taskDefinition")
    awsvpc = (detail.get("networkConfiguration") or {}).get("awsvpcConfiguration") or {}
    subnets = awsvpc.get("subnets") or []
    if not task_def or not subnets:
        log.warning("run_migrations: service %s has no task def / networking; skipping", service)
        return {"ran": False, "ok": True, "error": None}

    container = _migrate_container(creds, region, task_def, migrate["node_id"])
    try:
        task_arn = aws_client.run_task(
            creds, region, cluster, task_def, container, migrate["command"],
            subnets, awsvpc.get("securityGroups") or [],
            awsvpc.get("assignPublicIp") or "DISABLED",
        )
    except Exception as exc:  # noqa: BLE001 — surfaced as a migration failure
        log.exception("run_migrations: could not start task for project %s", project.id)
        return {"ran": True, "ok": False, "error": f"Could not start the database migration: {exc}"}

    return _wait_migrate_task(creds, region, cluster, task_arn, task_def)


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

def _empty_undeletable_resources(creds: dict, region: str, stack_name: str) -> None:
    """CloudFormation refuses to delete a non-empty S3 bucket or ECR
    repository — found live: a real teardown hit DELETE_FAILED on both the
    frontend and build-archive buckets, requiring a manual `aws s3 rm
    --recursive` before the delete would go through. Empty every bucket/repo
    in the stack first so a single Provision-page "Delete infrastructure"
    click actually completes, instead of leaving the user with a half-deleted
    stack and a support ticket. Best-effort per-resource — one bucket/repo
    that fails to empty (e.g. already gone) shouldn't block emptying the
    rest, and delete_stack() below will still surface any real problem."""
    for resource in aws_client.list_stack_resources(creds, region, stack_name):
        try:
            if resource["resource_type"] == "AWS::S3::Bucket" and resource["physical_id"]:
                aws_client.empty_s3_bucket(creds, region, resource["physical_id"])
            elif resource["resource_type"] == "AWS::ECR::Repository" and resource["physical_id"]:
                aws_client.empty_ecr_repository(creds, region, resource["physical_id"])
        except ClientError:
            pass


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
    _empty_undeletable_resources(creds, region, stack_name)
    try:
        aws_client.delete_stack(creds, region, stack_name)
    except ClientError as exc:
        raise DeployError(f"AWS error deleting the stack: {exc.response['Error']['Message']}")

    deployment.status = Deployment.Status.DELETING
    deployment.save(update_fields=["status", "updated_at"])
    return {"status": deployment.status}


# ── Rebuild from scratch (user-confirmed) ────────────────────────────────────
#
# Some first-deploy failures can't be fixed on the live stack: the correction
# needs a stateful resource created with a different property (e.g. RDS DBName,
# settable only at creation), which CloudFormation can only apply by REPLACING
# the resource — exactly what _heal_live_stack's guarded update refuses, because
# a replace destroys data. When the stack has never gone live there IS no data to
# protect, so the honest fix is to tear it down and reprovision from a clean
# slate. Kept behind an explicit user action and HARD-GATED to never-been-live
# projects: this destroys every stateful resource and must never touch a stack
# that has served traffic.

_DELETE_TIMEOUT_SECONDS = 900
_DELETE_POLL_SECONDS = 12


def _has_been_live(project: Project) -> bool:
    """True once a project has ever reached a live/complete deploy — the point
    past which its stateful resources may hold real data."""
    return (project.status == Project.Status.LIVE
            or Deployment.objects.filter(project=project, status=Deployment.Status.COMPLETE).exists())


def can_recreate(project: Project) -> bool:
    """Whether 'rebuild from scratch' should be offered: a failed deploy on a
    project that has never gone live (so recreating stateful resources loses
    nothing)."""
    if _has_been_live(project):
        return False
    deployment = _active_deployment(project)
    return bool(deployment and deployment.status in (
        Deployment.Status.FAILED, Deployment.Status.BUILD_FAILED, Deployment.Status.ROLLED_BACK,
    ))


def _wait_stack_deleted(deployment: Deployment) -> None:
    """Block until the stack is actually gone — a fresh CreateStack with the same
    name fails while the old stack is still DELETE_IN_PROGRESS."""
    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)
    deadline = time.time() + _DELETE_TIMEOUT_SECONDS
    while time.time() < deadline:
        stack_status = aws_client.find_stack(creds, region, stack_name)
        if stack_status is None or stack_status == "DELETE_COMPLETE":
            return
        if stack_status.endswith("DELETE_FAILED"):
            raise DeployError("Teardown failed — the stack couldn't be deleted, so a rebuild can't proceed.")
        time.sleep(_DELETE_POLL_SECONDS)
    raise DeployError("Teardown is taking too long — the stack is still deleting; try the rebuild again shortly.")


def recreate(project: Project) -> dict[str, Any]:
    """User-confirmed 'rebuild from scratch': tear the stack down and reprovision
    from a clean slate, re-running the deterministic enforcers so the rebuild
    carries corrections the failed template lacked (e.g. RDS DBName). HARD-GATED
    to never-been-live projects — it destroys every stateful resource. Long-
    running (teardown + a full provision), so call it from a background task."""
    from . import iac
    if _has_been_live(project):
        raise DeployError(
            "Rebuild-from-scratch isn't available once a project has gone live — "
            "it would destroy the database and every other stateful resource."
        )
    deployment = _active_deployment(project) or _ready_deployment(project)
    if deployment is None or not deployment.cloudformation_template:
        raise DeployError("No infrastructure to rebuild.")

    # 1. Tear the old stack down and wait for it to actually disappear.
    if deployment.cloudformation_stack_id and deployment.status not in (
        Deployment.Status.DELETING, Deployment.Status.DELETED,
    ):
        teardown(project)
    _wait_stack_deleted(deployment)

    # 2. Re-run the deterministic enforcers so the rebuild carries the fixes the
    #    failed template lacked (e.g. RDS DBName), and mark it provision-ready.
    spec = iac._spec_for(deployment)
    deployment.cloudformation_template = iac._apply_enforcers(deployment.cloudformation_template, spec)
    deployment.status = Deployment.Status.IAC_READY
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    # 3. Reprovision from scratch through the normal supervised loop.
    start(project)
    return provision_with_feedback(project)


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


# CloudFormation's message when an ECS service never reaches steady state names
# the service and nothing else — never the reason, which lives in the stopped
# task, the container's exit code, or the load balancer's health check.
_ECS_STABILIZATION_RE = re.compile(r"did not stabilize|failed to stabilize", re.I)


def _enriched_root_cause(deployment: Deployment, root_cause: str | None) -> str | None:
    """Append the runtime reason to a CFN failure that has none of its own, so the
    correction round feeds `iac.refine()` the container's actual error rather
    than "the service did not stabilize". Best-effort and narrowly gated: an
    ECS-stabilization failure is the only CFN error whose true cause is outside
    CloudFormation's own event stream, and probing costs an STS assume-role."""
    if not root_cause or not _ECS_STABILIZATION_RE.search(root_cause):
        return root_cause
    try:
        creds, region = _assume(deployment)
        stack_name = deployment.cloudformation_stack_name or _stack_name(deployment)
        services = _stack_ecs_services(creds, region, stack_name)
        diagnosis = runtime_probe.services_root_cause(creds, region, services)
    except Exception as exc:  # noqa: BLE001 — enrichment must never mask the real failure
        log.warning("could not enrich root cause for deployment %s (%s)", deployment.id, exc)
        return root_cause
    return f"{root_cause}\n\n{diagnosis}" if diagnosis else root_cause


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

_TERMINAL_STATUSES = (
    Deployment.Status.COMPLETE, Deployment.Status.FAILED, Deployment.Status.ROLLED_BACK,
    # BUILDING is "CFN-terminal," not "deployment-terminal" — it's the signal
    # that CFN's own lifecycle is done and provision_with_feedback should hand
    # off to build.build_with_feedback() next. _poll_to_terminal only watches
    # the CFN stack; it has no reason to keep polling CFN once this is reached.
    Deployment.Status.BUILDING,
)
_POLL_INTERVAL_SECONDS = 8
# 25 min per attempt. Was 15, which stranded real deploys (Defect M): the build
# handoff lives only in this supervisor (the BUILDING branch below), but a stack
# with a CloudFront distribution routinely takes 18-22 min to reach CREATE_COMPLETE.
# The old ceiling gave up mid-CREATE, this task returned, and when CFN later went
# live poll() flipped the deployment to BUILDING with nothing left to run the build —
# stuck at "building" forever. The ceiling must outlast a realistically slow (but
# healthy) create so the same task hands off to the build. Budget: two attempts plus
# one refine() round must still fit run_provision_task's soft_time_limit=3300s
# (app/tasks.py) — 2×1500 + ~120 ≈ 3120 < 3300, with margin. A genuinely stuck stack
# (image crash-loop) still ends via CFN's own failure, not this ceiling.
_POLL_TIMEOUT_SECONDS = 1500


def _poll_to_terminal(project: Project) -> dict[str, Any]:
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


_FREE_TIER_BACKUP_RE = re.compile(
    r"backup retention period exceeds the maximum available to free tier customers",
    re.I,
)
_BACKUP_RETENTION_LINE_RE = re.compile(r"(^\s*BackupRetentionPeriod:\s*)\d+\s*$", re.M)

# Found live: an AWS account can itself be free-tier-restricted regardless of
# what the user picked in Step 2 ("Paid account") — cfn_generator.py already
# forces both of these to free-tier-safe values when the user explicitly
# selects free-tier, but a paid-selected spec on a free-tier-restricted
# account hits both AWS rejections in turn, one bounded retry at a time,
# since CloudFormation only reports the first validation failure per attempt.
# Fixing both in one pass (whichever error surfaced first) spends the single
# retry this loop allows on curing the whole class of problem, not just the
# symptom that happened to be reported first.
_FREE_TIER_INSTANCE_CLASS_RE = re.compile(
    r"instance size isn.t available with free plan accounts",
    re.I,
)
_DB_INSTANCE_CLASS_LINE_RE = re.compile(r"(^\s*DBInstanceClass:\s*).+$", re.M)
_FREE_TIER_SAFE_DB_CLASS = "db.t3.micro"


def _deterministic_template_fix(deployment: Deployment, root_cause: str | None) -> bool:
    """Apply known safe transforms for known free-tier-account AWS rejections.
    Returns True only when the template changed and was persisted. Unknown
    failures are deliberately not sent through an LLM retry loop; the real AWS
    reason is surfaced.

    Prefers the proactively-verified account type (AWSAccountConnection.
    verified_account_type, queried straight from AWS via freetier:
    GetAccountPlanState at connect time) over regex-sniffing the AWS error
    message — the regexes stay as a fallback for connections verified before
    this field existed (verified_account_type is null) or when the plan-type
    call itself failed."""
    if not deployment or not root_cause:
        return False
    connection = getattr(deployment, "aws_connection", None)
    verified_type = getattr(connection, "verified_account_type", None) if connection else None
    if verified_type is not None:
        is_free_tier_account = verified_type == IntentRecord.AwsAccountType.FREE_TIER
        if not is_free_tier_account:
            return False
    elif not (_FREE_TIER_BACKUP_RE.search(root_cause) or _FREE_TIER_INSTANCE_CLASS_RE.search(root_cause)):
        return False
    template = deployment.cloudformation_template or ""
    fixed = _BACKUP_RETENTION_LINE_RE.sub(r"\g<1>1", template)
    fixed = _DB_INSTANCE_CLASS_LINE_RE.sub(rf"\g<1>{_FREE_TIER_SAFE_DB_CLASS}", fixed)
    if fixed != template:
        deployment.cloudformation_template = fixed
        deployment.save(update_fields=["cloudformation_template", "updated_at"])
        return True
    return False


# ── In-place stack update (the guarded alternative to teardown-and-recreate) ────
#
# start() can only create (or delete-then-create) a stack — so once a stack is live,
# a template change meant a full teardown, which destroys the database. That is also
# why the feedback loop could never fix a live-but-broken app: there was no way to
# apply a corrected template without wiping the data. update_live_stack closes that
# gap through a CloudFormation change set, which is a dry run: it reports whether any
# resource would be REPLACED (destroyed and recreated) before anything is applied. We
# refuse outright any change that would replace or remove a stateful resource, so an
# in-place update can never silently drop a database, cache, or bucket.

# Resources that hold data — replacing or removing one loses it, so an update that
# would do so is refused rather than applied.
_STATEFUL_RESOURCE_TYPES = frozenset({
    "AWS::RDS::DBInstance", "AWS::RDS::DBCluster",
    "AWS::ElastiCache::ReplicationGroup", "AWS::ElastiCache::CacheCluster",
    "AWS::EFS::FileSystem", "AWS::S3::Bucket",
})
_CHANGE_SET_TIMEOUT_SECONDS = 120
_CHANGE_SET_POLL_SECONDS = 4
# CloudFormation's own phrase for "the template is identical to the live stack".
_EMPTY_CHANGE_SET_REASONS = ("didn't contain changes", "No updates are to be performed")


def _unsafe_changes(changes: list[dict]) -> list[dict]:
    """The changes that would destroy data: a stateful resource being replaced
    (Replacement True/Conditional) or removed."""
    unsafe = []
    for change in changes:
        if change.get("resource_type") not in _STATEFUL_RESOURCE_TYPES:
            continue
        if change.get("action") == "Remove" or change.get("replacement") in ("True", "Conditional"):
            unsafe.append(change)
    return unsafe


def _wait_change_set(creds: dict, region: str, change_set_id: str) -> dict:
    """Poll a change set until CloudFormation finishes computing it (CREATE_COMPLETE)
    or gives up (FAILED — which also covers the empty-change-set case)."""
    elapsed = 0
    info: dict = {}
    while elapsed < _CHANGE_SET_TIMEOUT_SECONDS:
        info = aws_client.describe_change_set(creds, region, change_set_id)
        if info.get("status") in ("CREATE_COMPLETE", "FAILED"):
            return info
        time.sleep(_CHANGE_SET_POLL_SECONDS)
        elapsed += _CHANGE_SET_POLL_SECONDS
    return info or {"status": "FAILED", "status_reason": "change set timed out", "changes": []}


def _apply_stack_update(creds: dict, region: str, stack_name: str, template: str) -> dict[str, Any]:
    """Create a change set against a live stack, refuse it if it would destroy a
    stateful resource, otherwise execute it. Returns
    ``{applied: bool, empty: bool, reason: str|None}`` — ``empty`` means the template
    already matches the live stack, ``reason`` explains a refusal or CFN error."""
    change_set_name = f"clyro-update-{int(time.time())}"
    change_set_id = aws_client.create_change_set(creds, region, stack_name, template, change_set_name)
    info = _wait_change_set(creds, region, change_set_id)

    if info.get("status") == "FAILED":
        reason = info.get("status_reason") or ""
        aws_client.delete_change_set(creds, region, change_set_id)
        if any(phrase in reason for phrase in _EMPTY_CHANGE_SET_REASONS):
            return {"applied": False, "empty": True, "reason": None}
        return {"applied": False, "empty": False, "reason": reason or "the change set could not be computed"}

    unsafe = _unsafe_changes(info.get("changes") or [])
    if unsafe:
        aws_client.delete_change_set(creds, region, change_set_id)
        detail = ", ".join(f"{c['logical_id']} ({c['resource_type']})" for c in unsafe)
        return {"applied": False, "empty": False, "reason": (
            f"this change would replace or delete stateful resource(s) {detail}, which would "
            "destroy their data. Refusing the in-place update — tear down and re-provision if "
            "this change is intended.")}

    aws_client.execute_change_set(creds, region, change_set_id)
    return {"applied": True, "empty": False, "reason": None}


def update_live_stack(project: Project) -> dict[str, Any]:
    """Apply the active deployment's current template to its LIVE stack in place via a
    guarded change set (see _apply_stack_update). Sets the deployment back to
    IN_PROGRESS when an update is actually executed so the normal poll path tracks it
    to UPDATE_COMPLETE. Returns _apply_stack_update's ``{applied, empty, reason}``."""
    deployment = _active_deployment(project)
    if deployment is None or not deployment.cloudformation_stack_name:
        raise DeployError("No live stack to update.")
    creds, region = _assume(deployment)
    stack_name = deployment.cloudformation_stack_name
    if not cfn_events.is_live(aws_client.find_stack(creds, region, stack_name)):
        raise DeployError("The stack isn't in a state that can be updated in place.")

    result = _apply_stack_update(creds, region, stack_name, deployment.cloudformation_template)
    if result["applied"]:
        deployment.status = Deployment.Status.IN_PROGRESS
        deployment.save(update_fields=["status", "updated_at"])
    return result


def provision_with_feedback(project: Project) -> dict[str, Any]:
    """Assumes `start()` has already been submitted (the view does this
    synchronously — it's a fast precondition-checked CreateStack call, not the
    slow part). Poll to a terminal state, and — on a real deploy failure — make
    ONE bounded attempt to self-correct from the actual AWS error before
    handing control back to the user. Once CFN itself is live, hand off to the
    build step (build.build_with_feedback) — a CREATE_COMPLETE stack with no
    application code in it isn't actually done from the user's perspective.
    Returns the final `poll()`-shaped dict."""
    from . import build, iac

    result = _poll_to_terminal(project)

    if result["status"] in (Deployment.Status.FAILED, Deployment.Status.ROLLED_BACK):
        deployment = _active_deployment(project)
        root_cause = (deployment and _root_failure(deployment)) or result.get("error")
        if deployment:
            root_cause = _enriched_root_cause(deployment, root_cause)
        if deployment and root_cause and _deterministic_template_fix(deployment, root_cause):
            validate_result = iac.validate(project, deployment.cloudformation_template)
            if validate_result["status"] != Deployment.Status.IAC_READY:
                return result
            # start() itself now retries the rolled-back-stack delete/recreate
            # race internally (see its own docstring) — no need to duplicate
            # that here.
            start(project)
            result = _poll_to_terminal(project)

    if result["status"] == Deployment.Status.BUILDING:
        # Not a CFN-error-correction problem (a broken Dockerfile/build command
        # isn't something iac.refine() can fix) — build.build_with_feedback
        # handles its own failure path and does not call back into this
        # function or retry CFN.
        # build_with_feedback also scales the cold-started services up to the spec's
        # task count once the image exists — see its own comment for why it owns that.
        result = build.build_with_feedback(project)
        # The stack is already CREATE_COMPLETE, so start()'s delete-and-recreate path
        # can't run without destroying the database. If the app failed to come up for a
        # reason a template change could fix, refine and apply it via a guarded in-place
        # update (which refuses anything that would replace a stateful resource), then
        # rebuild once. This is the one place the feedback loop can correct a *live*
        # stack rather than only one CFN rejects outright.
        if result["status"] == Deployment.Status.FAILED:
            result = _heal_live_stack(project, result)

    return result


def _heal_live_stack(project: Project, result: dict[str, Any]) -> dict[str, Any]:
    """One bounded self-heal attempt for a live stack whose app didn't come up:
    refine the template from the failure, apply it via a guarded in-place update, and
    rebuild. Any step that can't proceed safely returns the original failure
    unchanged (optionally annotated) — this never makes things worse."""
    from . import build, iac

    root_cause = result.get("error")
    active = _active_deployment(project)
    if not root_cause or active is None or not active.cloudformation_stack_name:
        return result

    try:
        refined = iac.refine(project, _correction_instruction(root_cause),
                             template=active.cloudformation_template)
    except iac.IacError:
        return result
    new_template = refined.get("template")
    if not new_template or not (refined.get("validation") or {}).get("is_valid"):
        return result
    if any(f.get("severity") == "blocker" for f in refined.get("security_findings") or []):
        return result

    # refine()/ensure_deployment may persist to a different in-flight row; write the
    # corrected template onto the LIVE stack's own deployment so the guarded update
    # reads exactly what it will apply.
    active.cloudformation_template = new_template
    active.save(update_fields=["cloudformation_template", "updated_at"])

    try:
        update = update_live_stack(project)
    except DeployError as exc:
        return {**result, "error": f"{root_cause}\n\nGenerated a fix but couldn't apply it: {exc}"}
    if not update.get("applied"):
        if update.get("reason"):
            return {**result, "error": f"{root_cause}\n\nGenerated a fix but did not apply it — {update['reason']}"}
        return result  # empty change set — the fix changed nothing; keep the original error

    healed = _poll_to_terminal(project)
    if healed["status"] == Deployment.Status.BUILDING:
        healed = build.build_with_feedback(project)
    return healed
