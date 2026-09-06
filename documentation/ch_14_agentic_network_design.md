# Chapter 14: Agentic AI Network Design

> **Read this before the chapter. Added 2026-09-06.**
>
> **This is a design document, not a description of the running system.** It sets out
> the agent network as it was conceived, and most of it was never built. The reasoning
> is why the chapter is kept: the trust-boundary argument in §1.3, the
> deterministic-where-possible principle in §1.5, and the per-agent context budgets in
> §9.3 all still guide the code. The topology does not.
>
> **What actually exists.** Two Amazon Bedrock AgentCore runtimes, in
> `backend/agents/`:
>
> | Runtime | Wizard step | Role |
> | --- | --- | --- |
> | `CryloCanvas_Reasoning` | 3 and 4 | The conversational layer over the architecture canvas |
> | `CryloIac_IacArchitect` | 5 | CloudFormation refinement, and generation before Chapter 13 made it deterministic |
>
> `backend/config/settings.py` holds exactly two runtime ARNs, `REASONING_RUNTIME_ARN`
> and `IAC_RUNTIME_ARN`, which is the shortest proof of the above.
>
> **What was designed here and does not exist:** the `GraphBuilder` orchestrator, the
> Repo Recon agent, the Intent agent, the Monitoring agent, the Step 1 detection Swarm,
> the A2A cross-runtime protocol, and AgentCore Memory. Step ordering is enforced by the
> Django backend and the wizard state machine. Agent and project state lives in
> PostgreSQL on the application instance. Step 1 no longer runs an agent at all: it
> ingests an offline `CLYRO.md` contract, and RepoRecon was deleted (see Chapters 8
> and 20).
>
> **The MCP tool plane in §2 is not the one that shipped.** None of the `awslabs/mcp`
> servers or the GitHub MCP are deployed. Clyro built three MCP tool Lambdas of its own:
> `clyro-mcp-pricing` (`get_pricing`), `clyro-mcp-cfn`
> (`validate_cloudformation_template`) and `clyro-mcp-docs` (`search_documentation`,
> `read_documentation`, `recommend`). GitHub access is direct, through
> `backend/app/github_utils.py`. CloudFormation is submitted with boto3 in
> `backend/app/provisioning/deploy.py` under an assumed role, not through an MCP.
> Validation is cfn-lint plus cfn-guard plus `security_scan`, not Checkov.
>
> **Template authorship has inverted since this was written.** Every line below that
> has an agent author the CloudFormation template is superseded by Chapter 13:
> `cfn_generator.py` authors it deterministically and the LLM only refines.
>
> **The step numbers below are the retired five-step scheme.** Map them like this:
>
> | Below | Today |
> | --- | --- |
> | Step 1, repo | Step 1, connect your repository |
> | Step 2, intent | Step 3, tell us about your app (Step 2 is connecting the AWS account) |
> | Step 3, canvas | Step 4, review your architecture |
> | Step 4, provisioning | Step 5 generates the template, Step 6 provisions |
> | Step 5, monitoring | Step 7, your infrastructure is live |
>
> Finally, the product is **Clyro**. "Crylo" survives only inside the two AgentCore
> runtime names, which are deployed under those identifiers.

**Frameworks as designed:** Strands Agents SDK (orchestration) · Amazon Bedrock AgentCore Runtime (deployment) · AgentCore Gateway (MCP tool plane) · AgentCore Memory (state). Of these, only AgentCore Runtime is in use.
**IaC strategy:** Template-centric. A single CloudFormation template is authored, validated, then submitted via the CloudFormation API. Still true, except that the author is deterministic Python rather than an agent.

---

## 1. Design Principles

1. **Supervisor + specialists.** A Strands `GraphBuilder` orchestrator enforces strict step ordering and the hard gate (nothing past Step 1 runs until Step 1 fully succeeds). Each step is a specialist agent.
2. **One specialist = one AgentCore Runtime.** Agents scale and fail independently. The Gateway is a shared tool plane; Memory is a shared store scoped per agent by `project_id`.
3. **Trust boundaries are physical, not advisory.** The agent that reads untrusted repo content has no AWS write access. The agent that mutates AWS never reads raw repo content. This is the mitigation for prompt-injection risk, since repo content from arbitrary users is untrusted input.
4. **Reuse MCP servers; never hand-ingest AWS docs.** All AWS knowledge and actions come from the official `awslabs/mcp` servers and the GitHub MCP, federated behind one Gateway endpoint.
5. **Deterministic where possible, model reasoning only on ambiguity.** Detection rules and cost math are deterministic; the model is invoked for the ambiguous residue and for conversation.

