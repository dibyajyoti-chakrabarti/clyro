"""canvas_core — Crylo Step 3 deterministic engine.

The single source of truth shared by the Django backend and the Reasoning /
Layout agents: cost estimation, the bounded canvas operations, the layout
solver, and the hard constraints. Pure Python — no AWS or Django dependencies.
"""

from __future__ import annotations

from . import canvas_ops, constraints, cost_engine, layout_solver

__all__ = ["canvas_ops", "constraints", "cost_engine", "layout_solver"]
__version__ = "0.1.0"
