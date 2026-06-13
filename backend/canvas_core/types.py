"""Shared type aliases for the canvas data structures.

The canvas is dynamic, JSON-shaped data parsed from YAML, so the aliases are
intentionally light (`dict[str, Any]`). They document intent and satisfy the type
checker's generic-argument requirements without the friction of TypedDicts over
freely-mutated dicts.
"""

from __future__ import annotations

from typing import Any

Node = dict[str, Any]
Connection = dict[str, Any]
Canvas = dict[str, Any]
Intent = dict[str, Any]
Overrides = dict[str, Any]
PriceBook = dict[str, Any]
Position = dict[str, int]
Positions = dict[str, Position]
CostLineItem = dict[str, Any]
CostEstimate = dict[str, Any]
Operation = dict[str, Any]
ChangeRecord = dict[str, Any]
Version = dict[str, Any]
RoutedEdge = dict[str, Any]