---

## 2. Reusable MCP Servers

All servers register behind a single **AgentCore Gateway** endpoint, which provides one MCP URL, OAuth/IAM auth, and tool discovery/search.

| Capability needed | MCP server | Used by |
| --- | --- | --- |
| Read repo tree + file contents, open Dockerfile PR | **GitHub MCP** (`github/github-mcp-server`) | Repo Recon (Step 1) |
| CFN resource schemas, CDK best practices, security validation, doc lookup | **AWS IaC / CloudFormation MCP** (`awslabs.cfn-mcp-server`) + **AWS Documentation MCP** (remote, managed) | Canvas Reasoning (Step 3), Provisioning (Step 4) |
| Generic AWS service calls — STS AssumeRole, ECR, Secrets Manager, ACM, CloudFormation stack submit | **AWS API MCP** (`awslabs.aws-api-mcp-server`) | Provisioning (Step 4) |
| Live + estimated pricing for the cost panel | **AWS Pricing MCP** (`awslabs.aws-pricing-mcp-server`) | Canvas Reasoning (Step 3), Provisioning (Step 4) |
| Real spend, forecasts, anomalies | **Cost Explorer MCP** (`awslabs.cost-explorer-mcp-server`) | Monitoring (Step 5) |
| Health, metrics, alarms, logs (with built-in investigation skills) | **CloudWatch MCP** (`awslabs.cloudwatch-mcp-server`) | Monitoring (Step 5) |
| Build-time authoring/deploying the agents themselves | **Bedrock AgentCore MCP** (`awslabs.amazon-bedrock-agentcore-mcp-server`) | Build-time only — not in the runtime network |

**Template-centric note:** The AWS Cloud Control API (CCAPI) MCP is intentionally **not** used as the primary provisioning path. Provisioning authors one CloudFormation template (CFN/IaC MCP for schema + validation, Checkov for scanning) and submits it via the CloudFormation API (`CreateStack` / `CreateChangeSet` / `UpdateStack`) through the AWS API MCP.

**Boundary caveat:** The AWS API MCP docs warn against pointing powerful AWS MCPs at untrusted data due to prompt-injection risk. Repo content is untrusted, so the repo-reading agent (Step 1, GitHub MCP only) is kept strictly separate from the AWS-mutating agent (Step 4).

---

## 3. Network Topology

```
                          ┌──────────────────────────────────┐
                          │      Crylo Orchestrator           │
                          │   (Strands GraphBuilder)          │
                          │   step ordering + hard gate       │
                          └─────────────────┬─────────────────┘
      ┌───────────────┬────────────────┬────┴───────────┬──────────────────┐
      ▼               ▼                ▼                 ▼                  ▼
┌───────────┐  ┌───────────┐   ┌──────────────────┐ ┌───────────┐  ┌────────────┐
│Repo Recon │  │  Intent   │   │   CANVAS (Step 3) │ │ Provision │  │ Monitoring │
│ (Step 1)  │  │ (Step 2)  │   │ ┌──────────────┐  │ │ (Step 4)  │  │ (Step 5)   │
│           │  │           │   │ │ Reasoning Ag.│  │ │           │  │            │
│           │  │           │   │ └──────┬───────┘  │ │           │  │            │
│           │  │           │   │   confirmed op    │ │           │  │            │
│           │  │           │   │        ▼          │ │           │  │            │
│           │  │           │   │  backend applies  │ │           │  │            │
│           │  │           │   │   canvas_core     │ │           │  │            │
└─────┬─────┘  └─────┬─────┘   └─────────┬─────────┘ └─────┬─────┘  └─────┬──────┘
      │              │                   │                 │              │
  GitHub MCP    (no MCP —          Pricing MCP        AWS API MCP    CloudWatch MCP
                pure intent)       AWS Docs MCP       CFN/IaC MCP    Cost Explorer MCP
                                   CFN/IaC MCP        Pricing MCP
      └──────────────────── AgentCore Gateway (single MCP endpoint) ──────────────┘
      └──────────────────── AgentCore Memory (scoped per agent by project_id) ────┘
```

**Sub-structures:**
- **Detection Swarm (under Repo Recon):** three parallel scanners — Tree Scanner, High-Signal File Reader, Env-Var Classifier — using the Strands Swarm primitive, because the passes share findings and Pass 3 runs only on residual ambiguity.
- **Canvas (Step 3):** a single **Reasoning Agent** (the only LLM in Step 3). The placement/commit step is **deterministic `canvas_core`** run by the Django backend, not a separate agent runtime — the Reasoning Agent proposes an operation and, on confirmation, the backend applies it (collision-free coords + version append) and persists. See §5.

