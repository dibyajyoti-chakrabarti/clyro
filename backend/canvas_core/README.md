# canvas_core

The deterministic engine behind Crylo **Step 3 (Canvas)**. Pure Python, no AWS or
Django dependencies — it lives at `backend/canvas_core/` and is imported
**natively** by the Django backend (`backend/` is on the path, so
`from canvas_core import ...` works with no editable install). Staying Django-free
lets the AgentCore agents vendor a copy into their runtime bundles. It is the
**single source of truth** imported by:

- the **Django backend** (`backend/canvas/`) — stub mode + persistence,
- the **Reasoning agent** (`cost_engine` + `constraints`),
- the **Layout agent** (`canvas_ops` + `layout_solver` + `constraints`),

so cost math, bounded operations, layout, and the hard constraints can never
drift between them.

## Modules

| Module | Responsibility |
| --- | --- |
| `cost_engine.py` | Deterministic monthly cost. The *math* is fixed; the *per-unit prices* come from an injectable `price_book` (filled live by the Reasoning agent from the awslabs **Pricing MCP**). `DEFAULT_PRICE_BOOK` is the calibrated offline fallback used in stub mode / on MCP failure. |
| `canvas_ops.py` | Parse / serialize `canvas.yml`; the 5 bounded ops (ADD/REMOVE/UPDATE_NODE, ADD/REMOVE_CONNECTION); `CanvasVersion`-shaped version builder. |
| `layout_solver.py` | Collision-free `x/y` placement + arrow re-routing. |
| `constraints.py` | Allowed `aws_service` enums per node type + the Step 3 hard constraints. |
| `examples.py` | The seeded `invoiceapp` Step 1/2 example (shared by tests and the backend seed). |

## Cost model (calibrated fallback)

For the seeded example (scale=small, criticality=high, environment=production) the
fallback reproduces the docs' reference panel exactly: total **$127/mo**, and
`db` `rds_postgres → aurora_postgres` is **+$67** ($127 → $194). Live Pricing-MCP
prices will differ slightly from these calibrated numbers — only the fallback
reproduces the doc.

## Develop / test

Run from the backend directory so `canvas_core` resolves as a package:

```bash
cd backend
uv run --no-project --with pytest --with pyyaml -- python -m pytest canvas_core/tests -q
```

Persistence/serialization against `core.models` happens in the `backend/canvas/`
app (Phase 2), not here. The agents vendor a copy of this package at deploy time.
