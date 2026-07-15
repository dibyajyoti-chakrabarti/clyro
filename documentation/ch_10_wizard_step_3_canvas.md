**Crylo — Step 3: Canvas (Final Documentation)**

**Overview**

Step 3 is the interactive architecture canvas. It takes the confirmed canvas.yml from Step 2 and renders it as a visual, editable architecture diagram. A canvas-specific AI agent accepts natural language prompts to mutate the architecture, suggest alternatives, explain tradeoffs, and predict monthly AWS costs.

The user stays in Step 3 until they explicitly finalize. The finalized canvas.yml — combined with the intent record from Step 2 — is the complete input to Step 4.

**Inputs to Step 3**

| **Input** | **Source** | **Used For** |
| --- | --- | --- |
| canvas.yml | Step 2 output | Rendering the diagram |
| Intent record | Step 2 DB | Agent context, cost prediction |
| Detected resources record | Step 1 DB | Agent context only |

**3.1 — Canvas Rendering**

On entry to Step 3, Crylo renders the canvas.yml as an interactive visual diagram. Every node becomes a visual card. Every connection becomes a directed arrow. The user sees their architecture, not a YAML file.

**Node card displays:**

* Service label (e.g. "Django Backend")
* Node type icon
* AWS service badge (e.g. "ECS Fargate", "RDS PostgreSQL")
* A subtle indicator if the node was auto-detected vs manually added

**Connection displays:**

* Directed arrow between nodes
* Connection label (e.g. "REST API", "reads/writes")

**Canvas state indicators:**

* Unsaved changes indicator when canvas differs from last saved canvas.yml
* Cost estimate panel — always visible, updates in real time as canvas changes
* Finalize button — disabled until canvas has been in a stable state for at least one interaction

**3.2 — The Canvas Agent**

The canvas agent is a separate, scoped AI agent. It has read/write access to canvas.yml and read-only access to the intent and resource records from Steps 1 and 2. It cannot touch any other part of the system.

Every user prompt to the canvas agent results in one of two outcomes — a canvas mutation or an answer. Never both at the same time. If the agent wants to suggest a change, it describes it and asks for confirmation before touching the canvas.

**Agent Operation Set**

The agent's complete action space. It operates exclusively within these operations:

ADD\_NODE → Add a new resource node to the canvas

REMOVE\_NODE → Remove an existing node and its connections

UPDATE\_NODE → Change the aws\_service on an existing node

ADD\_CONNECTION → Add a connection between two existing nodes

REMOVE\_CONNECTION → Remove a connection between two nodes

EXPLAIN → Explain what a node or service is in plain English

SUGGEST → Propose an architectural alternative given context

COMPARE → Compare two AWS service options for a given node

ESTIMATE\_COST → Recalculate and explain the cost estimate

The agent never edits YAML directly in the UI. It issues structured operations against canvas.yml internally and the canvas re-renders after each confirmed mutation.

**Agent Context**

The agent always has access to:

* Current canvas.yml state
* intent.scale — small, medium, large
* intent.criticality — low, medium, high
* intent.environment — production, staging, development
* intent.description — what the app does
* Detected framework and infrastructure from Step 1

This context makes the agent's suggestions specific to the user's actual situation, not generic AWS advice.

**Prompt Examples and Agent Behavior**

*Changing a service:*

User: "Use Aurora instead of RDS"

Agent confirms the current node, explains the tradeoff briefly, asks for confirmation:

"Aurora PostgreSQL offers better read performance and automatic failover, but costs roughly 2.5x more than RDS for your expected scale. Want me to make the switch? Your estimated monthly cost will go from $45 to $112."

User confirms → UPDATE\_NODE db aws\_service: aurora\_postgres → canvas re-renders → cost updates.

*Switching compute:*

User: "Move the backend to EC2 instead of ECS Fargate"

"EC2 gives you more control and can be cheaper at sustained load, but you'll manage OS updates and scaling yourself. For your current scale (small, single environment) Fargate is probably simpler. Still want to switch?"

*Adding a node:*

User: "Add a CDN in front of the frontend"

"Your React frontend already uses S3 + CloudFront, which includes a CDN. CloudFront is the CDN layer — it's already there. Want me to make it more visible on the canvas as a separate node?"

This demonstrates the agent using context to avoid redundant changes.

*Removing a node:*

User: "Remove the Redis cache"

"Your Django settings use Redis for caching. Removing it means cache calls will fall back to your database, which may affect performance. Still want to remove it?"

User confirms → REMOVE\_NODE cache + REMOVE\_CONNECTION backend→cache → canvas re-renders → cost updates.

*Asking for suggestions:*

User: "Is there a better architecture for a SaaS product expecting 10k users?"

Agent reads intent (current scale: small) and responds:

"For 10k users, a few things are worth considering given your current setup:

1. Aurora PostgreSQL over RDS — read performance improves significantly at this scale
2. Increase ECS task count — your current config runs 1 task, 10k users warrants at least 2 with autoscaling
3. Add a CloudFront layer for your API — reduces latency for geographically distributed users

Want me to apply any of these?"

Each suggestion is a numbered, actionable item. Agent waits for the user to pick one before making any change.

*Asking for a comparison:*

User: "What's the difference between ECS Fargate and EC2 for my backend?"

Agent answers without mutating anything:

"ECS Fargate: AWS manages the underlying servers. You define the container, AWS runs it. No patching, no capacity planning. You pay per vCPU and memory used.

EC2: You pick the server size, AWS runs the VM. You manage OS updates, handle capacity yourself. Cheaper at high, sustained load but more operational overhead.