**Strands primitives used:** `GraphBuilder` (orchestrator ordering), Agents-as-Tools (specialist delegation), Swarm (Step 1 scan), A2A protocol (cross-runtime calls).

---

## 4. Memory Model

Using AgentCore Memory's two tiers:

- **Short-term memory** — raw event/conversation state within a single session (current step, answers gathered so far, the live CFN event stream during a deploy, an uncommitted proposal awaiting confirmation).
- **Long-term memory** — consolidated, durable records keyed by `project_id`: detected-resources record, intent record, versioned canvas snapshots, deployed stack outputs, alert history, and cross-session user preferences (e.g. "this user always picks Fargate").

**Never written to memory:** assumed AWS credentials (session-only, 1-hour expiry) and secret *values* (only key→ARN maps are stored).

### Consolidated LTM / STM contents per agent
The authoritative list of what each agent writes to each tier. Long-term is keyed by `project_id` and survives across sessions; short-term lives only for the active session.

| Agent | Long-term memory (durable) | Short-term memory (session) |
| --- | --- | --- |
| Orchestrator | project lifecycle state (current step reached) | which step the user is on this session |
| Repo Recon (1) | `detected-resources` record, `env-var` record, draft `canvas.yml` | scan working set (file tree, ambiguity flags driving Pass 3) |
| Intent (2) | `intent` record; cross-project user preferences (e.g. default to Fargate) | answers gathered so far this session |
| Canvas Reasoning (3) | — (reads intent + canvas; writes none directly) | editing conversation, the uncommitted proposal awaiting confirmation |
| Canvas commit (backend, not an agent) | versioned `canvas.yml` snapshots in Postgres (one per confirmed mutation: op, prev/new value, snapshot) — written by the Django backend, the system of record | — |
| Provisioning (4) | `stack-outputs` (URLs, ARNs), provisioning log, Secrets Manager key→ARN map | live CFN event stream (digested), change-set preview awaiting confirmation |
| Monitoring (5) | 30-day alert history (state changes only) | latest poll snapshot (overwritten each poll) |

Write discipline: short-term is overwritten or discarded at session end; only consolidated facts and finalized records are promoted to long-term. Raw conversation transcripts are not retained — Memory consolidation distills them into the records and preferences above.

---

## 5. Agents — Responsibility, Context, Memory

### Orchestrator
- **Owns:** step sequencing, the hard gate, routing user turns to the right specialist, holding the canonical `project_id`. Makes no AWS or repo calls.
- **Context:** current step, completion flags, pointers (not payloads) to each step's output record.
- **Memory:** short-term = current step this session; long-term = project lifecycle state so a returning user resumes correctly.

### Repo Recon Agent (Step 1)
- **Owns:** GitHub App connection, three-pass scan, deterministic detection rules, env-var detection/classification, Dockerfile generation, draft `canvas.yml`. **Writes the worker→db and worker→cache connection edges into the draft canvas** so worker networking is correct from the start.
- **Tools:** GitHub MCP only. **Untrusted-input boundary — no AWS write access.**
- **Context:** repo URL + branch, framework support matrix, the Pass-1 file-tree checklist. Holds no AWS credentials.
- **Memory:** long-term = detected-resources + env-var records; short-term = scan working set and ambiguity flags driving Pass 3.

### Intent Agent (Step 2)
- **Owns:** the one-at-a-time question sequence, suppressing anything Step 1 already answered, writing the intent record, updating `canvas.yml` with confirmed `aws_service` values.
- **Tools:** none — pure reasoning over the Step 1 record.
- **Context:** full detected-resources record, the question→infrastructure mapping table.
- **Memory:** long-term = intent record + cross-project user preferences (pre-fill defaults); short-term = answers gathered this session.

### Canvas — Reasoning Agent (Step 3)
- **Owns:** the conversation. Classifies each user prompt into exactly one outcome — a mutation intent **or** an answer, never both. Explains tradeoffs, produces suggestions and comparisons, and attaches a cost delta to every proposed change before asking for confirmation. Decides the **semantic** change (e.g. "switch db to aurora_postgres"); does not compute coordinates or execute.
- **Tools:** Pricing MCP (cost deltas), AWS Docs + CFN/IaC MCP (explain services, validate that a proposed `aws_service` is real and allowed for the node type).
- **Context:** current `canvas.yml` semantic state, `intent.scale/criticality/environment/description`, detected framework. This context is what makes suggestions specific rather than generic.
- **Memory:** short-term = the editing conversation and the uncommitted proposal awaiting confirmation; reads long-term canvas + intent records.
- **Hard constraints enforced here:** cannot remove the backend node, cannot add networking nodes (ALB/VPC/subnets), cannot change `image: ecr`, cannot trigger Step 4, cannot add services outside the supported enum. Violations are explained, with an alternative offered.

