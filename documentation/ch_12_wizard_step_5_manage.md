**Crylo — Step 5: Monitoring Dashboard (Final Documentation)**

**Implementation status (2026-07-14):** Everything below is the target design. What's actually live today is a smaller first cut, built this session (previously this whole step was empty TODO stubs — `StepFive.jsx` held `useState([])` with no fetch behind it, `HealthOverview` showed a permanent "Waiting for the first health check to report…", and `MetricsGrid` was four hardcoded `'—'` placeholders):

- **Live now**: `GET /api/projects/<pk>/deploy/health/` (`app/provisioning/deploy.py::health()`, `app/provisioning/views.py::deploy_health`), polled every 20s from `StepFive.jsx`.
  - Health overview (§5.1): real ECS service status (running/desired task counts) and ALB target health per service, sourced via `aws_client.describe_ecs_service`/`describe_target_health` — not CloudWatch alarms as originally scoped.
  - Key metrics (§5.2): only 4 of the many described here — ALB `TargetResponseTime`, `RequestCount` (→ req/min), `HTTPCode_Target_5XX_Count` (→ error rate), ECS `CPUUtilization` for the serving backend. No sparklines/trends, no Memory/DB/Cache/Queue metrics.
  - Stack-gone detection: if the ECS/ALB resources can't be found (stack torn down outside Clyro), the endpoint returns `stack_status: "not_found"` and the UI shows an honest "infrastructure could not be found" message instead of hanging on the waiting state forever.
  - `bootstrap.yaml` gained `cloudwatch:GetMetricData` (read-only) to support this. **Accounts whose bootstrap role was created before this change need to re-run the CFN quick-create to get real metrics** — until they do, the endpoint degrades gracefully (unavailable metrics render as `—`, not an error).
- **Not built yet** (still exactly as designed below, not started): Cost Explorer integration (§5.3, real spend data — cost UI still shows `—` placeholders), Resource Detail Panel (§5.4), CloudWatch-alarm-based Alerts (§5.5 — current alerts are just derived from unhealthy ECS/ALB state, no alarm translation table, no severity levels), CloudFormation Stack Status block (§5.6, `StackStatus` component exists but nothing populates it).

**Overview**

Step 5 is the operational home for the user's infrastructure after provisioning. It surfaces health, performance, and cost information pulled from AWS in plain English — no AWS console knowledge required. For MVP, the dashboard is read-only and observational. One-click remediation and agentic operations are post-MVP.

The dashboard is not a one-time screen. It is where the user returns after provisioning to check on their system. It is permanently accessible from the Crylo navigation after Step 4 completes.

**Data Sources**

All data is pulled from the user's AWS account via the same assumed IAM role established in Step 4. No new permissions are required. The relevant AWS services Crylo reads from:

Amazon CloudWatch → health, metrics, alarms

AWS Cost Explorer → real spend data

Amazon ECS → task count, service status

Amazon RDS → instance status, storage

Amazon ElastiCache → cluster status, hit rate

AWS CloudFormation → stack status, drift detection (post-MVP)

Data is pulled on a polling interval — every 60 seconds for health status, every 5 minutes for metrics, every 24 hours for cost data. Real-time streaming is post-MVP.

**5.1 — Health Overview**

The top section of the dashboard. Answers one question immediately: **is my app healthy right now?**

Every provisioned resource is represented as a single status row. Status is derived from CloudWatch alarms and ECS/RDS service states.

Service Status Detail

──────────────────────────────────────────────────────────────

Django Backend ✅ Healthy 2 / 2 tasks running

React Frontend ✅ Healthy CloudFront serving

PostgreSQL Database ✅ Healthy Available

Redis Cache ✅ Healthy Available

Celery Worker ⚠️ Degraded 1 / 2 tasks running

SQS Queue ✅ Healthy Queue processing

Three possible states per resource:

✅ Healthy → All checks passing, running as expected

⚠️ Degraded → Partially available, reduced capacity

❌ Unhealthy → Down or critically failing

Status labels and detail text are always plain English. No CloudWatch metric names, no ARNs, no AWS-specific terminology in the UI.

Clicking any row opens a resource detail panel — covered in 5.4.

**5.2 — Key Metrics**

Below the health overview. A small set of metrics that tell a meaningful story about application behaviour. Shown as sparkline graphs with a current value and a 24-hour trend. Switchable to 7 days or 30 days.

Only metrics a developer can act on are shown. Metrics that require AWS expertise to interpret are excluded.

