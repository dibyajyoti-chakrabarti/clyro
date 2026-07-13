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

## Repo layout at a glance

```text
documentation/     ← you are here (this book)
frontend/          ← the React/Vite web application
backend/           ← the Django API and Celery workers
infrastructure/    ← the Terraform code (foundation and workloads)
scripts/           ← utility scripts for database/deployment
```