### Canvas — placement & commit (deterministic, in the backend — not an agent)
- **Owns:** the **graph and spatial model**. Decides **where** a new node is placed (collision-free, sensible grouping near related nodes), recomputes arrow routing when nodes are added/removed, and translates a *confirmed* semantic op into the actual `canvas.yml` mutation including `x/y` positions. Runs the bounded operation set (ADD_NODE, REMOVE_NODE, UPDATE_NODE, ADD_CONNECTION, REMOVE_CONNECTION) and the version append.
- **Where it runs:** this is all **deterministic `canvas_core`** (cost / ops / layout / constraints — the same module the Reasoning Agent uses for cost), executed by the **Django backend**, which is the system of record. It is *not* a separate AgentCore runtime.
- **Handoff contract:** the Reasoning Agent proposes `{operation}` and, on user confirmation, the backend applies it via `canvas_core` (new coords + version) and persists. The placement step never talks to the user.

### Provisioning Agent (Step 4) — template-centric
- **Owns:** AssumeRole bootstrap, env-var collection → Secrets Manager, **single CloudFormation template generation**, the build-and-push phase (build backend image → ECR, build React → S3, *then* start ECS so infra never comes up empty), the review screen, stack submission, and the live deploy feed. **Verifies detected-env-var-name parity** before provisioning so injected names match what the code reads.
- **Owns the observability resources Step 5 reads** (see Section 8). The template must declare: one `AWS::CloudWatch::Alarm` per row of the Step 5 alert-translation table; **Container Insights enabled** on the ECS cluster (for granular per-task compute metrics); and the `AWS::Logs::LogGroup` **plus the `awslogs` log driver wired into each ECS task definition** (creating the group is not enough — the driver must point at it). Step 5 is read-only and cannot create any of these.
- **Tools:** CFN/IaC MCP (template authoring + schema + Checkov security validation), AWS API MCP (STS AssumeRole, ECR, Secrets Manager, ACM, and CloudFormation `CreateStack`/`CreateChangeSet`/`UpdateStack`), Pricing MCP (final cost — must reconcile with Step 3 via the same cost engine).
- **Context:** finalized `canvas.yml` + intent record + env-var record. Holds short-lived assumed credentials **in session only**.
- **Memory:** long-term = deployed stack outputs (URLs, ARNs), provisioning log, Secrets Manager key→ARN map (names only); short-term = the live CFN event stream and, for re-provisions, the change-set preview the user confirms.
- **Re-provision safety:** if a stack already exists, submit a **CloudFormation change set**, surface every resource flagged `Replacement: True` (with explicit warnings + optional RDS snapshot for stateful replacements), and require typed confirmation before applying.

### Monitoring Agent (Step 5)
- **Owns:** health rollups, metric→plain-English translation, real cost reporting, alert translation, resource detail panels. Read-only for MVP. **Reads metrics; does not collect them** — collection is an AWS-service-level concern set up in Step 4 (Section 8).
- **Tools:** CloudWatch MCP (health/metrics/alarms/logs — its built-in investigation skills handle alarm→plain-English), Cost Explorer MCP (real spend + forecast).
- **Context:** deployed stack resource list + ARNs from Step 4, the alert-translation rule table, polling intervals.
- **Memory:** long-term = 30-day alert history; short-term = latest poll snapshot. Reuses the Step 4 role, read-only; no AWS writes.
- **Depends on Step 4** having provisioned the alarms, Container Insights, and log configuration it reads. This is a backward dependency: the monitoring you want determines what provisioning must declare.

---

## 6. Refined Agent Workflow per Step

### Step 1 — Repo Recon Agent
1. Orchestrator passes `project_id` + repo URL/branch.
2. Connect via GitHub MCP; spawn the Detection Swarm. Tree Scanner runs Pass 1; if the checklist flags ambiguity, High-Signal Reader runs Pass 2; only on residual ambiguity does the Env/Code scanner run Pass 3.
3. Apply deterministic detection rules; invoke model reasoning only on the ambiguous residue.
4. Write detected-resources + env-var records to long-term memory; generate the Dockerfile PR; build the draft `canvas.yml` (including worker→db / worker→cache edges).
5. Return success or hard-block to the Orchestrator. The gate holds if blocked.

