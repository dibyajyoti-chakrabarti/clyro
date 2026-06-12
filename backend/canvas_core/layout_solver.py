"""Collision-free spatial layout for the canvas.

The Layout agent owns *where* nodes sit. Placement is a deterministic left-to-right
flow by node type (static -> service -> data/worker -> queue/storage), stacking
rows within each column. Existing positions are preserved; only unplaced nodes
get new collision-free slots. Coordinates are top-left corners in pixels and line
up with the SVG arrow math in the frontend (`pos.x + 88`, `pos.y + 56`, etc.).
"""

from __future__ import annotations

from .types import Canvas, Node, Positions, RoutedEdge

# Card geometry (matches the frontend: w-44 = 176px wide cards).
NODE_WIDTH = 176
NODE_HEIGHT = 64
COL_GAP = 280
ROW_GAP = 130
ORIGIN_X = 40
ORIGIN_Y = 60

# Column index per node type — the architecture's left-to-right data flow.
COLUMN_BY_TYPE: dict[str, int] = {
    "static": 0,
    "service": 1,
    "database": 2,
    "cache": 2,
    "worker": 2,
    "queue": 3,
    "storage": 3,
}
_DEFAULT_COLUMN = 2


def _column(node: Node) -> int:
    return COLUMN_BY_TYPE.get(node.get("type", ""), _DEFAULT_COLUMN)


def _col_x(col: int) -> int:
    return ORIGIN_X + col * COL_GAP


def compute_positions(canvas: Canvas, existing: Positions | None = None) -> Positions:
    """Return ``{node_id: {"x": int, "y": int}}`` for every node.

    Nodes already in ``existing`` keep their coordinates; new nodes are placed in
    the next free row of their column without overlapping anything.
    """
    existing = existing or {}
    positions: Positions = {}

    # Track the next free row-y per column, seeded from any preserved positions.
    next_y: dict[int, int] = {}

    nodes = canvas.get("nodes", [])
    node_ids = {n["id"] for n in nodes}

    # 1) Preserve existing positions for nodes still present.
    for node in nodes:
        nid = node["id"]
        if nid in existing:
            positions[nid] = {"x": existing[nid]["x"], "y": existing[nid]["y"]}
            col = _column(node)
            next_y[col] = max(next_y.get(col, ORIGIN_Y), existing[nid]["y"] + ROW_GAP)

    # 2) Place unplaced nodes column by column, deterministically.
    for node in nodes:
        nid = node["id"]
        if nid in positions:
            continue
        col = _column(node)
        y = next_y.get(col, ORIGIN_Y)
        y = _avoid_overlap(positions, _col_x(col), y)
        positions[nid] = {"x": _col_x(col), "y": y}
        next_y[col] = y + ROW_GAP

    # Drop positions for nodes that no longer exist.
    return {nid: pos for nid, pos in positions.items() if nid in node_ids}


def _avoid_overlap(positions: Positions, x: int, y: int) -> int:
    """Nudge ``y`` down until (x, y) doesn't overlap an existing card."""
    changed = True
    while changed:
        changed = False
        for pos in positions.values():
            if pos["x"] == x and abs(pos["y"] - y) < NODE_HEIGHT + 20:
                y = pos["y"] + ROW_GAP
                changed = True
    return y


def route_connections(canvas: Canvas, positions: Positions) -> list[RoutedEdge]:
    """Compute arrow endpoints for each connection (re-routed from positions).

    The frontend recomputes its own SVG geometry, but the Layout agent returns
    this so callers that don't render in React still get routed edges.
    """
    routed: list[RoutedEdge] = []
    for conn in canvas.get("connections", []):
        frm = positions.get(conn.get("from"))
        to = positions.get(conn.get("to"))
        if not frm or not to:
            continue
        routed.append({
            "from": conn["from"],
            "to": conn["to"],
            "label": conn.get("label", ""),
            "x1": frm["x"] + NODE_WIDTH // 2,
            "y1": frm["y"] + NODE_HEIGHT,
            "x2": to["x"] + NODE_WIDTH // 2,
            "y2": to["y"],
        })
    return routed


def place_new_node(canvas: Canvas, node_id: str, existing: Positions) -> Positions:
    """Convenience: positions for the whole canvas with ``node_id`` newly placed
    near its column neighbours, returning the full position map."""
    return compute_positions(canvas, existing)
