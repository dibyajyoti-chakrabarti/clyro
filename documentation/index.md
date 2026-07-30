# Clyro — Engineering Handbook

This is the single canonical source of truth for how Clyro is built, deployed, and
operated. It is written as a book: read it start to finish if you're new, or jump to the
chapter you need.

## Table of contents

| # | Chapter | What it covers |
|---|---|---|
| 1 | [Introduction](ch_1_introduction.md) | What Clyro is, the monorepo map, how to use this book |
| 2 | [System Architecture](ch_2_system_architecture.md) | The core application components, AWS environment, and architecture |
| 3 | [Deterministic Provisioning](ch_3_deterministic_provisioning.md) | How the `cfn_generator` generates CFN deterministically without LLM mistakes |
| 4 | [Frontend & Canvas](ch_4_frontend_and_canvas.md) | The React/Vite frontend, wizard flow, and Monaco code editor |
| 5 | [Backend, Celery & Agents](ch_5_backend_and_celery.md) | The Django REST API, async task workers, and AI agents |
| 6 | [Infrastructure & Deployment](ch_6_infrastructure_and_deployment.md) | Terraform foundation vs workloads, how to deploy Clyro itself |
| 7 | [Local Development](ch_7_local_development.md) | Docker Compose bring-up, ports, testing, and E2E setup |
| 8 | [Wizard Step 1: Connect](ch_8_wizard_step_1_connect.md) | GitHub repository connection and metadata sync |
| 9 | [Wizard Step 2: Configure](ch_9_wizard_step_2_configure.md) | Environment variables and secret injection |
| 10 | [Wizard Step 3: Canvas](ch_10_wizard_step_3_canvas.md) | Chatting with CryloCanvas to define the architecture spec |
| 11 | [Wizard Step 4: Deploy](ch_11_wizard_step_4_deploy.md) | Reviewing the IaC and live provisioning |
| 12 | [Wizard Step 5: Manage](ch_12_wizard_step_5_manage.md) | Ongoing operations, metrics, and teardown |
| 13 | [Deterministic IaC Mechanism](ch_13_deterministic_iac_mechanism.md) | Detailed deep dive into the optimization and CFN generator design |
| 14 | [Agentic Network Design](ch_14_agentic_network_design.md) | Theoretical architecture of the multi-agent design |
| 15 | [Hardening and Latency Plan](ch_15_hardening_and_latency_plan.md) | Planning document for E2E improvements |
| 16 | [E2E Latency Report](ch_16_e2e_latency_report.md) | Latency metrics and analysis of the wizard flow |
| 17 | [E2E Hardening Report](ch_17_e2e_hardening_report.md) | Hardening test results post-optimization |
| 18 | [IAM Least-Privilege Review](ch_18_iam_least_privilege_review.md) | Recurring audit of generated customer roles and ClyroProvisioningRole |
| 19 | [Audit Remediation & Prod Verification Report](ch_19_audit_remediation_and_prod_verification.md) | Full audit close-out, production deploy, and live E2E verification against clyro.cloud |
| 20 | [Step 1 Revamp: Offline Scan Contract](ch_20_offline_scan_contract_plan.md) | Replacing the live repo scan with an offline agent that writes a CLYRO.md contract |

## Repo layout at a glance

```text
documentation/     ← you are here (this book)
frontend/          ← the React/Vite web application
backend/           ← the Django API and Celery workers
backend/skills/    ← offline agent skills we serve to users (clyro-scan)
infrastructure/    ← the Terraform code (foundation and workloads)
scripts/           ← utility scripts for database/deployment
```
