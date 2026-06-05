"""Parse / serialize ``canvas.yml`` and apply the 5 bounded canvas operations.

The Layout agent and the backend stub both go through these functions so the
canvas mutation logic and the persisted ``CanvasVersion`` shape never diverge.
All operations are pure: they return a *new* canvas, never mutate in place.
"""

from __future__ import annotations

import copy
from typing import Any

import yaml

from . import constraints
from .types import Canvas, ChangeRecord, CostEstimate, Node, Operation, Positions, Version

# Canonical node-key order for stable YAML output.
_NODE_KEY_ORDER = ("id", "label", "type", "aws_service", "image", "port")
_CONN_KEY_ORDER = ("from", "to", "label")


class CanvasOpError(ValueError):
    """Raised when an operation is structurally invalid (bad ids, bad enum)."""


def parse_canvas(text: str) -> Canvas:
    """Parse a ``canvas.yml`` string into a canvas dict."""
    data = yaml.safe_load(text) or {}
    data.setdefault("nodes", [])
    data.setdefault("connections", [])
    return data


def dump_canvas(canvas: Canvas) -> str:
    """Serialize a canvas dict back to ``canvas.yml`` with stable key order."""
    ordered = {
        "version": canvas.get("version", 1),
        "project": canvas.get("project", ""),
        "nodes": [_ordered(n, _NODE_KEY_ORDER) for n in canvas.get("nodes", [])],
        "connections": [_ordered(c, _CONN_KEY_ORDER) for c in canvas.get("connections", [])],
    }
    return yaml.safe_dump(ordered, sort_keys=False, default_flow_style=False)


def _ordered(item: dict[str, Any], key_order: tuple[str, ...]) -> dict[str, Any]:
    out = {k: item[k] for k in key_order if k in item}
    for k, v in item.items():  # keep any extra keys, after the known ones
        if k not in out:
            out[k] = v
    return out


def node_by_id(canvas: Canvas, node_id: str | None) -> Node | None:
    for node in canvas.get("nodes", []):
        if node.get("id") == node_id:
            return node
    return None


def validate_canvas(canvas: Canvas) -> list[str]:
    """Return a list of validation errors (empty = valid)."""
    errors: list[str] = []
    seen: set[str] = set()
    for node in canvas.get("nodes", []):
        nid = node.get("id")
        if not nid:
            errors.append("A node is missing an id.")
            continue
        if nid in seen:
            errors.append(f"Duplicate node id '{nid}'.")
        seen.add(nid)
        ntype = node.get("type")
        if ntype not in constraints.NODE_TYPES:
            errors.append(f"Node '{nid}' has unsupported type '{ntype}'.")
            continue
        allowed = constraints.ALLOWED_AWS_SERVICES.get(ntype, ())
        if node.get("aws_service") not in allowed:
            errors.append(
                f"Node '{nid}' ({ntype}) has invalid aws_service "
                f"'{node.get('aws_service')}'. Allowed: {', '.join(allowed)}."
            )
    for conn in canvas.get("connections", []):
        if node_by_id(canvas, conn.get("from")) is None:
            errors.append(f"Connection from unknown node '{conn.get('from')}'.")
        if node_by_id(canvas, conn.get("to")) is None:
            errors.append(f"Connection to unknown node '{conn.get('to')}'.")
    return errors


def apply_operation(canvas: Canvas, operation: Operation) -> tuple[Canvas, ChangeRecord]:
    """Apply one bounded operation, returning ``(new_canvas, change_record)``.

    Enforces hard constraints first (raises ``CanvasOpError`` on violation), then
    applies the change to a deep copy. ``change_record`` carries the fields the
    backend persists onto ``CanvasVersion``::

        {"operation": "UPDATE_NODE", "changed_node_id": "db",
         "previous_value": {"aws_service": "rds_postgres"},
         "new_value": {"aws_service": "aurora_postgres"}}
    """

    result = constraints.check_operation(canvas, operation)
    if not result.ok:
        raise CanvasOpError(result.reason)

    op = operation["op"]
    params = operation.get("params") or {}
    new_canvas = copy.deepcopy(canvas)

    if op == "ADD_NODE":
        node = copy.deepcopy(params.get("node") or operation.get("node") or {})
        new_canvas["nodes"].append(node)
        return new_canvas, {
            "operation": op,
            "changed_node_id": node["id"],
            "previous_value": None,
            "new_value": node,
        }

    if op == "REMOVE_NODE":
        target = operation["target_node"]
        removed = node_by_id(new_canvas, target)
        new_canvas["nodes"] = [n for n in new_canvas["nodes"] if n.get("id") != target]
        new_canvas["connections"] = [
            c for c in new_canvas["connections"]
            if c.get("from") != target and c.get("to") != target
        ]
        return new_canvas, {
            "operation": op,
            "changed_node_id": target,
            "previous_value": removed,
            "new_value": None,
        }

    if op == "UPDATE_NODE":
        target = operation["target_node"]
        node = node_by_id(new_canvas, target)
        if node is None:
            raise CanvasOpError(f"No node '{target}' to update.")
        previous = {"aws_service": node.get("aws_service")}
        new_service = params.get("aws_service")
        node["aws_service"] = new_service
        return new_canvas, {
            "operation": op,
            "changed_node_id": target,
            "previous_value": previous,
            "new_value": {"aws_service": new_service},
        }

    if op == "ADD_CONNECTION":
        conn = {"from": params["from"], "to": params["to"], "label": params.get("label", "")}
        new_canvas["connections"].append(conn)
        return new_canvas, {
            "operation": op,
            "changed_node_id": None,
            "previous_value": None,
            "new_value": conn,
        }

    if op == "REMOVE_CONNECTION":
        frm, to = params["from"], params["to"]
        removed = next(
            (c for c in new_canvas["connections"] if c.get("from") == frm and c.get("to") == to),
            None,
        )
        new_canvas["connections"] = [
            c for c in new_canvas["connections"]
            if not (c.get("from") == frm and c.get("to") == to)
        ]
        return new_canvas, {
            "operation": op,
            "changed_node_id": None,
            "previous_value": removed,
            "new_value": None,
        }

    raise CanvasOpError(f"Unhandled operation '{op}'.")


def build_canvas_snapshot(canvas: Canvas, positions: Positions, cost: CostEstimate) -> dict[str, Any]:
    """The JSON stored in ``CanvasVersion.canvas_snapshot`` — canonical canvas
    plus the spatial layout and the cost estimate that produced this version."""
    return {
        "nodes": canvas.get("nodes", []),
        "connections": canvas.get("connections", []),
        "positions": positions,
        "cost": cost,
    }


def build_version(
    version_number: int,
    canvas: Canvas,
    positions: Positions,
    cost: CostEstimate,
    change_record: ChangeRecord | None = None,
    status: str = "draft",
) -> Version:
    """Assemble a dict aligned to the Django ``CanvasVersion`` fields. The
    backend adds the project / intent FKs and timestamps."""
    change_record = change_record or {}
    return {
        "version_number": version_number,
        "status": status,
        "canvas_yaml": dump_canvas(canvas),
        "canvas_snapshot": build_canvas_snapshot(canvas, positions, cost),
        "operation": change_record.get("operation"),
        "changed_node_id": change_record.get("changed_node_id"),
        "previous_value": change_record.get("previous_value"),
        "new_value": change_record.get("new_value"),
        "estimated_cost": cost,
    }
