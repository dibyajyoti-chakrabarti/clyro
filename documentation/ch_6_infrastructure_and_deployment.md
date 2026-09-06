# Chapter 6: Infrastructure & Deployment

This chapter is about **Clyro's own production infrastructure**, not the customer
infrastructure the wizard generates. The two look nothing alike, and confusing them is
the single easiest mistake to make in this codebase.

> **Read this first.** Clyro's platform runs on **one EC2 instance**. It has no ECS, no
> Fargate, no Lambda serving the API, no SQS, no RDS, no ElastiCache, no NAT instance and
> no private subnets. The generated customer stacks *do* use ECS, RDS, SQS and ALBs. When
> a sentence in this handbook mentions Fargate or RDS, check which of the two systems it
> is talking about.
>
> Earlier revisions of this chapter described an ECS-Fargate-for-everything design, and
> then a Lambda-plus-SQS-plus-RDS design. Neither is what runs. Both were replaced by the
> consolidation onto a single box, and this chapter now describes what the Terraform in
> `infrastructure/` actually builds.

## 6.1: The whole of production, on one box

Everything that serves `api.clyro.cloud` runs on a single **`t4g.small`** instance:
2 GB of RAM, ARM/Graviton, Amazon Linux 2023, in `ap-south-1`. It is built by
`infrastructure/modules/ec2_app/`, and everything on it is started by the docker compose
file that `modules/ec2_app/templates/cloud-init.yaml.tftpl` writes at first boot.

| Container | Image | Role |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | The application database |
| `redis` | `redis:7-alpine` | Celery broker and result backend |
| `backend` | the ECR `backend` image | Django, served by uvicorn |
| `celery_worker` | same image | `celery -A config worker --concurrency=2` |
| `celery_beat` | same image | `celery -A config beat` |
| `nginx` | `nginx:1.27-alpine` | TLS termination and the only public listener |

Four details in there are load-bearing, and each exists because of a specific failure:

**Postgres data is a bind mount onto a separate EBS volume**, at
`/mnt/clyro-data/postgres`, not a named docker volume. A named volume lives under
`/var/lib/docker` on the root disk, which is destroyed with the instance. Putting the
data on its own volume is what makes the instance replaceable. `mount-data.sh` resolves
that volume by **volume id** through `/dev/disk/by-id/`, never by device name, because
Nitro presents NVMe devices in attach order and `/dev/sdf` is a hint rather than a
promise. It formats only a disk with no filesystem on it, so a reattached volume carrying
a live database is never touched.

**The backend is uvicorn, not gunicorn.** The command is
`uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 3`.
`backend/requirements.txt` pins `uvicorn==0.49.0` and contains no gunicorn at all, and
`config/asgi.py` is a stock Django ASGI application.

**The backend binds loopback.** The compose port mapping is `127.0.0.1:8000:8000`. nginx
reaches it over the host network and nothing off the box can, even if the security group
is widened by mistake.

**Redis runs with persistence off** (`--save "" --appendonly no`). It is the Celery
broker, replacing what an earlier design did with SQS. Losing queued jobs on a reboot is
acceptable here: every task is retriable and none of them moves money.

There is also 2 GB of swap. Two gigabytes of RAM is genuinely tight for postgres, redis,
uvicorn and two celery processes. Swap does not make any of that fast; it makes the
difference between a slow request and the OOM killer taking out postgres mid-transaction.

### TLS, and the chicken-and-egg it resolves

nginx is the only thing listening publicly. It terminates TLS with a Let's Encrypt
certificate obtained by certbot on the box.

The first boot writes a **plain HTTP** nginx config. A config with a TLS server block in
it would stop nginx starting at all, because the certificate does not exist yet, and a
stopped nginx cannot serve the ACME challenge that produces the certificate. So the box
starts without TLS, certbot solves the challenge, and a deploy hook (`enable-tls.sh`)
swaps in the TLS config and reloads. The hook runs on renewal as well as first issue.

The TLS config redirects port 80 to 443, sets HSTS (nginx is the only component that sees
the real scheme, so Django is the wrong place for that header), and proxies everything to
`127.0.0.1:8000` with a 120 second read timeout.

### Bring-up is two-phase, deliberately

`up.sh` resolves the database password and the Django settings from SSM, then starts the
stack **in two phases**: `db redis nginx` first, then `backend celery_worker celery_beat`
only if the backend image can be pulled.

A single `compose up` aborts the whole stack when any one image is unpullable. On a first
boot, before any backend image has been pushed to ECR, that rolled back postgres, redis
and nginx too, which also took out the ACME challenge, so the box came up with no
database, no proxy and no certificate because of one missing tag.

Configuration comes from SSM on every bring-up rather than being baked in: every parameter
under `$CLYRO_SSM_PREFIX/env/` becomes an environment variable of the same name in
`/opt/clyro/app.env`. The file is written with `umask 077` and moved into place
atomically, because compose reading a half-written file would start containers with
partial configuration. An empty `app.env` is a hard failure rather than a crash-loop,
since the real cause (missing or unreadable parameters) is obvious at that point and
invisible later.

### Backups

Two independent artefacts, on purpose:

- A **daily EBS snapshot** of the data volume, via an `aws_dlm_lifecycle_policy`. This
  restores the whole machine.
- A **nightly logical backup**, `pg_dump | gzip` to the backups S3 bucket at 20:00 UTC
  (01:30 IST), scheduled by `/etc/cron.d/clyro-backup`. This is transactionally
  consistent and restores onto any Postgres.

`backup.sh` refuses to upload a zero-byte dump. An untested backup is the failure mode
worth designing against, so an empty dump fails loudly instead of reporting success.

## 6.2: What surrounds the box

| Piece | Where | Notes |
| --- | --- | --- |
| Apex + `www` | S3 + CloudFront (`modules/frontend`) | The main React SPA |
| `admin.` | S3 + CloudFront (a second instance of `modules/frontend`) | The admin SPA, a separate origin and a separate bundle on purpose, so an admin token never shares an origin with the user-facing app |
| `auth.` | Cognito hosted UI (`modules/cognito`) | Google and GitHub sign-in are both enabled |
| `api.` | A plain Route53 **A record to the instance's Elastic IP** | No CloudFront, no load balancer |
| Certificates | One wildcard ACM cert in **us-east-1** (`modules/acm`) | us-east-1 is not a preference: CloudFront and Cognito custom domains read certificates only from that region |
| Registry | One ECR repository, `backend` (`modules/ecr`) | |
| Network | One VPC (`10.20.0.0/16`), two **public** subnets across two AZs, an IGW, one route table (`modules/networking`) | No private subnets and no NAT of any kind |

`api.clyro.cloud` going straight to the instance is a cost decision stated plainly in
`foundation/main.tf`: an ALB would cost more per month than the instance it balances, and
there is exactly one target.

## 6.3: Terraform layering

Two layers, and the split is about credentials rather than change frequency.

**`infrastructure/bootstrap`** keeps its state on **local disk** and is applied **by hand,
once**. It is the chicken-and-egg layer: it creates the Terraform state bucket and the
GitHub Actions OIDC role that every other apply assumes. A layer that owns its own CI
credentials cannot be run by that CI, which is why `terraform.yml` deliberately excludes
it.

**`infrastructure/foundation`** holds everything else and is applied by
`.github/workflows/terraform.yml`. It composes the modules above, in two phases inside the
one layer: DNS, certificates and SSM parameters first, since nothing else is worth
building until the delegation is verified, then the instance, the frontends and Cognito.

`infrastructure/modules/` contains exactly eight modules: `acm`, `cognito`, `ec2_app`,
`ecr`, `frontend`, `monitoring`, `networking`, `route53`. Of those, **`monitoring` is not
referenced by either layer.** It is dead code at the time of writing, kept but unwired.

There is **no `infrastructure/workloads/` layer**, and no `modules/rds`,
`modules/nat-instance` or `modules/lambda_backend`. Documentation that refers to them is
describing a design that was removed.

> **Known discrepancy (2026-09-06).** A comment in `foundation/main.tf`, next to the ECR
> module, says the three MCP Lambdas "are gone with the rest of the serverless estate;
> they run in-process on the box now". That comment is wrong. `clyro-mcp-pricing`,
> `clyro-mcp-cfn` and `clyro-mcp-docs` are all live in `ap-south-1`, verified against the
> account. What is true is that they are not built from that ECR repository and not
> managed by Terraform at all: they are deployed by `backend/mcp/deploy_mcp.sh` from the
> agents workflow. See 6.4.

## 6.4: The serverless pieces that do exist

The API is not serverless, but four Lambdas are part of the estate:

- **`clyro-mcp-pricing`** exposes `get_pricing`.
- **`clyro-mcp-cfn`** exposes `validate_cloudformation_template`.
- **`clyro-mcp-docs`** exposes `search_documentation`, `read_documentation` and
  `recommend`.
- **`clyro-prod-pre-signup`** is the Cognito pre-signup hook.

The three MCP Lambdas are gateway targets for the AgentCore runtimes, which is why the
MCP job in `deploy-agents.yml` runs first and on its own: it publishes each Lambda ARN to
SSM under `/clyro/prod/mcp/<name>`, and the AgentCore gateway targets read them from
there.

Alongside them sit **two Amazon Bedrock AgentCore runtimes**, both deployed and READY,
shipped as CodeZip bundles:

- **`CryloCanvas_Reasoning`** drives the architecture canvas (wizard steps 3 and 4).
- **`CryloIac_IacArchitect`** generates and refines the CloudFormation template (step 5).

The models behind them are **MiniMax M2.5** by default for canvas and for IaC generation,
and **GLM-5** for IaC refinement. Kimi K2.5 and DeepSeek V3.2 are selectable from the UI.
This is a deliberate move off Anthropic models on Bedrock; any document framing Clyro as
an Anthropic-model system is out of date.

## 6.5: Deployment

Everything ships through GitHub Actions, authenticated by OIDC. No workflow holds an
access key.

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `terraform.yml` | PR and push on `infrastructure/**` or `backend/cfn-templates/**` | Plan on the PR posted as a comment, apply the **saved plan** on merge |
| `deploy-backend.yml` | Push on `backend/**` | Builds the Django image, pushes to ECR, asks the instance to pull and restart **over SSM** |
| `deploy-frontend.yml` | Push on `frontend/**` or `frontend-admin/**` | Matrix over both bundles: build, sync to S3, invalidate CloudFront, then verify the bundle reached the edge |
| `deploy-agents.yml` | Push on the MCP sources, dispatch for AgentCore | The MCP Lambdas, then the two AgentCore runtimes |
| `infra-power.yml` | Manual only | Starts and stops the instance |
| `manage.yml` | Manual only | Runs one Django management command from a fixed list |
| `e2e.yml` | Manual only | Playwright against a real deployment |
| `test.yml` | PR and manual | Backend and frontend test suites |

Three of those choices are worth the words:

**The backend deploy opens no port and holds no SSH key.** It is an SSM send-command, and
the role that runs it can send exactly that one document to exactly that one instance.

**Terraform applies the saved plan, not a fresh one.** Applying a freshly computed plan on
merge would mean the thing that ran is not quite the thing that was reviewed.

**`manage.yml` is not an arbitrary shell.** The command is chosen from a fixed list, so
the workflow cannot quietly become a general remote-execution hole in an otherwise
reviewed deploy path.

**Power is manual.** `infra-power.yml` used to run on a 09:00/21:00 IST cron. The schedule
is gone: a box that stops itself overnight kept ending demos and test runs midway, and
nobody could tell a deliberate shutdown from a failure. The instance is resolved by tag
rather than from a repository secret, because a hardcoded instance id went stale when the
box was replaced and broke the nightly shutdown silently for weeks.

`e2e.yml` is dispatch-only for the same reason: the box is powered by hand, so a
push-triggered suite would fail on every push made while it is off, which teaches
everyone to ignore it.

## 6.6: Where the connector template comes from

`backend/cfn-templates/bootstrap.yaml` is the CloudFormation connector stack a user
launches in their own account (see 6.7). It is not served from the application. Terraform
publishes it: `foundation/cfn_bootstrap.tf` uploads the file to a public-read S3 bucket
and writes the resulting URL to SSM, which is why `terraform.yml` also triggers on
changes under `backend/cfn-templates/`. Editing that template is an infrastructure apply.

## 6.7: The cross-account model

This is the load-bearing design decision of the whole product, and it is worth restating
wherever the architecture is described.

**Clyro never provisions into its own AWS account.** It provisions into the user's.

The user launches the connector stack in their own account. It creates one IAM role,
`clyro-provisioning-<uuid>`, whose trust policy admits Clyro's account **and requires a
matching `sts:ExternalId`**, and it outputs the role ARN. Every provisioning call Clyro
makes is against temporary credentials from assuming that role. Nothing long-lived ever
leaves the user's account, and deleting the stack revokes Clyro's access immediately and
completely.

The permissions in that role are resource-scoped wherever AWS's IAM model allows it:
CodeBuild projects named `clyro-*`, secrets under `clyro/*` and `clyro-*`, log groups
matching `*clyro-*`, SNS topics matching `*clyro-*`, SQS queues named `clyro-*`, and
stacks named `clyro-*` or `ClyroBootstrap-*`.

## 6.8: Cost shape

The consolidation onto one box is a cost decision as much as an operational one. The
recurring platform cost is essentially the instance, its two EBS volumes, the Elastic IP,
Route53, two CloudFront distributions with near-zero traffic, and the Bedrock and Lambda
usage the agents drive, which is per-invocation. There is no managed database, no managed
cache, no NAT Gateway and no load balancer in the platform's own footprint, and those four
were the bulk of the previous design's monthly bill.

The second benefit is that production and local development are now the same service set.
`docker-compose.yml` in the repository root runs the same postgres, redis, backend, celery
worker and celery beat, plus the two Vite dev servers that production serves as static
bundles. That removes an entire class of "works locally, breaks in Lambda" failures.