### Step 2 — Intent Agent
1. Load the Step 1 record; compute which questions remain unanswered.
2. Ask them one at a time; apply long-term user-preference defaults where available.
3. Write the intent record; update `canvas.yml` with confirmed services. Return to Orchestrator.

### Step 3 — Canvas (Reasoning Agent + deterministic backend commit)
1. **Render:** the backend serves `canvas.yml` with coordinates (computed by `canvas_core`) and the frontend renders the diagram; the Reasoning Agent loads intent for context and calls Pricing MCP for the live cost panel.
2. **Prompt:** Reasoning Agent classifies each user prompt into one mutation intent **or** one answer. For an answer, it responds (explain/compare/suggest) with no canvas change. For a mutation, it validates the target against allowed enums/constraints (CFN/IaC + Docs MCP), states the cost delta (Pricing MCP), and asks for confirmation.
3. **Confirm:** on user confirmation, the backend takes the proposed `{operation}`.
4. **Place + commit (backend):** the Django backend applies the bounded operation via deterministic `canvas_core` — collision-free coordinates, arrow re-route, append a new version — and persists it to Postgres. Cost panel recomputes.
5. **Finalize:** on Finalize, snapshot and lock the version; signal the Orchestrator to open Step 4. Reopen creates a new draft version requiring re-finalization.

### Step 4 — Provisioning Agent (template-centric)
1. Generate the bootstrap CFN URL; user creates the cross-account IAM role; agent verifies via AssumeRole (AWS API MCP).
2. Collect user secrets; write directly to Secrets Manager; verify env-var name parity against the Step 1 record.
3. **Author one CloudFormation template** from finalized `canvas.yml` + intent (CFN/IaC MCP for resource schemas and template assembly); include the **observability resources Step 5 needs** — one alarm per alert rule, Container Insights on the ECS cluster, and log groups + `awslogs` driver in the task definitions; run Checkov validation; compute final cost (Pricing MCP, same engine as Step 3) and render the review screen.
4. On Provision: run the **build-and-push phase** (backend image → ECR, React build → S3 + CloudFront invalidation), then submit the template via the CloudFormation API — `CreateStack` for a new stack, or `CreateChangeSet` → preview → `ExecuteChangeSet` if the stack exists. Stream stack events, translated to plain English.
5. On success: write stack outputs to long-term memory; signal the Orchestrator to enable Step 5.

### Step 5 — Monitoring Agent
1. Load stack ARNs from memory.
2. Poll on cadence (60s health, 5min metrics, 24h cost) via the CloudWatch MCP (`GetMetricData` for sparklines, `DescribeAlarms` for the alert lane, `FilterLogEvents` for the log panel) and the Cost Explorer MCP (real spend + forecast), all through the read-only assumed role.
3. Translate alarms to plain English using the rule table; append to 30-day alert history.
4. Serve resource detail panels on demand. No mutations (MVP).

---

## 7. Cross-Cutting Notes

- **Gateway timeout vs. long operations.** AgentCore Gateway has a ~5-minute invocation timeout, unsuitable for long-running work (RDS creation, image builds, full-stack provisioning). These run as **async AgentCore Runtime sessions** (up to 8-hour windows) owned by the Provisioning and Monitoring agents, rather than as synchronous Gateway tool calls. Short, interactive lookups (pricing, doc lookups, single API reads) go through Gateway tools.
- **Single cost engine.** The deterministic cost calculator is one module consumed by the Step 3 Reasoning Agent and the Step 4 Provisioning Agent (and as a projection baseline in Step 5), so the estimate the user approves equals the cost of what is built.
- **Credential hygiene.** Assumed-role credentials live in session only and are never persisted to Memory. Secret values go straight to the user's Secrets Manager; Crylo stores only key→ARN.
- **Trust separation.** Repo content (untrusted) is handled only by the GitHub-MCP-scoped Step 1 agent; AWS mutation authority lives only in Step 4. No agent both reads untrusted repo content and holds AWS write access.
- **Observability is provisioned, not collected on demand.** Step 5 reads metrics; it never creates the resources that produce them. Alarms, Container Insights, and log wiring must be declared in the Step 4 template, so Step 5's monitoring requirements flow backward into Step 4's responsibilities (detailed in Section 8).

---

## 8. Observability — How CloudWatch Metrics Are Collected

The Monitoring Agent **reads** metrics; it does not collect them. Collection happens at the AWS-service level, and the metrics fall into two buckets.

### Bucket 1 — Emitted automatically (no setup)
AWS publishes these to CloudWatch on its own once the resource exists and has traffic. The agent simply queries them.

