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
`~/.claude/projects/-mnt-d-projects-clyro/memory/`.
- `MEMORY.md` — index, one line per memory file. Read first.
- `brainstorm_log.md` — running findings / root causes / decisions, dated and
  status-tagged (OPEN / FIXED / INFO). Append here, not inline in this file.
- `live_infra_snapshot.md` — what is actually deployed in AWS, CLI-verified.
Other `*.md` in that folder are single-fact memories. Old location
`~/.claude/brainstorming/clyro-findings.md` is superseded.

## Git workflow
Commit progressively, push only on request.
- Commit as each logical piece of work lands, not in one batch at the end. One
  coherent change per commit, with a message explaining why rather than what.
- A commit is expected once a unit of work is finished and verified. Do not
  wait to be asked.
- **Never `git push` unless explicitly told to.** Commits are local until then,
  so the branch stays reviewable and rewritable.
- Never open a PR unprompted either. Pushing and PRs are always an explicit
  instruction, never inferred from "commit this".
