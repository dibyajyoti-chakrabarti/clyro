"""Step 7 history — snapshot collection, uptime aggregation, and log archiving.

The dashboard's live poll only answers "how is it right now, while someone is
watching". Two beat tasks fill the gap: ``collect_snapshots`` persists a
``HealthSnapshot`` per live project once a minute (uptime % and the 24h status
strip come from these), and ``archive_logs`` copies each service's CloudWatch
log events into the stack's ``LogArchiveBucket`` as 5-minute JSONL slot objects
— the logs panel reads those for ranges beyond the last hour, since the
generated log groups only retain 14 days and long FilterLogEvents scans are
slow and expensive. Snapshots are pruned after ``SNAPSHOT_RETENTION_DAYS``;
archived log objects expire via the bucket's own 30-day lifecycle rule.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from botocore.exceptions import ClientError
from django.utils import timezone

from core.models import HealthSnapshot, Project

from . import aws_client, deploy

log = logging.getLogger(__name__)

SNAPSHOT_RETENTION_DAYS = 7

# 30-minute buckets over the last 24 hours for the status strip.
_STRIP_BUCKETS = 48
_STRIP_BUCKET = timedelta(minutes=30)


def collect_snapshots() -> dict[str, int]:
    """One sweep: snapshot every live project's health, then prune old rows.
    Failures are per-project — one broken AWS connection must not starve the
    others of their snapshot."""
    written = 0
    for project in Project.objects.filter(status=Project.Status.LIVE):
        try:
            data = deploy.health(project)
        except deploy.DeployError:
            continue  # no active deployment (e.g. mid-teardown) — nothing to record
        except Exception:
            log.exception("Health snapshot failed for project %s", project.pk)
            continue
        items = data.get("health_items") or []
        healthy = (
            data.get("stack_status") == "ok"
            and bool(items)
            and all(item.get("state") == "healthy" for item in items)
        )
        HealthSnapshot.objects.create(
            project=project,
            stack_status=data.get("stack_status", ""),
            healthy=healthy,
            health_items=items,
            metrics=data.get("metrics") or {},
            alerts=data.get("alerts") or [],
        )
        written += 1
    pruned, _ = HealthSnapshot.objects.filter(
        created_at__lt=timezone.now() - timedelta(days=SNAPSHOT_RETENTION_DAYS),
    ).delete()
    return {"written": written, "pruned": pruned}


_ARCHIVE_SLOT_MINUTES = 5
# How many recent slots each sweep re-checks — a worker outage shorter than
# slots x cadence self-heals without any checkpoint bookkeeping.
_ARCHIVE_CATCHUP_SLOTS = 3
# CloudWatch ingestion lags real time; only archive slots that ended this long ago.
_ARCHIVE_SETTLE_MINUTES = 5
_ARCHIVE_SLOT_EVENT_LIMIT = 2000


def _floor_to_slot(moment: datetime) -> datetime:
    return moment.replace(minute=moment.minute - moment.minute % _ARCHIVE_SLOT_MINUTES,
                          second=0, microsecond=0)


def archive_slot_key(service: str, slot_start: datetime) -> str:
    """Deterministic, chronologically-sortable object key for one service's
    5-minute slot: logs/{service}/{YYYY-MM-DD}/{HHMM}.jsonl (UTC)."""
    return f"logs/{service}/{slot_start:%Y-%m-%d}/{slot_start:%H%M}.jsonl"


def archive_logs() -> dict[str, int]:
    """One sweep: for every live project whose stack has a LogArchiveBucket,
    write each service's recent CloudWatch events into per-slot JSONL objects.
    Slot keys are deterministic, so re-runs and concurrent workers are
    idempotent; empty slots are written as empty objects to mark them done.
    Failures are per-project."""
    written = 0
    for project in Project.objects.filter(status=Project.Status.LIVE):
        try:
            written += _archive_project_logs(project)
        except deploy.DeployError:
            continue
        except Exception:
            log.exception("Log archive failed for project %s", project.pk)
    return {"written": written}


def _archive_project_logs(project: Project) -> int:
    deployment = deploy._active_deployment(project)
    if deployment is None:
        return 0
    creds, region = deploy._assume(deployment)
    stack_name = deployment.cloudformation_stack_name or deploy._stack_name(deployment)
    try:
        resources = aws_client.list_stack_resources(creds, region, stack_name)
    except ClientError:
        return 0
    bucket = next(
        (r["physical_id"] for r in resources
         if r["logical_id"] == "LogArchiveBucket" and r["physical_id"]),
        None,
    )
    if not bucket:
        return 0  # stack predates the archive bucket (or a refined template dropped it)
    services = deploy._ecs_services_from_resources(resources)

    slot_len = timedelta(minutes=_ARCHIVE_SLOT_MINUTES)
    newest = _floor_to_slot(timezone.now() - timedelta(minutes=_ARCHIVE_SETTLE_MINUTES) - slot_len)
    slots = [newest - i * slot_len for i in range(_ARCHIVE_CATCHUP_SLOTS)]

    written = 0
    for cluster, service in services:
        existing: set[str] = set()
        for prefix in {f"logs/{service}/{slot:%Y-%m-%d}/" for slot in slots}:
            existing.update(aws_client.list_s3_keys(creds, region, bucket, prefix))
        detail = aws_client.describe_ecs_service(creds, region, cluster, service)
        task_definition = detail.get("taskDefinition")
        groups = (
            aws_client.task_definition_log_groups(creds, region, task_definition)
            if task_definition else []
        )
        for slot in slots:
            key = archive_slot_key(service, slot)
            if key in existing:
                continue
            events: list[dict] = []
            for group in groups:
                events.extend(aws_client.filter_log_events(
                    creds, region, group,
                    int(slot.timestamp() * 1000),
                    end_time_ms=int((slot + slot_len).timestamp() * 1000),
                    limit=_ARCHIVE_SLOT_EVENT_LIMIT, max_pages=10))
            events.sort(key=lambda e: e["timestamp"] or 0)
            body = "\n".join(json.dumps(e) for e in events).encode()
            aws_client.put_object(creds, region, bucket, key, body)
            written += 1
    return written


# Reading caps for the archive fetch path: newest slots first, stop at the
# event limit or the object cap — honest truncation, never an unbounded scan.
# A search scans much deeper than a browse (finding a rare term is the point),
# so it gets its own cap: 288 slots = a full 24 hours of 5-minute objects.
_ARCHIVE_READ_MAX_OBJECTS = 60
_ARCHIVE_SEARCH_MAX_OBJECTS = 288
_ARCHIVE_FETCH_WORKERS = 16
_ERROR_MARKERS = ("ERROR", "Error", "CRITICAL", "FATAL", "Exception", "Traceback")


def read_archived_events(creds: dict, region: str, bucket: str, service: str,
                         hours: int, level: str = "all", query: str | None = None,
                         limit: int = 200, max_objects: int | None = None) -> tuple[list[dict], bool]:
    """The most recent ``limit`` events for one service from the S3 archive,
    oldest first, plus a truncated flag saying older slots in the range were
    left unread. ``query`` filters by case-insensitive substring. Slot keys sort
    chronologically, so listing per day-prefix and walking newest-first in
    parallel batches is enough. Raises AwsAccessDenied when the role lacks the
    S3 read grants."""
    from concurrent.futures import ThreadPoolExecutor

    if max_objects is None:
        max_objects = _ARCHIVE_SEARCH_MAX_OBJECTS if query else _ARCHIVE_READ_MAX_OBJECTS
    now = timezone.now()
    start = now - timedelta(hours=hours)
    start_key = archive_slot_key(service, _floor_to_slot(start))
    keys: list[str] = []
    day = start.date()
    while day <= now.date():
        prefix = f"logs/{service}/{day:%Y-%m-%d}/"
        keys.extend(
            key for key in aws_client.list_s3_keys(creds, region, bucket, prefix)
            if key >= start_key
        )
        day += timedelta(days=1)
    keys.sort()

    needle = query.lower() if query else None
    events: list[dict] = []
    read = 0
    pending = list(reversed(keys))  # newest slot first
    with ThreadPoolExecutor(max_workers=_ARCHIVE_FETCH_WORKERS) as pool:
        while pending and read < max_objects and len(events) < limit:
            batch = pending[:_ARCHIVE_FETCH_WORKERS]
            pending = pending[_ARCHIVE_FETCH_WORKERS:]
            bodies = list(pool.map(
                lambda key: aws_client.get_s3_object(creds, region, bucket, key), batch))
            read += len(batch)
            batch_events: list[dict] = []
            for body in reversed(bodies):  # oldest of the batch first
                if not body:
                    continue
                for line in body.decode(errors="replace").splitlines():
                    try:
                        event = json.loads(line)
                    except ValueError:
                        continue
                    message = event.get("message") or ""
                    if level == "error" and not any(m in message for m in _ERROR_MARKERS):
                        continue
                    if needle and needle not in message.lower():
                        continue
                    batch_events.append(event)
            events = batch_events + events  # prepend older batches to keep chronological order
    return events[-limit:], read < len(keys)


def history(project: Project) -> dict[str, Any]:
    """Uptime over the last 24h/7d plus a 48-bucket status strip of the last
    24 hours. A bucket is ``down`` if ANY snapshot in it was unhealthy, ``empty``
    if the collector wasn't running. Percentages are None until snapshots exist."""
    now = timezone.now()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    snaps = list(
        HealthSnapshot.objects.filter(project=project, created_at__gte=week_ago)
        .order_by("created_at")
        .values_list("created_at", "healthy")
    )

    def uptime(since):
        window = [healthy for created, healthy in snaps if created >= since]
        return round(100 * sum(window) / len(window), 2) if window else None

    strip = []
    for i in range(_STRIP_BUCKETS):
        start = day_ago + i * _STRIP_BUCKET
        end = start + _STRIP_BUCKET
        bucket = [healthy for created, healthy in snaps if start <= created < end]
        state = "empty" if not bucket else ("up" if all(bucket) else "down")
        strip.append({"t": start.isoformat(), "state": state})

    return {
        "uptime_24h": uptime(day_ago),
        "uptime_7d": uptime(week_ago),
        "strip": strip,
        "samples": len(snaps),
    }
