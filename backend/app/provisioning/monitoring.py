"""Step 7 history — snapshot collection and uptime aggregation.

The dashboard's live poll only answers "how is it right now, while someone is
watching". A beat task calls ``deploy.health()`` for every live project once a
minute and persists the result as a ``HealthSnapshot``, which is what uptime
percentages and the 24h status strip are computed from. Snapshots are pruned
after ``SNAPSHOT_RETENTION_DAYS``.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.utils import timezone

from core.models import HealthSnapshot, Project

from . import deploy

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