| Dashboard section | Source namespace | Key metrics |
| --- | --- | --- |
| API Performance | `AWS/ApplicationELB` | `RequestCount`, `TargetResponseTime` (p50/p95/p99 via extended statistics), `HTTPCode_Target_4XX_Count`, `HTTPCode_ELB_5XX_Count` |
| Database | `AWS/RDS` | `CPUUtilization`, `DatabaseConnections`, `FreeStorageSpace` |
| Cache | `AWS/ElastiCache` | `CPUUtilization`, `Evictions`, hit rate (Redis may need metric math on `CacheHits`/`CacheMisses`) |
| Queue | `AWS/SQS` | `ApproximateNumberOfMessagesVisible`, `ApproximateAgeOfOldestMessage` (coarser cadence — the 5-min metric poll fits) |
| Compute (basic) | `AWS/ECS` | service-level `CPUUtilization`, `MemoryUtilization` |

### Bucket 2 — Requires provision-time setup (owned by Step 4)
These do not exist unless the Step 4 template creates them:

- **Granular ECS compute** — basic `AWS/ECS` metrics are coarse. Per-task CPU/memory requires **Container Insights enabled on the ECS cluster** (off by default, additional cost), set in the cluster definition.
- **Logs** — the "recent logs" panel reads CloudWatch Logs, but ECS only ships logs there if the **task definition has the `awslogs` log driver configured** against a `LogGroup`. Creating the group alone is insufficient — the driver must be wired in.
- **Alarms** — every row of the Step 5 alert-translation table (ECS below desired count, RDS CPU > 80%, RDS storage < 20%, ALB 5xx > 1%, ElastiCache evictions > 0, SQS oldest message > 5 min, ECS CPU > 80%) is a **CloudWatch Alarm that must be created**. Alarms do not exist by default; one `AWS::CloudWatch::Alarm` per rule belongs in the Step 4 template.

### Read path
Monitoring Agent → CloudWatch MCP → `GetMetricData` (sparklines), `DescribeAlarms` (alert lane), `FilterLogEvents` (log panel), all via the read-only assumed role (`cloudwatch:*` / `logs:*` granted at Step 4). Cadence: 60s health, 5min metrics, 24h cost.

### Refinement — push the alert lane
Polling `DescribeAlarms` every 60s is wasteful for alerts. The cleaner pattern is **CloudWatch Alarm → SNS → push** to the backend, so alarm state changes arrive as events while polling is reserved for the metric sparklines. This also gives a ready-made event stream for post-MVP one-click remediation.

---

## 9. Context Engineering

Each agent's context window is deliberately composed, not accumulated. The governing rule: **context boundaries mirror trust boundaries** — an agent sees the minimum it needs to do its job, and what is *excluded* is as load-bearing as what is included. Untrusted repo content, AWS credentials, and secret values each have a defined containment scope.

### 9.1 The four context layers
Every agent's window is assembled from four layers, in order of stability:

1. **Static instructional context (system prompt).** The agent's role, its hard constraints, and its output contract. Stable across all sessions, authored once. Example: the Canvas Reasoning Agent's prompt carries the bounded operation set and the "one mutation OR one answer, never both" rule (the `aws_service` enum per node type lives in the shared `canvas_core` constraints the backend enforces on commit).
2. **Tool context.** Only the MCP tool schemas that agent is permitted, scoped by the Gateway. This is a context-level control, not just an auth one: the Repo Recon Agent's context literally cannot name an AWS-mutating tool, so the model cannot be talked into calling one — the schema isn't there.
3. **Retrieved long-term context.** The structured records (Section 9.2) pulled from AgentCore Memory by `project_id` at session start. Each agent loads only the records it needs, not the whole project history.
4. **Working short-term context.** The live turn-by-turn state managed by the Strands session manager — the current conversation, uncommitted proposals, the in-flight event stream.

### 9.2 Structured records as the context interchange format
Agents do not pass freeform prose to each other. They read and write **typed records** — `detected-resources`, `env-var`, `intent`, `canvas.yml`, `stack-outputs` — in JSON/YAML. This is deliberate:
- **Cheap and deterministic to parse** — no re-interpretation of natural language at each hop, no token bloat from narrative.
- **Unambiguous at handoff** — the Step 4 agent reads `intent.criticality = high` as a field, not by re-reading a conversation.
- **The unit of memory persistence** — a record is what gets consolidated into long-term memory, so the context format and the storage format are the same thing.

The records are the contract. When Step 1 records `DB_PASSWORD` as a key the code reads, that string is what Step 4 must inject — the record removes the chance of paraphrase drift between agents.

