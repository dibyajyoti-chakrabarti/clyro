"""Transform a persisted ``CanvasVersion`` into the shape the frontend renders.

The React ``StepThreePanel`` expects nodes as ``{id, label, type, aws}`` (note the
short ``aws`` key), connections as ``{from, to, label}``, a ``cost`` list of
``{label, monthly}``, and a ``positions`` map ``{id: {x, y}}``. The canonical
canvas uses ``aws_service``; we map it here so the model never changes.
"""

from __future__ import annotations

from typing import Any


def _node_to_frontend(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "label": node.get("label"),
        "type": node.get("type"),
        "aws": node.get("aws_service"),
    }


def serialize_version(version) -> dict[str, Any]:
    snapshot = version.canvas_snapshot or {}
    cost = version.estimated_cost or {}
    nodes = [_node_to_frontend(n) for n in snapshot.get("nodes", [])]
    connections = [
        {"from": c.get("from"), "to": c.get("to"), "label": c.get("label", "")}
        for c in snapshot.get("connections", [])
    ]
    cost_items = [
        {"label": i.get("label"), "monthly": i.get("monthly")}
        for i in cost.get("line_items", [])
    ]
    return {
        "project_id": str(version.project_id),
        "version": version.version_number,
        "status": version.status,
        "operation": version.operation,
        "canvas": {"nodes": nodes, "connections": connections, "cost": cost_items},
        "positions": snapshot.get("positions", {}),
        "cost_total": cost.get("total", 0),
        "assumptions": cost.get("assumptions", []),
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }


def serialize_version_summary(version) -> dict[str, Any]:
    """Lightweight entry for the version-history list."""
    cost = version.estimated_cost or {}
    return {
        "version": version.version_number,
        "status": version.status,
        "operation": version.operation,
        "changed_node_id": version.changed_node_id,
        "previous_value": version.previous_value,
        "new_value": version.new_value,
        "cost_total": cost.get("total", 0),
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }
