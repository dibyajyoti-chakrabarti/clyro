# Chapter 2: System Architecture

This chapter is a map of Clyro the platform. Chapter 6 has the infrastructure detail;
this is the shape.

## Client plane

Two separate single-page applications, deliberately not one:

- **The main app** (`frontend/`): React 19, Vite, TailwindCSS 4, React Router. It holds
  the seven-step project wizard, the Monaco editor used to review generated
  CloudFormation, and the live provisioning log.
- **The admin app** (`frontend-admin/`): its own bundle on its own subdomain, so an admin
  token never shares an origin or a JS bundle with the user-facing app.

Both are static bundles on S3 behind CloudFront.

## Control plane

The whole backend runs as containers on **one EC2 instance**. There is no Lambda serving
the API, no ECS and no managed database in Clyro's own account.

- **API**: Django REST Framework, served by **uvicorn** (`config.asgi:application`,
  three workers). nginx on the same box terminates TLS and proxies to it over loopback.
- **Database**: PostgreSQL 16, a container, with its data on a dedicated EBS volume.
  Not RDS.
- **Cache and broker**: Redis 7, a container, persistence disabled. Not ElastiCache,
  and not SQS.
- **Async workers**: Celery worker and Celery beat, same image as the API. They run the
  long tasks: contract ingest, canvas chat, IaC generation and refinement, provisioning,
  build, teardown, and the periodic AWS-state reconciliation sweep.
- **Auth**: AWS Cognito, hosted UI on an `auth.` subdomain, with a pre-signup Lambda.
  Google and GitHub sign-in are both wired up.

## Agentic layer

Two Amazon Bedrock AgentCore runtimes, deployed as CodeZip bundles by
`.github/workflows/deploy-agents.yml`:

- **`CryloCanvas_Reasoning`** drives the architecture canvas (wizard steps 3 and 4).
- **`CryloIac_IacArchitect`** generates and refines the CloudFormation template (step 5).

They call three MCP tool Lambdas as gateway targets: `clyro-mcp-pricing` (`get_pricing`),
`clyro-mcp-cfn` (`validate_cloudformation_template`) and `clyro-mcp-docs`
(`search_documentation`, `read_documentation`, `recommend`).

Default models are **MiniMax M2.5** for canvas and for IaC generation, and **GLM-5** for
IaC refinement. Kimi K2.5 and DeepSeek V3.2 are selectable. Clyro has deliberately moved
off Anthropic models on Bedrock.

## Cross-account provisioning

Clyro provisions into the **user's** AWS account, never its own.

1. The user launches `backend/cfn-templates/bootstrap.yaml` as a CloudFormation stack in
   their account. It creates one role, `clyro-provisioning-<uuid>`, trusting Clyro's
   account and requiring a matching `sts:ExternalId`.
2. The user pastes the role ARN back into Clyro.
3. Every subsequent AWS call is made with temporary credentials from `sts:AssumeRole`
   against that role. No long-lived credential ever leaves the user's account, and
   deleting the stack revokes access immediately.

Within that account, Clyro creates a build-archive S3 bucket, uploads a snapshot of the
user's repository fetched with a GitHub App installation token, and runs a CodeBuild
project that builds and pushes the application image to ECR before the ECS services are
scaled up. Chapter 11 has the ordering, which matters.

## Public surface

| Host | Served by |
| --- | --- |
| `clyro.cloud`, `www.clyro.cloud` | CloudFront over S3 (main SPA) |
| `admin.clyro.cloud` | CloudFront over S3 (admin SPA) |
| `auth.clyro.cloud` | Cognito hosted UI |
| `api.clyro.cloud` | A Route53 A record straight to the EC2 instance. No load balancer, no API Gateway. |
