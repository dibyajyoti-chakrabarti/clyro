from __future__ import annotations

import json

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from canvas_core import canvas_ops, constraints, cost_engine, layout_solver

app = BedrockAgentCoreApp()
log = app.logger


@app.entrypoint
async def invoke(payload, context):
    """Constrained executor: apply one bounded canvas operation and return the
    updated canvas with collision-free positions and a refreshed cost estimate.

    Payload: {operation, canvas, intent, positions?}
    Returns: {outcome, canvas, positions, cost, change} or {outcome, reason}
    """
    log.info("Layout agent invoked")

    operation = payload.get("operation", {})
    canvas = payload.get("canvas", {})
    intent = payload.get("intent", {})
    existing_positions = payload.get("positions", {})

    check = constraints.check_operation(canvas, operation)
    if not check.ok:
        yield json.dumps({
            "outcome": "rejected",
            "reason": check.reason or "Constraint violation.",
        })
        return

    try:
        new_canvas, change = canvas_ops.apply_operation(canvas, operation)
    except canvas_ops.CanvasOpError as exc:
        yield json.dumps({"outcome": "rejected", "reason": str(exc)})
        return

    positions = layout_solver.compute_positions(new_canvas, existing=existing_positions)
    cost = cost_engine.estimate_cost(new_canvas, intent)

    yield json.dumps({
        "outcome": "applied",
        "canvas": new_canvas,
        "positions": positions,
        "cost": cost,
        "change": change,
    })


if __name__ == "__main__":
    app.run()
