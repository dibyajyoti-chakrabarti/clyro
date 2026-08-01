# Clyro — agent context

## graphify (knowledge graph at `graphify-out/`)
Codebase questions → query the graph first; it returns a scoped subgraph far
smaller than grep or `GRAPH_REPORT.md`.
- `graphify query "<question>"` — default entry point (needs `graphify-out/graph.json`).
- `graphify path "<A>" "<B>"` — relationships · `graphify explain "<concept>"` — focused concept.
- `graphify-out/wiki/index.md` — broad navigation · `GRAPH_REPORT.md` — architecture review only.
- After editing code: `graphify update .` (AST-only, no API cost).

## Cross-session memory (local, not committed)
Findings, root causes, and brainstorming persist at
`~/.claude/brainstorming/clyro-findings.md`. Read it at the start of Clyro work;
append new findings there (dated, status-tagged), not inline here.
