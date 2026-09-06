# Chapter 1: Introduction

Clyro is an AI-assisted cloud infrastructure provisioning tool. A user connects a GitHub
repository, connects their own AWS account, answers a few questions, refines an
architecture on a canvas, and Clyro generates and deploys a CloudFormation stack **into
that user's account**.

## Core tenets

1. **Deterministic CloudFormation.** LLMs plan well and write exact CFN syntax badly.
   The agent produces a JSON architecture spec; a deterministic Python layer
   (`backend/app/provisioning/`, with `iac.py` and `cfn_generator.py` at its centre)
   authors the template from that spec. Chapter 13 covers the mechanism in detail.
2. **Clyro provisions into the user's account, never its own.** The user launches a
   small CloudFormation connector stack that creates a role trusting Clyro's account
   with an ExternalId. Every provisioning call runs on temporary credentials from
   assuming that role. This is the load-bearing design decision of the product, and it
   is why deleting one stack revokes Clyro completely.
3. **Async everything.** Agent invocations and provisioning take minutes, so they run as
   Celery tasks and the UI polls. `AgentJob`, `IntentRecord` and `ProvisioningLogEntry`
   carry the state.

## The two systems this handbook describes

Keeping these apart is the single most important thing when reading anything here.

| | Clyro's own platform | The stacks Clyro generates |
| --- | --- | --- |
| Where | Clyro's AWS account | The user's AWS account |
| Compute | One `t4g.small` EC2 instance running docker compose | ECS (Fargate or EC2), sized from the user's answers |
| Database | `postgres:16-alpine` in a container, on a dedicated EBS volume | RDS PostgreSQL |
| Broker | `redis:7-alpine` in a container | Redis or SQS, per the contract |
| Ingress | nginx on the box, plus S3 and CloudFront for the SPAs | ALB, or none at all in the development topology |
| Built by | Terraform, in `infrastructure/` | CloudFormation, generated per project |

So a sentence mentioning Fargate, RDS or an ALB is almost always about the **generated**
stacks. Clyro's own platform has none of them. Chapter 6 is the authority on the
platform; chapters 3 and 13 are the authority on what gets generated.

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
infrastructure/    Terraform: the bootstrap layer and the foundation layer
```

## How to use this book

Chapters 1 to 7 are the system: what it is, how it is built, how it is deployed, how to
run it locally. Chapters 8 to 12 walk the seven-step wizard in order. Chapters 13 and 14
are deep dives on the deterministic IaC layer and the agent network. Chapters 15 to 19
are dated point-in-time reports and are kept as historical records, not updated in place.