For your scale (small, production) and criticality (high), Fargate is the better fit — less to manage, and the cost difference at small scale is minimal (~$8/month)."

**Agent Hard Constraints**

The agent cannot perform the following regardless of how the user prompts:

* Add node types outside the supported set (service, static, database, cache, worker, queue, storage)
* Add networking nodes — ALB, VPC, subnets, security groups are IaC concerns only
* Change image: ecr on service or worker nodes — containerization is standardized and non-negotiable
* Remove the backend node — every Crylo project has a backend
* Add AWS services outside the supported aws\_service enum for each type
* Trigger IaC generation — that is Step 4, initiated only by the Finalize button
* Access or modify the intent record or detected resources record

If a user prompt would violate any constraint, the agent explains why clearly and offers an alternative if one exists.

**3.3 — Cost Estimation**

Cost estimation is a first-class feature of the canvas, not an afterthought. It is always visible, always current, and always honest about its assumptions.

**Display**

A cost panel is permanently visible on the canvas. It shows:

Estimated monthly cost: $127/month

Based on:

ECS Fargate (backend) $34/month

ECS Fargate (worker) $18/month

RDS PostgreSQL $45/month

ElastiCache Redis $16/month

S3 + CloudFront $8/month

SQS $2/month

ECR storage $4/month

─────────────────────────────────

Total $127/month

Assumptions:

→ 730 hours/month (24/7 uptime)

→ us-east-1 pricing

→ Prices exclude data transfer costs

→ Free tier not applied

Every line item is shown. No black box totals. Assumptions are always listed below the breakdown.

The estimate updates in real time whenever the canvas changes — node added, node removed, service changed.

**Estimation Logic**

Cost estimation is deterministic, not AI-generated. It uses a pricing model built from AWS public pricing, updated periodically. The agent does not guess costs — it calculates them from a known pricing table.

Inputs to the cost calculation:

canvas.yml → which resources exist

intent.scale → instance size tier per resource

intent.environment → affects instance sizing overrides

intent.criticality → affects multi-AZ (doubles RDS cost if enabled)

Instance size mapping per scale tier:

Scale: solo

ECS Fargate → 0.25 vCPU, 0.5GB RAM

RDS → db.t3.micro

ElastiCache → cache.t3.micro

Scale: small

ECS Fargate → 0.5 vCPU, 1GB RAM

RDS → db.t3.small

ElastiCache → cache.t3.micro

Scale: medium

ECS Fargate → 1 vCPU, 2GB RAM

RDS → db.t3.medium

ElastiCache → cache.t3.small

Scale: large

ECS Fargate → 2 vCPU, 4GB RAM

RDS → db.r6g.large

ElastiCache → cache.r6g.large

Multi-AZ surcharge: applied to RDS and ElastiCache when intent.criticality: high. Doubles the instance cost for those resources.

**Custom Assumption Overrides**

The user can override the default 24/7 uptime assumption from the cost panel. This is important for dev and staging environments that only run during business hours.

Available overrides:

Uptime hours per day → default: 24

Days per week → default: 7

Operating hours → e.g. 9am–5pm Mon–Fri

Region → default: us-east-1

When overrides are active, the assumptions section clearly states them:

Assumptions:

→ 8 hours/day, 5 days/week (Mon–Fri 9am–5pm)

→ Effective monthly hours: 173

→ us-east-1 pricing

→ Prices exclude data transfer costs

The cost recalculates immediately on any override change.

**Cost on Agent Suggestions**

Whenever the agent proposes a change, it always includes the cost delta:

"Switching to Aurora PostgreSQL will increase your estimated

monthly cost from $127 to $194 (+$67/month)."

No suggestion is made without a cost impact statement. The user always knows what a change costs before confirming it.

**3.4 — Canvas Versioning**

Every confirmed mutation to the canvas creates a new version of canvas.yml stored in the database. This is lightweight — just a JSONB append with a timestamp and the operation that caused the change.

{

"project\_id": "uuid",

"version": 3,

"timestamp": "2024-01-01T12:34:00Z",

"operation": "UPDATE\_NODE",

"changed\_node": "db",

"previous\_value": "rds\_postgres",

"new\_value": "aurora\_postgres",

"canvas\_snapshot": { ... }

}

The user can see a simple change history in the UI and revert to any previous version. Reverting creates a new version — it does not overwrite history.

**3.5 — Finalize**

The user clicks **Finalize Architecture** when satisfied. This is the only way to exit Step 3 and proceed to Step 4.

On finalize:

* Current canvas.yml is snapshotted and marked status: finalized in the database
* Version number is locked
* Canvas becomes read-only — no further agent mutations permitted on this version
* Step 4 is triggered

If the user wants to edit after finalizing, they can click **Reopen Canvas**. This creates a new draft version and requires re-finalization before Step 4 can run again. Step 4 always uses the most recently finalized version.

**3.6 — What Step 3 Does Not Do**

* Does not ask for environment variable values — that is Step 4
* Does not generate CloudFormation — that is Step 4
* Does not modify the intent record from Step 2
* Does not modify the detected resources record from Step 1
* Does not handle networking resources on the canvas — ALB, VPC, subnets are Step 4 concerns
* Does not connect to AWS — no AWS calls are made in Step 3

**Step 3 Outputs**

| **Output** | **Location** | **Consumer** |
| --- | --- | --- |
| Finalized canvas.yml | Database (JSONB, versioned) | Step 4 |
| Version history | Database (JSONB) | Audit, revert |

Step 4 receives exactly two inputs: the finalized canvas.yml and the intent record from Step 2. Together they are complete and unambiguous.
