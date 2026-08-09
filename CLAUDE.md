# Clyro — agent context

## graphify (knowledge graph at `graphify-out/`)
Codebase questions → query the graph first; it returns a scoped subgraph far
smaller than grep or `GRAPH_REPORT.md`.
- `graphify query "<question>"` — default entry point (needs `graphify-out/graph.json`).
- `graphify path "<A>" "<B>"` — relationships · `graphify explain "<concept>"` — focused concept.
- `graphify-out/wiki/index.md` — broad navigation · `GRAPH_REPORT.md` — architecture review only.
- After editing code: `graphify update .` (AST-only, no API cost).

## Cross-session memory (local, not committed)
Lives in the agent memory folder
`~/.claude/projects/-home-dibyajyoti-projects-clyro/memory/`.
- `MEMORY.md` — index, one line per memory file. Read first.
- `brainstorm_log.md` — running findings / root causes / decisions, dated and
  status-tagged (OPEN / FIXED / INFO). Append here, not inline in this file.
- `live_infra_snapshot.md` — what is actually deployed in AWS, CLI-verified.
Other `*.md` in that folder are single-fact memories. Old location
`~/.claude/brainstorming/clyro-findings.md` is superseded.
