#!/usr/bin/env bash
#
# vendor_canvas_core.sh — copy the pure-Python backend/canvas_core package into
# each agent's directory so the deployed runtime container is self-contained.
# Run from anywhere; re-run before each `agentcore deploy`. Idempotent.
#
# canvas_core stays the single source of truth in backend/; this just vendors a
# fresh copy (minus tests/caches) per agent. Never edit the vendored copies.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"   # backend/ (canvas_core lives here)
SRC="$BACKEND_DIR/canvas_core"
# Only the agents that import canvas_core. Reasoning uses it for its local
# cost/constraint @tools. The Orchestrator is a pure router (boto3
# InvokeAgentRuntime) and never touches canvas_core, so it isn't vendored.
AGENTS=(Reasoning)

[[ -d "$SRC" ]] || { echo "error: $SRC not found" >&2; exit 1; }

for agent in "${AGENTS[@]}"; do
  agent_dir="$SCRIPT_DIR/CryloAgents/app/$agent"
  if [[ ! -d "$agent_dir" ]]; then
    echo "skip $agent — $agent_dir does not exist yet (run 'agentcore add agent $agent' first)"
    continue
  fi
  dest="$agent_dir/canvas_core"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -r "$SRC/." "$dest/"
  # drop things the runtime doesn't need
  rm -rf "$dest/tests" "$dest/README.md"
  find "$dest" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
  find "$dest" -type f -name '*.pyc' -delete 2>/dev/null || true
  echo "vendored canvas_core -> agents/CryloAgents/app/$agent/canvas_core"
done