**API Performance**

Sourced from ALB CloudWatch metrics.

Response Time p50: 120ms p95: 340ms p99: 890ms

Request Rate 243 req/min current

Error Rate 0.3% last 24 hours (4xx + 5xx combined)

**Compute**

Sourced from ECS CloudWatch metrics.

Backend CPU Usage 34% average last hour

Backend Memory Usage 61% average last hour

Worker CPU Usage 12% average last hour

**Database**

Sourced from RDS CloudWatch metrics.

Database CPU 24% current

Active Connections 18 current

Free Storage 42GB current

A low storage warning is surfaced proactively when free storage drops below 20%:

⚠️ *"Your database is using 80% of its allocated storage. Consider increasing storage before it runs out."*

**Cache**

Sourced from ElastiCache CloudWatch metrics.

Cache Hit Rate 87% last hour

Cache CPU 8% current

**Queue**

Sourced from SQS CloudWatch metrics.

Messages In Queue 0 current

Oldest Message Age 0s current

A queue depth warning is surfaced when messages are backing up:

⚠️ *"Your task queue has 1,240 unprocessed messages and the oldest is 8 minutes old. Your Celery workers may not be keeping up."*

**5.3 — Cost**

Sourced from AWS Cost Explorer via the assumed role. This is real spend data from the user's AWS account — not estimates.

This month so far $67.40

Projected this month $124.00 based on current daily spend rate

Last month $118.43

Cost breakdown:

RDS PostgreSQL $45.20 36%

ECS Fargate (backend) $34.10 27%

ECS Fargate (worker) $18.40 15%

ElastiCache $16.00 13%

ALB $6.20 5%

S3 + CloudFront $3.10 2%

SQS + ECR $1.40 1%

─────────────────────────────────────────

Total so far $124.40

The projection is a simple linear extrapolation from daily spend rate — not a sophisticated model. If the current month is 15 days in and $67.40 has been spent, the projection is $134.80. Clearly labelled as an estimate.

No cost anomaly detection for MVP. Post-MVP.

**5.4 — Resource Detail Panel**

Clicking any row in the health overview opens a slide-out detail panel for that resource. This replaces the need to open the AWS console for the most common operational checks.

**ECS Service panel (backend or worker)**

Status Healthy

Running tasks 2 / 2

Task definition invoiceapp-prod-backend:7

Last deployment 2 hours ago

CPU (last hour) 34% avg

Memory (last hour) 61% avg

Recent logs [last 20 log lines from CloudWatch Logs]

Log lines are shown as-is from CloudWatch Logs. No translation for MVP — raw application logs. The developer wrote these logs so they can read them.

**RDS panel**

Status Available

Engine PostgreSQL 15.3

Instance class db.t3.medium

Multi-AZ Enabled

CPU (last hour) 24% avg

Connections 18 active

Free storage 42 GB remaining

Last backup Today at 03:00 UTC (automatic)

**ElastiCache panel**

Status Available

Engine Redis 7.0

Node type cache.t3.small

Hit rate 87% last hour

CPU 8% current

Evictions 0 last hour

**SQS panel**

Status Active

Messages in queue 0

In-flight messages 0

Oldest message N/A

Messages processed 1,243 last 24 hours

**5.5 — Alerts**

Alerts are translated CloudWatch alarms surfaced in plain English. They appear as a notification banner at the top of the dashboard and as a persistent alerts list below the metrics section.

For MVP, alerts are informational only. No one-click remediation — that is post-MVP.

**Alert translation rules**

Each CloudWatch alarm maps to a plain English message:

ECS service running below desired task count

→ "Your Django backend is running 1 of 2 expected tasks.

Performance may be degraded."

RDS CPU above 80% for 5 minutes

→ "Your database CPU is unusually high. This may slow down

your application. Check for heavy queries or unexpected traffic."

RDS free storage below 20%

→ "Your database is running low on storage. Consider increasing

the allocated storage to avoid downtime."

ALB 5xx error rate above 1% for 5 minutes

→ "Your API is returning server errors to more than 1% of requests

in the last 5 minutes. Check your application logs."

ElastiCache evictions above 0 for 10 minutes

→ "Your Redis cache is evicting data due to memory pressure.

Cached items are being removed before they expire."

SQS oldest message age above 5 minutes

→ "Background tasks are backing up. Your oldest queued task

has been waiting 8 minutes. Your workers may need attention."

