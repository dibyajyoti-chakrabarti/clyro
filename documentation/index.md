# Clyro Engineering Handbook

The canonical source of truth for how Clyro is built, deployed and operated. Read it
start to finish if you are new, or jump to the chapter you need.

> **The one thing to get straight first.** Two different systems are described in this
> book, and they share a vocabulary without sharing a design.
>
> - **Clyro's own platform** runs on a single `t4g.small` EC2 instance: postgres, redis,
>   uvicorn, celery and nginx in docker compose, plus two static SPAs on S3 and
>   CloudFront. It has no ECS, no Lambda serving the API, no RDS, no SQS and no load
>   balancer. Chapter 6 is the authority.
> - **The stacks Clyro generates for its users** live in the *user's* AWS account and
>   do use ECS, RDS, SQS and, in some topologies, an ALB. Chapters 3, 11 and 13 are the
>   authority.
>
> A mention of Fargate or RDS is almost always the second system.

## Table of contents

| # | Chapter | What it covers |
|---|---|---|
| 1 | [Introduction](ch_1_introduction.md) | What Clyro is, the two systems, the monorepo map |
| 2 | [System Architecture](ch_2_system_architecture.md) | Client plane, control plane, agentic layer, the cross-account model |
| 3 | [Deterministic Provisioning](ch_3_deterministic_provisioning.md) | How `cfn_generator.py` authors CloudFormation from a spec, without an LLM |
| 4 | [Frontend & Canvas](ch_4_frontend_and_canvas.md) | The two React SPAs, the seven-step wizard, the Playwright suite |
| 5 | [Backend, Celery & Agents](ch_5_backend_and_celery.md) | Django on uvicorn, the Celery tasks and schedule, the two AgentCore runtimes |
| 6 | [Infrastructure & Deployment](ch_6_infrastructure_and_deployment.md) | The one box, what surrounds it, the two Terraform layers, the deploy workflows |
| 7 | [Local Development](ch_7_local_development.md) | Docker Compose bring-up, ports, E2E setup |
| 8 | [Step 1: Connect & Contract](ch_8_wizard_step_1_connect.md) | GitHub connection, ingesting `CLYRO.md`, compliance, secret staging |
| 9 | [Step 3: Tell us about your app](ch_9_wizard_step_2_configure.md) | The intent questions and what each one decides |
| 10 | [Step 4: Review your architecture](ch_10_wizard_step_3_canvas.md) | The canvas, the reasoning agent, deterministic placement and cost |
| 11 | [Steps 2, 5 and 6: AWS, IaC and provisioning](ch_11_wizard_step_4_deploy.md) | Connecting the account, generating the template, and the provisioning order |
| 12 | [Step 7: Your infrastructure is live](ch_12_wizard_step_5_manage.md) | Health, metrics, logs, cost, teardown |
| 13 | [Deterministic IaC Mechanism](ch_13_deterministic_iac_mechanism.md) | Deep dive on the generator and the latency work behind it |
| 14 | [Agentic Network Design](ch_14_agentic_network_design.md) | The agent network **as designed**. Most of it was not built; read its header first |
| 15 | [Hardening and Latency Plan](ch_15_hardening_and_latency_plan.md) | Historical, 2026-07-08 |
| 16 | [E2E Latency Report](ch_16_e2e_latency_report.md) | Historical, 2026-07-08 |
| 17 | [E2E Hardening Report](ch_17_e2e_hardening_report.md) | Historical, 2026-07-09 |
| 18 | [IAM Least-Privilege Review](ch_18_iam_least_privilege_review.md) | Historical, approximately 2026-08 |
| 19 | [Audit Remediation & Prod Verification](ch_19_audit_remediation_and_prod_verification.md) | Historical, approximately 2026-08. Describes the **previous** platform architecture |
| 20 | [Step 1 Revamp: Offline Scan Contract](ch_20_offline_scan_contract_plan.md) | The plan behind Chapter 8. Delivered |

Chapters 15 to 19 are dated point-in-time records. Their findings are deliberately not
rewritten to match today, because that would falsify the record. Each opens with a note
saying what has changed since.

The wizard chapter filenames use an older five-step numbering and are kept as they are so
existing links keep working. The titles above give the step each one actually describes.

## Repo layout

```text
documentation/     this book
frontend/          the main React/Vite SPA
frontend-admin/    the admin SPA, a separate bundle and origin
backend/           the Django API and Celery workers
backend/agents/    the two Bedrock AgentCore runtimes
backend/canvas_core/  the deterministic canvas layer
backend/mcp/       the three MCP tool Lambdas
backend/skills/    the offline agent skill served to users (clyro-scan)
backend/cfn-templates/  bootstrap.yaml, the cross-account connector stack
infrastructure/    Terraform: bootstrap (hand-applied) and foundation (CI-applied)
audit/             standing audit checklists
graphify-out/      the generated knowledge graph
```