### 9.3 Per-agent context budget
What each agent holds in-context, loads on demand, and is denied:

| Agent | Always in context | Loaded on demand | Deliberately excluded |
| --- | --- | --- | --- |
| Orchestrator | current step, completion flags, `project_id`, **pointers** to records | — | record payloads (holds references, not contents) |
| Repo Recon (1) | role + rules, GitHub tool schema, framework matrix, Pass-1 checklist | individual repo files (Pass 2/3, only when flagged) | any AWS tool schema, AWS credentials, downstream records |
| Intent (2) | role + rules, the `detected-resources` record | — | MCP tools (none), raw repo content |
| Canvas Reasoning (3) | role + constraints, `canvas.yml` semantic state, `intent` record | a service's doc/pricing via MCP, only when explaining/validating that service | node coordinates, layout math, AWS credentials |
| Canvas commit (backend `canvas_core`, not an agent) | the bounded-op set + `aws_service` enum + layout solver | the current node/edge graph + coordinates at apply time | the conversation, MCP tools, an LLM |
| Provisioning (4) | role + rules, finalized `canvas.yml` + `intent` + `env-var` records, CFN/IaC + AWS API tool schemas | resource schemas + pricing via MCP, the live CFN event stream | **raw repo content** (only distilled records), secret *values*, persisted credentials |
| Monitoring (5) | role + rules, `stack-outputs` (ARNs), alert-rule table, CloudWatch tool schema | metric/alarm/log queries per poll | AWS write tools, repo content, intent reasoning |

### 9.4 Handoff context — what crosses agent boundaries
Cross-agent calls (Strands A2A) carry the smallest sufficient payload:
- **Orchestrator → specialist:** `project_id` + the step's input pointer. The orchestrator passes references, never the record bodies, so its own window stays small across the whole lifecycle.
- **Reasoning → backend commit (intra-Step 3):** exactly the proposed `{operation}`, applied only after user confirmation. The deterministic `canvas_core` commit step never receives the conversation that produced the op — it doesn't need the "why," only the "what."
- **Specialist → Orchestrator:** a success/block signal plus the `project_id` of the record just written, not the record itself.

### 9.5 Context isolation and the trust boundary
This is the most important control. Raw repo content — untrusted, potentially carrying prompt-injection payloads — is confined to the Repo Recon Agent's context and **never propagates**. What leaves Step 1 is the *distilled, validated record set*, not file contents. By the time anything reaches the Provisioning Agent (the only agent with AWS mutation authority), it has been reduced to typed fields that cannot carry an injection instruction in a form the downstream agent will execute. The trust boundary is therefore enforced twice: once at the tool layer (Repo Recon has no AWS tools) and once at the context layer (Provisioning never ingests raw repo text).

Two corollaries:
- **Credentials are never placed in any context that is persisted.** Assumed-role credentials live only in the Provisioning Agent's short-term session window and expire with it.
- **Secret values bypass agent context entirely.** They flow from the user straight to Secrets Manager; only the key→ARN map enters context. No agent ever holds a secret value in its window.

### 9.6 Long-horizon context management
Provisioning and monitoring sessions run long (up to the 8-hour Runtime window), so their contexts are actively managed rather than allowed to grow unbounded:
- **CFN event stream (Step 4):** summarized as it grows — a rolling summary plus the last *N* raw events — rather than retaining every event verbatim. The full log persists to long-term memory; the context holds the digest.
- **Memory consolidation:** AgentCore Memory extracts durable facts from session events into long-term strategies (e.g. "this user prefers Fargate"), so the next session starts with consolidated preferences rather than replaying old transcripts.
- **Polling snapshots (Step 5):** each poll **overwrites** the previous snapshot in short-term context rather than accumulating; only state *changes* and translated alerts append to the 30-day history in long-term memory.

### 9.7 Retrieval discipline
Reference knowledge is pulled on demand, never preloaded. The Canvas Reasoning Agent does not hold the AWS documentation corpus in context — it retrieves a single service's doc via the Docs MCP only at the moment it explains or validates that service, then drops it. Pricing is fetched per proposed change, not preloaded for every service. This keeps the working window small and current, and is why the reusable MCP servers (rather than a hand-ingested doc store) are the right substrate: retrieval is a tool call, not a context-resident blob.

---

## 10. Per-Step Agent Spec Cards

A single-glance anatomy of each agent: the static system-prompt essence, what sits in-context, which tools it may call, its two memory tiers, and its workflow. Together with Section 4's consolidated memory table, this is the build reference.

