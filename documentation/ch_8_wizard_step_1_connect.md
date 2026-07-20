**Crylo — Step 1: Repository Connection & Analysis (Final Documentation)**

**Overview**

Step 1 is the foundation of the entire Crylo pipeline. It connects to the user's GitHub repository, scans for all meaningful signals, stores detected resources and environment variables in persistent storage, and produces two outputs: a confirmed resource manifest in the database and a draft canvas.yml that Step 2 will refine with user intent.

Nothing in Steps 2, 3, or 4 proceeds without a successfully completed Step 1.

**Supported Frameworks (MVP)**

| **Layer** | **Supported** |
| --- | --- |
| Backend | Django only |
| Frontend | React (CRA or Vite) |
| Database | PostgreSQL only |
| Workers | Celery (if detected) |
| Cache | Redis (if detected) |
| Storage | S3 via django-storages (if detected) |
| Queue | SQS via Celery (if Celery detected) |

If the repository does not match this matrix, Crylo surfaces a clear unsupported message and stops. No partial analysis, no silent failures.

**1.1 — GitHub Connection**

**Method: GitHub App Installation**

Plain OAuth is insufficient. Crylo uses a GitHub App installation because it provides:

* Scoped repository access — user explicitly chooses which repos Crylo can see
* Webhook delivery on push events — used later for drift detection in v2
* Installation-level tokens — more secure than user OAuth tokens
* Read access to file contents, repo tree, and metadata

**Flow:**

The user installs the Crylo GitHub App from the UI. They select which repositories to grant access to. Back in Crylo, they select a single repository and a target branch, defaulting to main. Scanning begins immediately on confirmation.

**1.2 — Repo Scan**

Scanning runs in three passes in strict order. Each pass only proceeds if the previous pass left something ambiguous. The goal is to read as few files as possible while maximising signal accuracy.

**Pass 1 — File Tree Scan (no file contents read)**

Crylo fetches the complete file and folder tree. No file contents are read in this pass.

This pass answers:

* Is this a monorepo or single-service repository?
* Are there recognizable service directories? (backend/, frontend/, workers/, migrations/)
* Which high-signal files exist? Build a checklist for Pass 2.
* Does a docker-compose.yml exist? Flag for deep read in Pass 2.
* Does a Dockerfile exist in the backend directory? If not, flag for generation.
* Does a .github/workflows/ directory exist?
* Does an existing IaC directory exist? (cloudformation/, infrastructure/, terraform/, cdk/)

If existing IaC is found, it is noted in the database as a reference artifact. For MVP, Crylo does not attempt to import or transpile it. It is used as a secondary signal to confirm detected resources but Crylo always generates fresh CloudFormation at the end.

**Pass 2 — High Signal File Read**

Crylo reads specific files only, in this priority order:

requirements.txt → REQUIRED. Hard block if missing.

manage.py → Confirm Django. Extract project name for wsgi path.

settings.py → Primary source for DB, cache, storage, env vars.

settings/base.py → Check if split settings pattern is used.

settings/production.py → Production-specific vars often live here.

config/settings.py → Alternate location.

core/settings.py → Another common pattern.

package.json → Confirm React. Extract dependencies.

docker-compose.yml → If present, use as service map confirmation.

.github/workflows/\*.yml → Secondary env var source, CI/CD confirmation.

Crylo scans all settings file locations that exist and unions the results. The backend settings location is not assumed — it is discovered from Pass 1's file tree.

**Pass 3 — Targeted Code Scan (fallback only)**

Pass 3 runs only when Pass 2 leaves something genuinely ambiguous. It is not a default step.

Triggers for Pass 3:

* No settings file found anywhere in the repo
* Database engine could not be determined from requirements or settings
* Suspected AWS SDK usage but boto3 not in requirements

What Pass 3 does:

