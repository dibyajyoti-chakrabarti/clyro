<p align="center">
  <img src="frontend/src/assets/logos/Clyro_logo.png" alt="Clyro" width="120" />
</p>

<h1 align="center">Clyro</h1>

<p align="center">
  Point it at a GitHub repository and it designs, prices, generates and provisions the AWS architecture to run it, in your own AWS account.
</p>

<p align="center">
  <a href="https://clyro.cloud"><strong>clyro.cloud</strong></a> &nbsp;·&nbsp;
  <a href="documentation/index.md">Engineering Handbook</a> &nbsp;·&nbsp;
  <a href="https://api.clyro.cloud/api/health/">API health</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/stack-Django%20%7C%20React%20%7C%20Terraform%20%7C%20AWS-blue?style=flat-square" alt="Stack" />
  <img src="https://img.shields.io/badge/agents-Bedrock%20AgentCore-8A2BE2?style=flat-square" alt="Agents" />
  <img src="https://img.shields.io/badge/region-ap--south--1-orange?style=flat-square" alt="Region" />
  <img src="https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square" alt="License" />
</p>

---

## What it does

You connect a GitHub repository. Clyro reads the code, works out what it needs to run (framework, database, cache, background workers, object storage, every environment variable), proposes an architecture you can argue with in plain English, prices it against live AWS rates, generates the CloudFormation, and provisions it.

The infrastructure lands in **your** AWS account, never in Clyro's. You launch a small CloudFormation stack that creates a role trusting Clyro with an ExternalId, and every provisioning call runs on temporary credentials from assuming that role. Revoke it by deleting one stack.

> **Two systems share this repository's vocabulary.** Clyro's own platform runs on a single small EC2 instance and uses no ECS, no RDS and no load balancer. The stacks Clyro *generates* run in the user's account and do use ECS, RDS and sometimes an ALB. A mention of Fargate or RDS is almost always the second one. [Chapter 6](documentation/ch_6_infrastructure_and_deployment.md) is the authority on the first, [Chapter 11](documentation/ch_11_wizard_step_4_deploy.md) on the second.

---

## The seven steps

| Step | What happens |
|---|---|
| 1. Connect | GitHub App installation, pick a repo and branch. A scanner reads the tree and classifies every environment variable as generated, optional, or a secret you must supply. Anything that is only entropy, Clyro mints itself. |
| 2. Connect AWS | Launch the connector stack, paste back the role ARN. Clyro verifies by assuming it. |
| 3. Tell us about your app | A short intent questionnaire. Each answer moves a real lever in the generated topology. |
| 4. Review your architecture | A live canvas with a running cost estimate, priced in your region and free-tier aware. Talk to the reasoning agent to change the design. |
| 5. Generate and validate | The IaC agent emits CloudFormation, validated before you can continue. |
| 6. Provision | The stack is created in your account with a live event stream. Services are authored at zero desired count so the stack can complete before an image exists. Then CodeBuild builds and pushes, a one-off task applies your database migrations, and only then do services scale up. |
| 7. Live | Health, metrics, logs, cost, pause and resume, and a teardown that removes everything it created. |

The parts that must be correct are not left to a model. Canvas parsing, constraint checking, cost estimation and the CloudFormation generator are ordinary Python. The agents propose; deterministic code prices, validates and emits. See [Chapter 3](documentation/ch_3_deterministic_provisioning.md) and [Chapter 13](documentation/ch_13_deterministic_iac_mechanism.md).

---

## Repository structure

A monorepo. Everything deploys independently from `main`.

```
clyro/
├── backend/           # Django REST API, provisioning engine, agents, MCP servers
├── frontend/          # React app: marketing, auth, the seven-step wizard
├── frontend-admin/    # React admin console
├── infrastructure/    # Terraform, in two layers
├── documentation/     # Engineering handbook, 20 chapters
├── docker-compose.yml
└── .github/
    └── workflows/     # Deploy backend, frontend and agents; Terraform; tests; ops
```

---

## Services

### `backend/`: Django REST API and provisioning engine

Owns all persistent data, the wizard state machine, and every AWS call made on a user's behalf.

**Stack:** Python 3.12 · Django 6 · Django REST Framework · PostgreSQL · Celery · Redis · uvicorn (ASGI) · boto3

```
backend/
├── config/            # Settings, ASGI entry point, Celery app
├── core/              # Shared models: Project, Deployment, IntentRecord, EnvVarKey
├── app/
│   ├── scanner/       # Repo detection, CLYRO.md ingest, compliance checks
│   ├── canvas/        # Architecture canvas services and views
│   ├── provisioning/  # deploy.py, iac.py, cfn_generator.py, build_spec.py, aws_client.py
│   ├── oidc/          # OIDC shim so Cognito can federate GitHub, which is OAuth2 only
│   ├── agentcore.py   # Bedrock AgentCore invocation
│   └── tasks.py       # Celery tasks: scan, generate, provision, build, delete
├── canvas_core/       # Deterministic canvas ops, constraints, cost engine
├── agents/            # AgentCore runtime bundles: CryloCanvas, CryloIac
├── mcp/               # MCP servers: pricing, CloudFormation validation, AWS docs
├── lambdas/           # Lambda handlers
├── cfn-templates/     # bootstrap.yaml, the cross-account connector stack
└── skills/
```

**The connector role** is the load-bearing piece of the whole product. `cfn-templates/bootstrap.yaml` creates `clyro-provisioning-<uuid>` in the user's account, trusting Clyro's account with an ExternalId. Its policy is a hand-maintained least-privilege allowlist, and `app.tests.BootstrapTemplateGrantsTests` pins the grants whose absence nothing else catches.

