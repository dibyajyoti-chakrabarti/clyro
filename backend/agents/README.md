# Crylo Canvas — AgentCore agents (Step 3)

The Step-3 canvas sub-network: a **Reasoning** agent (conversation → one proposal
or one answer, cost deltas, semantic constraints; tools = Pricing/CFN/Docs MCP
via the Gateway), a **Layout** agent (constrained executor: collision-free x/y,
arrow re-route, apply one bounded op, append a version; no tools), and an
**Orchestrator** (deterministic sequencer that holds the confirm→handoff flow and
delegates to the other two via `InvokeAgentRuntime`).

All canvas math (cost, ops, layout, constraints) lives in the pure-Python
`backend/canvas_core/` package — the single source of truth shared with the
Django backend. Each agent **vendors a copy** of it at deploy time
(`./vendor_canvas_core.sh`) so the runtime container is self-contained.

```
React → Django Canvas API ─(ORCHESTRATOR_RUNTIME_ARN set)→ Orchestrator (RT)
                                                              ├─ Reasoning (RT) → Gateway → 3 MCP Lambdas
                                                              └─ Layout (RT)
```

## Prerequisites

- **AgentCore CLI** (npm, Node 20+): `npm install -g @aws/agentcore` then
  `agentcore --version` (need ≥ 0.9.0).
- AWS credentials configured (same as the MCP deploy).
- Bedrock **Claude model access enabled in ap-south-1** (Bedrock console →
  Model access) — the agents call Claude on Bedrock.
- The 3 MCP Lambdas already deployed (`backend/mcp/`), ARNs in
  `backend/mcp/arns.env`.

## Replicate on another machine (fresh clone)

The whole `CryloCanvas/` scaffold + agent code is **committed**, so a teammate
does **not** re-run `agentcore create` / `agentcore add agent`. They restore the
gitignored artifacts (per-agent `.venv/`, the vendored `canvas_core/`, CDK
`node_modules/`) and deploy to **their own AWS account**. Nothing here is tied to
a specific account — `aws-targets.json` is empty in git and gets filled in on the
first deploy.

### 0. Install the toolchain

| Tool | Why | Install |
| --- | --- | --- |
| **Node.js 20+** | AgentCore CLI + auto-managed CDK | nvm / system package |
| **Python 3.10+ & uv** | per-agent venvs | <https://docs.astral.sh/uv> |
| **AWS CLI** (configured) | deploy targets your account | `aws configure` |
| **Docker** | builds the MCP Lambda images (`backend/mcp/`) | system package |
| **AgentCore CLI** | scaffold/deploy | `npm install -g @aws/agentcore` (need ≥ 0.9.0) |

### 1. Clone + point at the right account/region

```bash
git clone <repo-url> clyro
cd clyro
aws configure                      # their access key / secret
export AWS_REGION=ap-south-1        # all Step-3 + MCP resources live here
```

Then enable **Bedrock Claude model access in `ap-south-1`** (Bedrock console →
Model access → request `anthropic.claude-sonnet-4-5`). Without this the Reasoning
agent's model call 403s.

### 2. Deploy the MCP Lambdas first (their account)

The agents' Gateway routes to these, so they must exist before wiring the gateway.

```bash
cd backend/mcp
./deploy_mcp.sh                    # builds 3 images, creates 3 Lambdas + roles
                                   # writes backend/mcp/arns.env (gitignored)
```

### 3. Restore the gitignored agent artifacts

```bash
cd ../agents

# (a) vendored shared engine — copied into Reasoning + Layout
./vendor_canvas_core.sh

# (b) per-agent Python venvs (only needed for `agentcore dev` / local runs)
for a in Reasoning Layout Orchestrator; do (cd CryloCanvas/app/$a && uv sync); done
```

`agentcore deploy` installs the CDK `node_modules/` itself on first run; if it
doesn't, `cd CryloCanvas/agentcore/cdk && npm install`.

### 4. Deploy the agents + wire the gateway

Run **Deploy steps 4–6 below** exactly as written (deploy → gateway targets →
Orchestrator ARNs → flip the backend). They're account-agnostic — the CLI reads
the committed `agentcore.json` and provisions fresh resources in the teammate's
account.

> Re-running `./vendor_canvas_core.sh` before **every** `agentcore deploy` keeps
> the bundled engine in sync with `backend/canvas_core/`.