* Search all .py files for os.environ.get(, os.environ[, os.getenv(, env(, config( — extract env var names
* Search entry files for import boto3 or from botocore — confirm AWS SDK usage
* Search for DATABASES, CACHES, CELERY\_BROKER\_URL across all .py files

Pass 3 never reads entire files. It runs targeted string searches only.

**1.3 — Detection Logic**

After scanning, Crylo runs deterministic detection rules. AI inference is only used when rules produce an ambiguous result. Rules always run first.

**Backend Detection**

manage.py present AND django in requirements.txt

→ Backend: Django confirmed

→ Extract project name from manage.py for wsgi path (e.g. myproject.wsgi:application)

django NOT in requirements.txt

→ Hard block

→ Message: "We couldn't detect a supported backend framework.

Crylo currently supports Django only."

**Database Detection**

psycopg2 OR psycopg2-binary in requirements.txt

→ Database: PostgreSQL confirmed

mysqlclient OR PyMySQL in requirements.txt

→ Hard block

→ Message: "MySQL is not supported in the current version of Crylo."

sqlite in settings.py DATABASES ENGINE AND no psycopg2 in requirements.txt

→ AMBIGUOUS

→ Ask user: "Your settings show SQLite which is for local development.

What database do you want in production?"

→ Present single option: PostgreSQL

→ Do not proceed until confirmed

No database config found anywhere

→ Ask user: "Does your app use a database?"

**Frontend Detection**

package.json present AND react in dependencies AND next NOT in dependencies

→ Frontend: React confirmed (CRA or Vite)

→ aws\_service: s3\_cloudfront (always, no user choice)

package.json missing

→ No frontend detected

→ Valid — backend-only deployments are supported

**Worker Detection**

celery in requirements.txt

→ Workers: Celery confirmed

→ Will provision second ECS task with same ECR image, different entry command

django-celery-beat in requirements.txt

→ Scheduled tasks confirmed

→ Will provision CloudWatch Events rule at IaC generation time

**Cache Detection**

redis OR django-redis in requirements.txt

→ Cache: Redis confirmed

→ aws\_service: elasticache (no user choice at MVP)

**Storage Detection**

boto3 AND django-storages in requirements.txt

AND S3Boto3Storage found in settings.py

→ Storage: S3 confirmed

**Dockerfile Detection**

Dockerfile found in backend directory

→ Use as-is

Dockerfile NOT found

→ Generate standard Django Dockerfile

→ Propose as PR to repository

→ Crylo always uses a container image regardless of compute choice

→ Backend is always pushed to ECR at provision time

Generated Dockerfile template for Django:

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "{project\_name}.wsgi:application", "--bind", "0.0.0.0:8000"]

{project\_name} is substituted from the value extracted from manage.py.

**1.4 — Environment Variable Detection**

Environment variables are detected exclusively from settings files. .env files are intentionally excluded — they are universally gitignored and cannot be relied upon.

**Scan Target**

All settings files discovered in Pass 1 and read in Pass 2. Specifically scanning for these five patterns:

os.environ.get('KEY')

os.environ['KEY']

os.getenv('KEY')

env('KEY') # django-environ library

config('KEY') # python-decouple library

All unique key names found across all patterns and all settings files are collected and deduplicated.

**Classification**

Each detected env var is classified into one of three categories based on the code block context it was found in, not the key name alone.

GENERATED

Found inside DATABASES block → DB credentials, Crylo provisions RDS

Found inside CACHES block → Cache URL, Crylo provisions ElastiCache

Found as CELERY\_BROKER\_URL → Broker URL, Crylo provisions SQS + Redis

Found as CELERY\_RESULT\_BACKEND → Result backend, same

Found as AWS\_STORAGE\_BUCKET\_NAME → S3 bucket, Crylo provisions it

Found as DEFAULT\_FILE\_STORAGE → Storage config, Crylo handles it

USER\_SECRET

Found as SECRET\_KEY → Django signing key, user must provide

Found with unrecognized context → Safest default is user\_secret

OPTIONAL

Found as DEBUG → Crylo sets False in production

Found as ALLOWED\_HOSTS → Crylo derives from provisioned domain

GENERATED vars are never shown to the user. Crylo constructs and injects them automatically at provision time via AWS Secrets Manager. USER\_SECRET vars are collected and the user is asked for values at Step 4. OPTIONAL vars are given sensible production defaults with an option to override.

**1.5 — Persistent Storage**

All detected signals are stored in the database as JSONB after scanning completes. Nothing is stored as a file.

**Detected Resources Record**

{

"project\_id": "uuid",

"scan\_timestamp": "2024-01-01T00:00:00Z",

"repository": {

"url": "github.com/user/my-app",

"branch": "main",

"is\_monorepo": true

},

"services": {

"backend": {

"detected": true,

"framework": "django",

"path": "./backend",

"project\_name": "myproject",

"wsgi\_path": "myproject.wsgi:application",

"dockerfile\_found": false,

"dockerfile\_generated": true

},

"frontend": {

"detected": true,

"framework": "react",

"path": "./frontend"

},

"worker": {

"detected": true,

"type": "celery",

"scheduled": true

}

},

"infrastructure": {

"database": { "detected": true, "engine": "postgres", "source": "requirements.txt" },

"cache": { "detected": true, "engine": "redis", "source": "requirements.txt" },

"storage": { "detected": true, "type": "s3", "source": "settings.py" },

"queue": { "detected": true, "type": "sqs", "source": "celery\_detected" }

},

"existing\_iac": {

"found": true,

"type": "terraform",

"path": "./terraform",

"used\_as": "reference\_only"

}

}

**Environment Variables Record**

{

"project\_id": "uuid",

"env\_vars": [

{

"key": "DB\_PASSWORD",

"source": "settings/base.py",

"context": "DATABASES",

"classification": "generated"

},

{

"key": "REDIS\_URL",

"source": "settings/base.py",

"context": "CACHES",

"classification": "generated"

},

{

"key": "SECRET\_KEY",

"source": "settings/base.py",

"context": "SECRET\_KEY",

"classification": "user\_secret"

},

{

"key": "STRIPE\_SECRET\_KEY",

"source": "settings/production.py",

"context": "unknown",

"classification": "user\_secret"

},

{

"key": "DEBUG",

"source": "settings/base.py",

"context": "DEBUG",

"classification": "optional",

"production\_default": "False"

}

]

}

**1.6 — Draft canvas.yml Generation**

After detection and storage, Crylo generates a draft canvas.yml. This file is stored internally — it is never committed to the user's repository. It is the working document for Step 2 and 3.

At this stage, aws\_service values are pre-filled with sensible defaults. The user will refine these in Step 2 based on intent, and can further change them on the canvas in Step 3 via natural language prompts.

version: 1

project: my-app

nodes:

- id: backend

label: Django Backend

type: service

aws\_service: ecs\_fargate

image: ecr

port: 8000

- id: frontend

label: React Frontend

type: static

aws\_service: s3\_cloudfront

- id: db

label: PostgreSQL

type: database

aws\_service: rds\_postgres

- id: cache

label: Redis

type: cache

aws\_service: elasticache

- id: worker

label: Celery Worker

type: worker

aws\_service: ecs\_fargate

image: ecr

- id: queue

label: Task Queue

type: queue

aws\_service: sqs

connections:

- from: frontend

to: backend

label: REST API

- from: backend

to: db

label: reads/writes

- from: backend

to: cache

label: caching

- from: backend

to: worker

label: async tasks

- from: worker

to: queue

label: consumes

Allowed aws\_service values per node type:

type: service → ecs\_fargate | ecs\_ec2 | ec2

type: static → s3\_cloudfront (fixed, no choice)

type: database → rds\_postgres | aurora\_postgres

type: cache → elasticache (fixed, no choice)

type: worker → ecs\_fargate | ecs\_ec2 | ec2

type: queue → sqs (fixed, no choice)

type: storage → s3 (fixed, no choice)

Networking resources (ALB, NLB, API Gateway, VPC, subnets, security groups) are deliberately absent from canvas.yml. They are derived from the connection graph at IaC generation time in Step 4.

**1.7 — Failure States**

Every failure has a defined response. No silent failures, no partial completions.

| **Failure** | **Severity** | **Behaviour** |
| --- | --- | --- |
| requirements.txt missing | Hard block | Ask user to add it. Show minimum requirements doc. |
| Framework not supported | Hard block | Show supported list. Offer waitlist signup. |
| Repo empty or no meaningful files | Hard block | Show minimum requirements checklist. |
| Database engine unsupported | Hard block | Show supported databases. |
| Database ambiguous (SQLite, no psycopg2) | Soft block | Ask user to confirm target database before continuing. |
| settings.py not found anywhere | Warning | Trigger Pass 3. Ask user to confirm DB and env vars manually. |
| Dockerfile missing | Auto-resolve | Generate Dockerfile. Propose as PR. Continue with generated version. |
| Insufficient GitHub permissions | Hard block | Ask user to reinstall GitHub App with correct permissions. |
| Private repo, no access | Hard block | Guide user through GitHub App permission grant. |

**Step 1 Outputs**

Step 1 produces exactly three outputs. All three must exist before Step 2 begins.

| **Output** | **Location** | **Consumer** |
| --- | --- | --- |
| Detected resources record | Database (JSONB) | Step 2, Step 4 |
| Environment variables record | Database (JSONB) | Step 4 (provisioning) |
| Draft canvas.yml | Internal storage | Step 2, Step 3 |

**What Step 1 Does Not Do**

* Does not ask the user about instance sizes, traffic, or scale — that is Step 2
* Does not ask the user for environment variable values — that is Step 4
* Does not generate CloudFormation — that is Step 4
* Does not commit any files to the repository except the generated Dockerfile PR
* Does not read arbitrary code files unless Pass 3 is explicitly triggered