### `frontend/`: React application

**Stack:** React 19 · Vite 7 · Tailwind CSS 4 · AWS Amplify (Cognito) · Monaco · Playwright

```
frontend/
├── src/
│   ├── pages/
│   │   ├── public/          # Landing, pricing, legal
│   │   ├── auth/            # Login, signup, OAuth callbacks
│   │   └── app/
│   │       ├── ProjectWizard/   # step1 … step7, one directory each
│   │       └── ...              # Dashboard, project views
│   ├── components/          # Shared UI
│   ├── monaco/              # Template editor
│   ├── api/                 # API client
│   └── context/             # Auth, theme
├── e2e/                     # Playwright suite, runs against a live base URL
└── vite.config.js
```

### `frontend-admin/`: Admin console

A separate bundle on its own subdomain for operational views. Same stack, no shared build.

### `infrastructure/`: Terraform

Two layers, because the first has to exist before the second can have a remote backend.

| Layer | State | Applied by | Contains |
|---|---|---|---|
| `bootstrap/` | Local | By hand, rarely | State bucket, GitHub Actions OIDC role |
| `foundation/` | S3 | GitHub Actions | Everything else |

```
infrastructure/
├── bootstrap/     # Chicken-and-egg layer
├── foundation/    # The real infrastructure
├── modules/       # acm, cognito, ec2_app, ecr, frontend, monitoring, networking, route53
└── scripts/
```

`foundation` also publishes `backend/cfn-templates/bootstrap.yaml` to S3, so editing the connector template is a Terraform apply.

---

## Local development

### Prerequisites

- Docker and Docker Compose
- Node.js LTS and Python 3.12 if you want to run a service natively
- `backend/.env.local` and `frontend/.env.local` populated

### Start everything

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Backend API | http://localhost:8000 |
| Frontend | http://localhost:5173 |
| Admin | http://localhost:5174 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

### Backend only

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Tests

```bash
cd backend && DATABASE_URL='sqlite:///:memory:' python manage.py test
cd frontend && npm run lint && npm run build
```

The Playwright suite runs against a deployed environment rather than a local one:

```bash
cd frontend
PLAYWRIGHT_BASE_URL=https://clyro.cloud npx playwright test
```

---

## Environment variables

### `backend/.env.local`

```bash
DEBUG=True
SECRET_KEY=django-insecure-replace-this-before-production
DATABASE_URL=postgres://clyro:clyro@localhost:5432/clyro_db
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173

# Cognito
COGNITO_REGION=ap-south-1
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=

# GitHub App
GITHUB_APP_ID=
GITHUB_APP_NAME=
GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/github-app.pem

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Cross-account provisioning
CLYRO_AWS_ACCOUNT_ID=
CFN_BOOTSTRAP_TEMPLATE_URL=

# Agents
REASONING_RUNTIME_ARN=
IAC_RUNTIME_ARN=
AGENTCORE_MEMORY_ID=

# Local development only
AWS_PROFILE=clyro
```

### `frontend/.env.local`

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_COGNITO_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_GITHUB_APP_NAME=
```

`backend/*.pem` is gitignored. The GitHub App private key never belongs in the repository.

In production none of this is a file. `/opt/clyro/up.sh` reads `/clyro/prod/env/` out of SSM Parameter Store and exports it into the container.

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy-backend.yml` | Push to `main` on `backend/**` | Builds the image, pushes to ECR, deploys over SSM |
| `deploy-frontend.yml` | Push to `main` on `frontend/**` or `frontend-admin/**` | Builds both bundles, syncs to S3, invalidates CloudFront |
| `deploy-agents.yml` | Push to `main` on the Lambda sources | Rebuilds the MCP Lambdas. The AgentCore runtime job is dispatch only |
| `terraform.yml` | PR plans, push to `main` applies | Applies `foundation`, and republishes the connector template on `backend/cfn-templates/**` |
| `test.yml` | Pull request, or manual | Django suite on in-memory SQLite, frontend lint and build |
| `e2e.yml` | Manual | Playwright against a chosen base URL |
| `manage.yml` | Manual | Django management commands against production |
| `infra-power.yml` | Manual | Start or stop the instance to control cost |

`test.yml` does not run on pushes to `main`, only on pull requests. Branch protection, not the workflow list, is what keeps `main` green.

---

## Production

Deliberately small. This is a pre-revenue product and the deployment is sized as a cost floor, not as a reference architecture.

| Piece | What runs it |
|---|---|
| API, workers, database, cache | One `t4g.small` EC2 instance running postgres, redis, uvicorn, celery worker, celery beat and nginx under docker compose |
| Data durability | Postgres bind-mounted to a separate EBS volume, so the instance is disposable |
| TLS | nginx with certbot. The backend binds loopback and is never exposed directly |
| Frontend and admin | S3 and CloudFront |
| Auth | Cognito, with an OIDC shim for GitHub sign-in |
| Agents | Two Bedrock AgentCore runtimes: canvas reasoning and IaC generation |
| Agent tools | Three MCP servers on Lambda: pricing, CloudFormation validation, AWS documentation |
| Region | `ap-south-1` |

The single box is a single point of failure with no redundancy and no managed database. That is a known and accepted trade for now. The whole machine is reproducible from `infrastructure/modules/ec2_app/templates/cloud-init.yaml.tftpl`, which is the source of truth for what actually runs on it.

---

## Documentation

The [Engineering Handbook](documentation/index.md) is 20 chapters covering the platform, the generated stacks, every wizard step, and the deploy pipeline. Chapters 15 to 19 are dated point-in-time reports kept as historical records rather than rewritten, and each says what has changed since.

---

## License

Proprietary. All rights reserved.
