"""Compose the initial ``canvas.yml`` (nodes + connections) from the Step 1
detected-resources record and the Step 2 intent record.

This is the deterministic bridge between Steps 1/2 and Step 3: the model detects
*what* exists (a strict ``detected_resources`` JSON) and the user picks compute /
database choices (the intent record); this module maps those two structured
records into the canonical ``nodes``/``connections`` canvas the Step 3 engine
operates on. No LLM authors the canvas YAML — it is built here, so the canvas
schema is owned in one place (design principle #5: deterministic where possible).

The output reproduces the canonical design-doc canvas for the reference
``invoiceapp`` inputs (six nodes, ~$127/mo), which has no detected object storage.
When Step 1 detection *does* find S3 usage (``infrastructure.storage.detected``),
a dedicated ``storage`` node is added here so the user can see and price it on
the canvas — before this, the AWS_S3_BUCKET_NAME wiring silently worked via
``cfn_generator``'s env-var detection alone, with no corresponding canvas node.
"""

from __future__ import annotations

from typing import Any

from . import canvas_ops
from .types import Canvas

# Default aws_service per node when the intent record doesn't pin a choice.
_DEFAULT_COMPUTE = "ecs_fargate"
_DEFAULT_DATABASE = "rds_postgres"

# Pretty labels derived from the detected framework / engine, with fallbacks.
_FRAMEWORK_LABELS = {"django": "Django", "react": "React"}
_ENGINE_LABELS = {"postgres": "PostgreSQL", "redis": "Redis"}
_WORKER_LABELS = {"celery": "Celery Worker"}


def _detected(section: dict, key: str) -> dict:
    """Return ``section[key]`` if it's a dict flagged ``detected``, else ``{}``."""
    item = (section or {}).get(key) or {}
    return item if isinstance(item, dict) and item.get("detected") else {}


def _titleize(value: str | None, mapping: dict[str, str], suffix: str) -> str:
    if not value:
        return suffix.strip()
    return mapping.get(value, f"{value.title()} {suffix}".strip())


def build_canvas_from_detection(detected: dict[str, Any], intent: dict[str, Any]) -> Canvas:
    """Map a Step 1 ``detected_resources`` record + Step 2 ``intent`` into a
    canvas dict (``{version, project, nodes, connections}``).

    ``intent`` is read for the user's service choices: ``compute_choice``
    (backend), ``worker_compute_choice`` (worker), ``database_choice`` (db).
    Missing choices fall back to the AWS defaults.
    """
    detected = detected or {}
    intent = intent or {}
    services = detected.get("services") or {}
    infra = detected.get("infrastructure") or {}

    backend = _detected(services, "backend")
    frontend = _detected(services, "frontend")
    worker = _detected(services, "worker")
    database = _detected(infra, "database")
    cache = _detected(infra, "cache")
    queue = _detected(infra, "queue")
    storage = _detected(infra, "storage")

    # The real broker choice, when the detection contract reports one (added
    # alongside the deterministic RepoRecon detector) — a Celery worker alone
    # does not imply SQS; Redis is just as valid a broker and is already
    # represented by the `cache` node. Falls back to the bare `queue.detected`
    # flag for specs from before this field existed.
    worker_broker = worker.get("broker") if worker else None
    if worker_broker == "redis":
        queue = {}

    nodes: list[dict[str, Any]] = []

    # Backend is mandatory (the scanner hard-blocks without it); still guard.
    if backend:
        nodes.append({
            "id": "backend",
            "label": _titleize(backend.get("framework"), _FRAMEWORK_LABELS, "Backend"),
            "type": "service",
            "aws_service": intent.get("compute_choice") or _DEFAULT_COMPUTE,
            "image": "ecr",
            "port": 8000,
            "path": backend.get("path") or ".",
            "dockerfile_generated": bool(backend.get("dockerfile_generated")),
        })
    if frontend:
        nodes.append({
            "id": "frontend",
            "label": _titleize(frontend.get("framework"), _FRAMEWORK_LABELS, "Frontend"),
            "type": "static",
            "aws_service": "s3_cloudfront",
            "path": frontend.get("path") or ".",
        })
    if database:
        nodes.append({
            "id": "db",
            "label": _ENGINE_LABELS.get(database.get("engine"), "Database"),
            "type": "database",
            "aws_service": intent.get("database_choice") or _DEFAULT_DATABASE,
        })
    if cache:
        nodes.append({
            "id": "cache",
            "label": _ENGINE_LABELS.get(cache.get("engine"), "Cache"),
            "type": "cache",
            "aws_service": "elasticache",
        })
    if worker:
        # RepoRecon's schema has no `path` on `worker` — a Celery worker is
        # essentially always co-located with the Django backend in the patterns
        # this scanner targets, so reuse the backend's build path/Dockerfile
        # rather than extending RepoRecon's detection contract for this.
        nodes.append({
            "id": "worker",
            "label": _WORKER_LABELS.get(worker.get("type"), "Worker"),
            "type": "worker",
            "aws_service": intent.get("worker_compute_choice") or _DEFAULT_COMPUTE,
            "image": "ecr",
            "path": backend.get("path") or ".",
            "dockerfile_generated": bool(backend.get("dockerfile_generated")),
        })
    if queue:
        nodes.append({
            "id": "queue",
            "label": "Task Queue",
            "type": "queue",
            "aws_service": "sqs",
        })
    if storage:
        nodes.append({
            "id": "storage",
            "label": "App Storage",
            "type": "storage",
            "aws_service": "s3",
        })

    # Detected nodes map to real services found in the codebase, so they are
    # locked: the user can change a node's service type but not remove a node the
    # scan derived from their code (enforced in constraints.check_operation).
    for node in nodes:
        node["locked"] = True

    present = {n["id"] for n in nodes}

    # Edges, emitted only when both endpoints exist. worker→db / worker→cache are
    # the design §10 "worker networking correct from the start" edges.
    candidate_edges = [
        ("frontend", "backend", "REST API"),
        ("backend", "db", "reads/writes"),
        ("backend", "cache", "caching"),
        ("backend", "worker", "async tasks"),
        ("worker", "queue", "consumes"),
        ("worker", "db", "reads/writes"),
        ("worker", "cache", "caching"),
        ("backend", "storage", "reads/writes"),
    ]
    connections = [
        {"from": frm, "to": to, "label": label}
        for frm, to, label in candidate_edges
        if frm in present and to in present
    ]

    project_name = (backend.get("project_name") or "").strip()
    canvas: Canvas = {
        "version": 1,
        "project": project_name,
        "nodes": nodes,
        "connections": connections,
    }
    return canvas


def build_and_validate(detected: dict[str, Any], intent: dict[str, Any]) -> tuple[Canvas, list[str]]:
    """Build the canvas and run ``validate_canvas`` on it (defensive — ids/types/
    services are constructed to conform, so errors indicate a detection-record
    shape we didn't expect). Returns ``(canvas, errors)``."""
    canvas = build_canvas_from_detection(detected, intent)
    return canvas, canvas_ops.validate_canvas(canvas)
