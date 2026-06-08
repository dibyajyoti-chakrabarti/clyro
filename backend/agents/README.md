# Crylo Canvas — AgentCore agent (Step 3)

The Step-3 canvas uses a single **Reasoning** agent: conversation → one proposal
or one answer, cost deltas, semantic constraints; tools = Pricing/CFN/Docs MCP
via the Gateway. It emits `{outcome, message, operation?, cost_*}`.

All placement, ops, layout, cost, and constraint logic is deterministic
`canvas_core` run by the **Django backend**, which is the system of record — it
applies a confirmed operation and persists each `CanvasVersion` to Postgres. The
Reasoning agent **vendors a copy** of `backend/canvas_core/` at deploy time
(`./vendor_canvas_core.sh`) for its local cost/constraint `@tool`s, so its runtime
container is self-contained.

```
React → Django Canvas API ─(REASONING_RUNTIME_ARN set)→ Reasoning (RT) → Gateway → 3 MCP Lambdas
            │
            └─ confirmed op → canvas_core apply + persist (Django, system of record)
```

## Prerequisites

- **AgentCore CLI** (npm, Node 20+): `npm install -g @aws/agentcore` then
  `agentcore --version` (need ≥ 0.9.0).
- AWS credentials configured (same as the MCP deploy).
- Bedrock **Claude model access enabled in ap-south-1** (Bedrock console →
  Model access) — the agent calls Claude on Bedrock.
- The 3 MCP Lambdas already deployed (`backend/mcp/`), ARNs in
  `backend/mcp/arns.env`.

## Replicate on another machine (fresh clone)

The whole `CryloCanvas/` scaffold + agent code is **committed**, so a teammate
does **not** re-run `agentcore create` / `agentcore add agent`. They restore the
gitignored artifacts (the `.venv/`, the vendored `canvas_core/`, CDK
`node_modules/`) and deploy to **their own AWS account**. Nothing here is tied to
a specific account — `aws-targets.json` is gitignored and gets filled in on the
first deploy.

### 0. Install the toolchain

| Tool | Why | Install |
| --- | --- | --- |
| **Node.js 20+** | AgentCore CLI + auto-managed CDK | nvm / system package |
| **Python 3.10+ & uv** | the agent venv | <https://docs.astral.sh/uv> |
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

The agent's Gateway routes to these, so they must exist before wiring the gateway.

```bash
cd backend/mcp
./deploy_mcp.sh                    # builds 3 images, creates 3 Lambdas + roles
                                   # writes backend/mcp/arns.env (gitignored)
```

### 3. Restore the gitignored agent artifacts

```bash
cd ../agents

# (a) vendored shared engine — copied into Reasoning
./vendor_canvas_core.sh

# (b) the agent venv (only needed for `agentcore dev` / local runs)
(cd CryloCanvas/app/Reasoning && uv sync)
```

`agentcore deploy` installs the CDK `node_modules/` itself on first run; if it
doesn't, `cd CryloCanvas/agentcore/cdk && npm install`.

### 4. Deploy the agent + wire the gateway

Run **Deploy steps 4–6 below** exactly as written (deploy → gateway targets →
flip the backend). They're account-agnostic — the CLI reads the committed
`agentcore.json` and provisions fresh resources in the teammate's account.

> Re-running `./vendor_canvas_core.sh` before **every** `agentcore deploy` keeps
> the bundled engine in sync with `backend/canvas_core/`.

## Runbook (original from-scratch build — a fresh clone skips steps 1–2)

The CLI generates the project + the auto-managed CDK infra, so **you run the
scaffold/deploy commands**; the agent logic (`app/Reasoning/main.py`) is written
in this repo.

### 1. Scaffold (you run — already committed; skip on a fresh clone)

```bash
cd backend/agents
agentcore create --name CryloCanvas --framework Strands --model-provider Bedrock --memory none
agentcore add agent --name Reasoning --framework Strands --model-provider Bedrock --memory none --language Python
```

This produces `backend/agents/CryloCanvas/` with `agentcore/agentcore.json`,
`aws-targets.json`, `cdk/` (don't edit), and `app/Reasoning/{main.py,pyproject.toml}`.

### 2. Agent code (written in-repo, after the scaffold exists)

- `app/Reasoning/main.py` — Strands agent; connects to the Gateway MCP
  (`AGENTCORE_GATEWAY_CRYLOCANVASGW_URL`, with a local-dev guard so it no-ops to
  zero tools when the URL is unset); local `@tool`s over `canvas_core.cost_engine`
  + `constraints`; emits `{outcome, message, operation?, cost_*}`.

### 3. Vendor canvas_core (you run, before each deploy)

```bash
cd backend/agents
./vendor_canvas_core.sh
```

Copies `backend/canvas_core/` into `CryloCanvas/app/Reasoning/canvas_core/`.

### 4. Local dev + deploy (you run)

```bash
cd backend/agents/CryloCanvas
agentcore dev -r Reasoning    # local loop (no gateway/memory locally)
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

agentcore deploy        # Reasoning picks up AGENTCORE_GATEWAY_CRYLOCANVASGW_URL
```

### 6. Flip the backend to the real agent

Set `REASONING_RUNTIME_ARN` in the Django env → `services.py` sends a new prompt
to the deployed Reasoning runtime instead of the local `canvas_core` stub.
Confirmed mutations are always applied + persisted by Django via `canvas_core`.

## Environment variables

The agent reads its config from environment variables. For **local dev**
(`agentcore dev`) copy the template to `.env`; for the **deployed** runtime the
gateway URL is auto-injected when the gateway is bound. `.env.example` is a
committed template (placeholders only — no secrets); the real `.env` is
gitignored.

```bash
cp app/Reasoning/.env.example app/Reasoning/.env
```

| Variable | How to populate |
| --- | --- |
| `AGENTCORE_GATEWAY_CRYLOCANVASGW_URL` | Auto-injected on deploy. Local: leave blank (no MCP tools) or paste the deployed gateway URL. |
| `AWS_REGION` | Region with Bedrock model access (e.g. `ap-south-1`). |

AWS credentials always come from your AWS CLI config / the runtime execution
role — never from this file.

## Verify

```bash
# new prompt → Reasoning (LLM) → JSON proposal with a cost delta
agentcore invoke --runtime Reasoning '{"prompt":"Use Aurora instead of RDS","canvas":{"nodes":[{"id":"db","label":"PostgreSQL","type":"database","aws_service":"rds_postgres"}],"connections":[]},"intent":{"scale":"small","criticality":"high","environment":"production"}}'
```
…then the same prompts through the UI: proposal + cost delta → confirm → `db`
node updates + new version (Django applies the confirmed op via `canvas_core`);
"Add a CDN…" → answer, no change; "Remove the backend" → rejected.
```
backend/agents/
├── README.md
├── vendor_canvas_core.sh
└── CryloCanvas/            # generated by `agentcore create` (you run)
    ├── agentcore/          # config + auto-managed CDK (don't edit cdk/)
    └── app/Reasoning/      # main.py written in-repo + vendored canvas_core/
```