ECS CPU above 80% for 10 minutes

→ "Your backend is under heavy CPU load. If this continues,

response times may increase."

Alerts have three severity levels:

🔴 Critical → service down, storage full, majority of tasks failing

🟡 Warning → degraded performance, approaching limits

🔵 Info → notable events, deployments completed

All alerts are stored in the database with timestamps. Alert history is viewable for the last 30 days.

**5.6 — CloudFormation Stack Status**

A minimal section at the bottom of the dashboard showing the status of the provisioned CloudFormation stack.

Stack name invoiceapp-prod

Stack status ✅ CREATE\_COMPLETE

Last updated Jan 15, 2024 at 14:32 UTC

Stack version 1 (initial provision)

For MVP this is read-only. It tells the user that their infrastructure is intact and was last modified at a known time. If the stack status is anything other than CREATE\_COMPLETE or UPDATE\_COMPLETE, a warning is surfaced prominently.

**5.7 — What the Dashboard Does Not Do (MVP)**

These are explicitly out of scope for MVP and should not be built until the core dashboard is stable:

One-click remediation actions → post-MVP

Restart ECS task from dashboard → post-MVP

Canvas live status overlay → post-MVP

Log search and filtering → post-MVP

Custom alert thresholds → post-MVP

Multi-environment side-by-side → post-MVP

Cost anomaly detection → post-MVP

Deployment history → post-MVP

Infrastructure drift detection → post-MVP

Auto-scaling configuration → post-MVP

**5.8 — IAM Permissions for Monitoring**

No new IAM permissions are required beyond what was granted in Step 4. The bootstrap role already includes cloudwatch:\* and logs:\*. The only addition needed is Cost Explorer read access which should be added to the bootstrap template:

ce:GetCostAndUsage

ce:GetCostForecast

These are read-only Cost Explorer permissions. They do not grant access to billing settings or payment methods.

**Step 5 Outputs**

Step 5 has no pipeline outputs — it is the end of the user flow. It is a persistent operational view, not a step with a completion state.

| **Feature** | **Data Source** | **Refresh Rate** |
| --- | --- | --- |
| Health status | CloudWatch + ECS + RDS | 60 seconds |
| Metrics | CloudWatch | 5 minutes |
| Cost data | AWS Cost Explorer | 24 hours |
| Alerts | CloudWatch Alarms | 60 seconds |
| Stack status | CloudFormation | 5 minutes |
| Resource logs | CloudWatch Logs | On panel open |

**5.9 — Delete Project (2026-07-14, new)**

Distinct from infrastructure teardown (§5.6/Step 4's "Delete infrastructure" — which only destroys the CloudFormation stack). Delete Project removes the `Project` row itself from Clyro's dashboard, available via a trash icon on each project card (`frontend/src/components/projects/ProjectCard.jsx`, wired through `frontend/src/pages/app/Projects.jsx`).

Backend: `DELETE /api/projects/<pk>/` (`app/views.py::project_detail`). If the project has a deployment with real AWS resources, this first calls the same teardown path as §5.6 (`deploy.teardown()`) and returns `202 {"status": "tearing_down"}` — the client re-sends the delete once teardown finishes (poll-and-retry, same convention as pause/resume/teardown elsewhere). Once there's nothing live to tear down, the row (and its `Deployment`s) are hard-deleted.

This gives users a way to clear out stale/failed test projects that previously had no removal path and accumulated on the dashboard indefinitely. Note this is a manual action, not automatic reconciliation — `Project.status` still has no periodic background check against real AWS state (see the deterministic-vs-LLM TODO for the related gap: a torn-down-outside-Clyro project still shows "Live" until someone opens Step 5, which now at least surfaces the real state instead of hanging forever, or until someone deletes it manually).

**The Complete Crylo User Flow**

With Step 5 documented, the full flow is:

Step 1 Repository Connection & Analysis

Connect GitHub → scan repo → detect resources → store in DB

Step 2 Intent Collection

7 questions → understand scale, criticality, environment → store intent

Step 3 Canvas

Visualize architecture → refine with AI agent → cost estimate → finalize

Step 4 Pre-Provision, IaC Generation & Provisioning

Connect AWS → collect secrets → generate CF template → provision → live URL

Step 5 Monitoring Dashboard

Health → metrics → cost → alerts → operational visibility

The user starts with a GitHub repo and ends with a running, monitored production system — having made no AWS decisions beyond the ones Crylo surfaced to them deliberately.