## Runbook (original from-scratch build — a fresh clone skips steps 1–2)

The CLI generates the project + the auto-managed CDK infra, so **you run the
scaffold/deploy commands**; the agent logic (`app/<Agent>/main.py`) is written in
this repo.

### 1. Scaffold (you run — already committed; skip on a fresh clone)

```bash
cd backend/agents
agentcore create --name CryloCanvas --framework Strands --model-provider Bedrock --memory none
# add the three runtimes
agentcore add agent --name Reasoning    --framework Strands --model-provider Bedrock --memory none --language Python
agentcore add agent --name Layout       --framework Strands --model-provider Bedrock --memory none --language Python
agentcore add agent --name Orchestrator --framework Strands --model-provider Bedrock --memory none --language Python
```

This produces `backend/agents/CryloCanvas/` with `agentcore/agentcore.json`,
`aws-targets.json`, `cdk/` (don't edit), and `app/<Agent>/{main.py,pyproject.toml}`.

### 2. Agent code (written in-repo, after the scaffold exists)

- `app/Reasoning/main.py` — Strands agent; connects to the Gateway MCP
  (`AGENTCORE_GATEWAY_CRYLOCANVASGW_URL`, with a local-dev guard so it no-ops to
  zero tools when the URL is unset); local `@tool`s over `canvas_core.cost_engine`
  + `constraints`; emits `{outcome, message, operation?, cost_*}`.
- `app/Layout/main.py` — constrained executor; `canvas_core.canvas_ops` +
  `layout_solver`; `{operation, target_node, params, canvas}` → new canvas +
  coords + version object. No tools.
- `app/Orchestrator/main.py` — deterministic sequencer; `delegate_to_reasoning` /
  `delegate_to_layout` via `bedrock-agentcore:InvokeAgentRuntime`; holds the
  confirm→handoff flow. Needs `InvokeAgentRuntime` on the Reasoning/Layout ARNs.

### 3. Vendor canvas_core (you run, before each deploy)

```bash
cd backend/agents
./vendor_canvas_core.sh
```

Copies `backend/canvas_core/` into each `CryloCanvas/app/<Agent>/canvas_core/`.

### 4. Local dev + deploy (you run)

```bash
cd backend/agents/CryloCanvas
agentcore dev                 # local loop per agent (no gateway/memory locally)
agentcore deploy              # Reasoning picks up the gateway URL after deploy
```

### 5. Wire the gateway + targets (you run)

```bash
# Source ARNs from the MCP deploy output
source ../../mcp/arns.env

agentcore add gateway --name CryloCanvasGw --authorizer-type NONE

agentcore add gateway-target --gateway CryloCanvasGw --name pricing \
  --type lambda-function-arn --lambda-arn "$CRYLO_MCP_PRICING_ARN" \
  --tool-schema-file ../../mcp/pricing/tools.json

agentcore add gateway-target --gateway CryloCanvasGw --name cfn \
  --type lambda-function-arn --lambda-arn "$CRYLO_MCP_CFN_ARN" \
  --tool-schema-file ../../mcp/cfn/tools.json

agentcore add gateway-target --gateway CryloCanvasGw --name docs \
  --type lambda-function-arn --lambda-arn "$CRYLO_MCP_DOCS_ARN" \
  --tool-schema-file ../../mcp/docs/tools.json
```

Then write the Reasoning/Layout ARNs into the Orchestrator's env and
`agentcore deploy` again.

### 6. Flip the backend to the real agents

Set `ORCHESTRATOR_RUNTIME_ARN` in the Django env → `services.py` delegates to the
deployed Orchestrator instead of the local `canvas_core` stub.

## Verify

```bash
agentcore invoke Orchestrator '{"prompt":"Use Aurora instead of RDS"}'
```
…then the same prompts through the UI: proposal + cost delta → confirm → `db`
node updates + new version; "Add a CDN…" → answer, no change; "Remove the
backend" → rejected.
```
backend/agents/
├── README.md
├── vendor_canvas_core.sh
└── CryloCanvas/            # generated by `agentcore create` (you run)
    ├── agentcore/          # config + auto-managed CDK (don't edit cdk/)
    └── app/{Reasoning,Layout,Orchestrator}/  # main.py written in-repo + vendored canvas_core/
```
