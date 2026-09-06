"""Why is the customer's app not running, given that CloudFormation says every
resource exists?

CloudFormation answers a narrower question than users think it does. A stack
reaches CREATE_COMPLETE when its resources have been *created*, not when the
software inside them works. Found live: a stack went CREATE_COMPLETE, both ECS
services scaled to their task count, Clyro reported the project LIVE — and the
backend was in an endless kill/replace loop because Django rejected every
request with 400 (ALLOWED_HOSTS was never injected, so the ALB health check
never passed). Nothing in the CFN event stream said a word about it.

This module reads the four places AWS actually records that kind of failure:

  * ECS stopped-task ``stoppedReason`` — why ECS killed the task
  * the container's own ``exitCode``/``reason`` — why the process died
  * ALB target health — why the load balancer refuses to send it traffic
  * the container's CloudWatch log tail — the traceback, when there is one

and folds them into one human-readable root cause. Every probe is best-effort:
a diagnosis is strictly better than no diagnosis, so a permissions gap or a
missing log group degrades the message rather than raising.
"""

from __future__ import annotations

import logging

from . import aws_client

log = logging.getLogger(__name__)

# Enough lines to carry a Python traceback, few enough to stay readable in a
# deployment error surfaced in the browser.
_LOG_TAIL_LINES = 12
_HEALTHY = "healthy"


def _dedupe(lines: list[str]) -> list[str]:
    """A crash-looping service reports the same stoppedReason on every replaced
    task; the reason is worth stating once."""
    return list(dict.fromkeys(line for line in lines if line))


def _stopped_task_reasons(credentials: dict, region: str, cluster: str, service: str) -> list[str]:
    try:
        tasks = aws_client.describe_stopped_tasks(credentials, region, cluster, service)
    except Exception as exc:  # noqa: BLE001 — best-effort probe
        log.warning("runtime_probe: describe_stopped_tasks failed for %s (%s)", service, exc)
        return []

    lines = []
    for task in tasks:
        stopped_reason = task.get("stoppedReason")
        if stopped_reason:
            lines.append(f"ECS stopped the task: {stopped_reason}")
        for container in task.get("containers") or []:
            name = container.get("name", "container")
            exit_code = container.get("exitCode")
            reason = container.get("reason")
            if exit_code not in (None, 0):
                suffix = f" ({reason})" if reason else ""
                lines.append(f"Container {name} exited with code {exit_code}{suffix}.")
            elif reason:
                lines.append(f"Container {name}: {reason}")
    return _dedupe(lines)


def _target_health_reasons(credentials: dict, region: str, service: dict) -> list[str]:
    lines = []
    for load_balancer in service.get("loadBalancers") or []:
        target_group_arn = load_balancer.get("targetGroupArn")
        if not target_group_arn:
            continue
        try:
            targets = aws_client.describe_target_health(credentials, region, target_group_arn)
        except Exception as exc:  # noqa: BLE001 — best-effort probe
            log.warning("runtime_probe: describe_target_health failed (%s)", exc)
            continue
        for target in targets:
            state = target.get("state") or ""
            # "draining" is a target on its way out during a replacement, not a
            # cause. Reporting it would blame the symptom of the real failure.
            if state in (_HEALTHY, "draining", ""):
                continue
            description = target.get("description") or ""
            reason = target.get("reason") or ""
            detail = f": {description}" if description else ""
            qualifier = f" ({reason})" if reason else ""
            lines.append(
                f"The load balancer marks this service's target {state}{qualifier}{detail}"
            )
    return _dedupe(lines)


def _log_tail(credentials: dict, region: str, service: dict) -> list[str]:
    task_definition = service.get("taskDefinition")
    if not task_definition:
        return []
    try:
        groups = aws_client.task_definition_log_groups(credentials, region, task_definition)
    except Exception as exc:  # noqa: BLE001 — best-effort probe
        log.warning("runtime_probe: task_definition_log_groups failed (%s)", exc)
        return []

    lines = []
    for group in groups:
        tail = aws_client.tail_log_group(credentials, region, group, limit=_LOG_TAIL_LINES)
        lines.extend(tail)
    return lines


def service_root_cause(credentials: dict, region: str, cluster: str, service_name: str) -> str | None:
    """One paragraph explaining why ``service_name`` is not serving, or None when
    every probe comes back clean (the service looks fine and the caller's own
    reason for asking lies elsewhere)."""
    try:
        service = aws_client.describe_ecs_service(credentials, region, cluster, service_name)
    except Exception as exc:  # noqa: BLE001 — best-effort probe
        log.warning("runtime_probe: describe_ecs_service failed for %s (%s)", service_name, exc)
        return None
    if not service:
        return None

    # Ordered most-specific first: ECS's own kill reason beats the load
    # balancer's opinion, which beats whatever the app happened to log last.
    reasons = (
        _stopped_task_reasons(credentials, region, cluster, service_name)
        + _target_health_reasons(credentials, region, service)
    )
    if not reasons:
        return None

    report = f"{service_name}: " + " ".join(reasons)
    tail = _log_tail(credentials, region, service)
    if tail:
        report += "\n\nLast log lines from the container:\n" + "\n".join(f"  {line}" for line in tail)
    return report


def services_root_cause(credentials: dict, region: str, services: list[tuple[str, str]]) -> str | None:
    """``service_root_cause`` across several ``(cluster, service)`` pairs, joined.
    Returns None when none of them can explain themselves."""
    reports = [
        report
        for cluster, service_name in services
        if (report := service_root_cause(credentials, region, cluster, service_name))
    ]
    return "\n\n".join(reports) if reports else None


def build_root_cause(credentials: dict, region: str, build_ids: list[str]) -> str | None:
    """Why a CodeBuild run failed: the phase that failed, its status reason, and
    the tail of that build's own log stream. Replaces the generic "check the
    CodeBuild logs for details" with the contents of those logs."""
    if not build_ids:
        return None
    try:
        builds = aws_client.batch_get_builds(credentials, region, build_ids)
    except Exception as exc:  # noqa: BLE001 — best-effort probe
        log.warning("runtime_probe: batch_get_builds failed (%s)", exc)
        return None

    reports = []
    for build in builds:
        if build.get("buildStatus") == "SUCCEEDED":
            continue
        name = build.get("projectName") or build.get("id", "build")
        lines = []
        for phase in build.get("phases") or []:
            if phase.get("phaseStatus") in (None, "SUCCEEDED"):
                continue
            contexts = [
                c.get("message", "").strip()
                for c in phase.get("contexts") or []
                if c.get("message")
            ]
            detail = f": {'; '.join(contexts)}" if contexts else ""
            lines.append(f"phase {phase.get('phaseType')} {phase.get('phaseStatus')}{detail}")
        report = f"{name}: " + ("; ".join(lines) if lines else build.get("buildStatus", "failed"))

        group = (build.get("logs") or {}).get("groupName")
        if group:
            tail = aws_client.tail_log_group(credentials, region, group, limit=_LOG_TAIL_LINES)
            if tail:
                report += "\n\nLast log lines from the build:\n" + "\n".join(f"  {line}" for line in tail)
        reports.append(report)

    return "\n\n".join(reports) if reports else None