### Step 1 — Repo Recon Agent  *(untrusted-input zone · no AWS write)*
- **System prompt:** detection rules, framework support matrix, the "deterministic first, model only on ambiguity" mandate, output contract for the three records.
- **In-context:** repo URL/branch, Pass-1 file-tree checklist.
- **Tools:** GitHub MCP only.
- **STM:** scan working set (file tree, ambiguity flags driving Pass 3).
- **LTM:** `detected-resources` record, `env-var` record, draft `canvas.yml` (incl. worker→db/cache edges).
- **Excluded:** AWS tools, credentials, downstream records.
- **Workflow:** 1) connect GitHub → 2) run 3-pass Detection Swarm → 3) apply deterministic rules → 4) draft canvas + Dockerfile PR → 5) signal gate (ok/block).

### Step 2 — Intent Agent
- **System prompt:** the question→infrastructure mapping table, the "suppress already-answered questions" rule, one-question-at-a-time conversational style.
- **In-context:** the `detected-resources` record.
- **Tools:** none (pure reasoning).
- **STM:** answers gathered so far this session.
- **LTM:** `intent` record; cross-project user preferences.
- **Excluded:** MCP tools, raw repo content.
- **Workflow:** 1) load Step 1 record → 2) compute unanswered questions → 3) ask one at a time (apply preference defaults) → 4) write intent + update canvas.

### Step 3 — Canvas Reasoning Agent
- **System prompt:** the bounded operation set, the hard constraints (no backend removal, no networking nodes, can't trigger Step 4), the "one mutation OR one answer, never both" rule.
- **In-context:** `canvas.yml` semantic state, `intent` record.
- **Tools:** Pricing MCP, AWS Docs MCP, CFN/IaC MCP.
- **STM:** editing conversation, uncommitted proposal awaiting confirmation.
- **LTM:** none directly (reads intent + canvas).
- **Excluded:** node coordinates, layout math, credentials.
- **Workflow:** 1) load canvas + intent, render cost panel → 2) classify each prompt (mutation vs answer) → 3) validate target + state cost delta → 4) on a mutation, propose `{operation}`; the backend applies + commits it on user confirmation.

### Step 3 — Canvas placement & commit  *(deterministic `canvas_core` in the backend — not an agent)*
- **What it is:** the `aws_service` enum per node type, collision-free placement, arrow re-routing, and the bounded-op executor — all pure `canvas_core` run by the Django backend (the system of record), with no LLM and no MCP tools.
- **In-context:** the current node/edge graph + coordinates at apply time.
- **Persists:** versioned `canvas.yml` snapshots in Postgres (one per confirmed mutation).
- **Excluded:** the conversation, cost reasoning, MCP tools, a model.
- **Workflow:** 1) receive the confirmed op (Reasoning's proposal) → 2) compute collision-free coordinates → 3) re-route affected arrows → 4) apply op to `canvas.yml`, append + persist a version.

### Step 4 — Provisioning Agent  *(AWS mutation authority)*
- **System prompt:** template-centric generation rules, the build-and-push ordering, env-var parity check, re-provision change-set safety rules, observability-resource requirements.
- **In-context:** finalized `canvas.yml`, `intent` record, `env-var` record. Distilled records only — never raw repo content.
- **Tools:** CFN/IaC MCP, AWS API MCP, Pricing MCP.
- **STM:** live CFN event stream (digested), change-set preview awaiting confirmation; assumed credentials (session-only).
- **LTM:** `stack-outputs` (URLs, ARNs), provisioning log, Secrets Manager key→ARN map.
- **Excluded:** raw repo content, secret values, persisted credentials.
- **Workflow:** 1) AssumeRole bootstrap → 2) collect secrets → Secrets Manager + verify env-var parity → 3) author one CFN template (incl. alarms, Container Insights, log config) + Checkov + render review → 4) build & push images/assets, then `CreateStack`/change-set → 5) write outputs, enable Step 5.

### Step 5 — Monitoring Agent  *(read-only)*
- **System prompt:** the alert-translation rule table, polling cadences, plain-English metric translation, read-only mandate.
- **In-context:** `stack-outputs` (ARNs), alert-rule table.
- **Tools:** CloudWatch MCP, Cost Explorer MCP.
- **STM:** latest poll snapshot (overwritten each poll).
- **LTM:** 30-day alert history (state changes only).
- **Excluded:** AWS write tools, repo content, intent reasoning.
- **Workflow:** 1) load stack ARNs → 2) poll (60s health / 5min metrics / 24h cost) → 3) translate alarms to plain English, append history → 4) serve detail panels on demand.
