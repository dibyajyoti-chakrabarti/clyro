# Chapter 6: Infrastructure & Deployment

Clyro's own production infrastructure (not the customer infra the wizard generates) is
managed via Terraform, in `infrastructure/`. This chapter describes the architecture as
it actually runs today — an earlier version of this doc described a since-abandoned
ECS-Fargate-for-everything design; that never shipped. Backend is Lambda, frontend is
S3/CloudFront, and async work runs on a small dedicated ECS Fargate service.

## Two-layer Terraform, one remote state bucket per layer

1. **`infrastructure/foundation`** — rarely changes:
   - VPC, public/private-app/private-data subnets across 2 AZs (`modules/networking`)
   - A single stoppable NAT **EC2 instance** (Graviton, `modules/nat-instance`) for
     private-subnet egress — not a managed NAT Gateway, to keep cost near-zero when
     stopped overnight. Its AMI lookup is pinned via `lifecycle.ignore_changes` (see
     the note below) so routine applies don't try to replace it.
   - ECR repositories (`modules/ecr`) — `backend`, plus `mcp-pricing`/`mcp-cfn`/`mcp-docs`
   - Cognito user pool (`modules/cognito`)
   - Route53 hosted zone + ACM certs for `clyro.cloud` (`modules/route53`, `modules/acm`)
   - API Gateway (`modules/api_gateway`, HTTP API / apigatewayv2)
   - S3 + CloudFront for the frontend (`modules/frontend`)
   - IAM: `backend_lambda` execution role, GitHub Actions OIDC role, Secrets Manager
     secrets (DB password, Django secret key, GitHub App PEM)
2. **`infrastructure/workloads`** — the actual running services, applied more often:
   - RDS PostgreSQL (`modules/rds`, single instance, `db.t3.micro`)
   - The backend Lambda (`modules/lambda_backend`) — a container image built from
     `backend/Dockerfile.lambda`, fronted by API Gateway
   - The Celery worker + beat (`celery_worker.tf`, see below)

`workloads` reads `foundation`'s outputs via `data "terraform_remote_state"`
(`workloads/data.tf`, aliased as `local.f`) rather than Terraform module composition
across layers — the two are applied independently.

## Backend: Lambda, not ECS

The Django API runs as a single AWS Lambda function (`clyro-prod-backend`), packaged as
a container image (`backend/Dockerfile.lambda`), invoked directly by API Gateway
(`AWS_PROXY` integration, no VPC Link) via Mangum. It's VPC-attached (private app
subnets) so it can reach RDS.

## Async work: SQS + a small ECS Fargate service, not Redis/ElastiCache

Long-running agent invocations (repo scan, canvas chat, IaC generate/refine,
provisioning, recreate, build, warmup, and the AWS-state reconciliation sweep) run as
Celery tasks dispatched via `.delay()` from the Lambda. Until this was added, the
Lambda's environment had no `CELERY_BROKER_URL` at all — it silently fell back to
`settings.py`'s local-dev Redis default, a hostname that doesn't resolve inside the
Lambda's VPC, meaning every one of these paths was broken in production.

The fix (`infrastructure/workloads/celery_worker.tf`):
- An **SQS queue** (`clyro-prod-celery`) as the broker — cheaper than standing up
  ElastiCache, and this app doesn't need Celery's own result backend (`AgentJob` rows
  carry results/state directly; the result backend is set to `cache+memory://`, a
  process-local no-op).
- One small **ECS Fargate task** running **two containers** in a single task
  definition: `worker` (`celery -A config worker`) and `beat` (`celery -A config beat`,
  driving `CELERY_BEAT_SCHEDULE` — currently just the reconciliation sweep every 15
  min). One task rather than two separate always-on services, since beat only ever
  needs a single non-scaling replica.
- Both containers reuse the **same image** built for the Lambda
  (`Dockerfile.lambda`) rather than a second, separately-built image. That image's own
  `ENTRYPOINT` is `awslambdaric` (expects a Lambda handler path, not a shell command),
  so the ECS container definitions override `entryPoint` to run
  `backend/celery_entrypoint.py` instead — a small wrapper that replicates
  `lambda_handler.py`'s GitHub App PEM-to-`/tmp` write (the only other place that
  happens) before exec'ing the real `celery` command.
- IAM: the existing `backend_lambda` role gets `sqs:SendMessage`/`GetQueueUrl`/
  `GetQueueAttributes` (publish side); a new `celery-task` role gets
  `sqs:ReceiveMessage`/`DeleteMessage`/`GetQueueUrl`/`GetQueueAttributes`/
  `ChangeMessageVisibility` plus the same Bedrock/AgentCore/Cognito/SSM/CloudFormation
  permissions the Lambda's role already has (the worker runs the exact same
  task/view code, just off a queue instead of an HTTP request). Both roles also
  need `sqs:ListQueues` on `Resource: "*"` — found live: Kombu's SQS transport
  calls `list_queues(QueueNamePrefix=...)` on every connection (both publish and
  consume sides), and `ListQueues` has no resource-level ARN scoping in AWS's
  IAM model, unlike every other SQS action here.
- Network: the ECS task shares the Lambda's security group (`lambda_sg_id`) rather
  than a new one — it's already trusted by the RDS security group's ingress rule, so
  no `foundation`-layer change was needed for that part.

## A recurring Terraform footgun: the NAT instance's AMI lookup

`modules/nat-instance`'s `data "aws_ami"` used `most_recent = true` with no pinning —
it resolves to a *different* AMI id every time Amazon publishes a new AL2023 point
release, and AWS forces an EC2 instance replacement on an AMI change. Found live
2026-07-16: a routine, otherwise-unrelated `terraform plan` on `foundation` wanted to
destroy and recreate the live NAT instance for exactly this reason, cascading into
route table and IAM policy updates too. Fixed with `lifecycle { ignore_changes = [ami] }`
on the instance resource — bump the AMI deliberately (temporarily drop it from
`ignore_changes` for one apply) when an intentional upgrade is wanted, rather than
letting it happen as a side effect of an unrelated change.

## Deployment

- **Frontend**: `.github/workflows/deploy-frontend.yml` — builds the Vite app, syncs to
  the S3 bucket, invalidates CloudFront.
- **Backend**: `.github/workflows/deploy-backend.yml` — builds `Dockerfile.lambda`,
  pushes to ECR, updates the Lambda's image, temporarily swaps its handler to run
  Django migrations, then reverts. The Celery worker/beat task definition is **not**
  yet wired into this workflow — updating its image/env currently requires a manual
  `terraform apply` in `workloads/` (a CI step to do this automatically, mirroring the
  Lambda's image-swap pattern, is a reasonable follow-up once this proves stable).
- **Infra cost-saving**: `infra-start.yml`/`infra-stop.yml` (manual) and two scheduled
  cron variants stop/start `clyro-prod-rds` and the NAT instance overnight. Both `deploy-backend.yml`
  and a `terraform apply` on `workloads` need these actually running first (the Celery
  ECS task fails to even pull its image from ECR with the NAT down — private-subnet
  egress goes through it).
