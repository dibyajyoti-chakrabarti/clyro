**Crylo — Step 2: Intent Collection (Final Documentation)**

**Overview**

Step 2 collects the information that repository scanning cannot provide. It is a short, conversational flow — not a form. Every question has a clear purpose tied directly to an infrastructure decision. No question is asked if the answer is already known from Step 1.

Step 2 produces a single intent record stored in the database. Combined with the Step 1 resource record, this gives every downstream step a complete, unambiguous picture of what to build.

**Design Principles**

**Never re-ask what Step 1 already knows.** If Crylo detected Celery, it never asks about background jobs. If psycopg2 was found, it never asks about the database. Repeating detected information signals to the user that the system didn't actually understand their code.

**Questions are presented one at a time.** Not as a list, not as a form. Each question appears after the previous one is answered. This keeps the interaction conversational and reduces cognitive load.

**Plain English only.** No AWS terminology in the questions themselves. A developer who doesn't know AWS should be able to answer every question without googling anything. Technical implications are handled internally.

**Options over open input wherever possible.** Open text fields introduce ambiguity. Fixed options map cleanly to infrastructure decisions. The only open text fields in Step 2 are the app description and the domain name.

**Question Sequence**

Questions are grouped into three moments. Moments 1 and 3 always appear. Moment 2 questions appear based on what Step 1 detected.

**Moment 1 — Understanding the App**

These three questions are always asked, in this order, one at a time.

**Q1 — App Description**

*"Describe your app in one sentence."*

Free text input. One line maximum.

Purpose: Used exclusively for resource naming (invoiceapp-prod-db instead of crylo-rds-1) and canvas node labels. Has no effect on infrastructure decisions.

Stored as: intent.description

**Q2 — Expected Scale**

*"How many users do you expect at launch?"*

A) Just me or a small internal team

B) Small user base — under 1,000 users

C) Public product — expecting real traffic

D) High scale — expecting significant load

Purpose: This single answer drives instance sizing for every resource in the stack. Maps directly to infrastructure sizing tiers:

A → db.t3.micro | cache.t3.micro | 1 ECS task | no autoscaling

B → db.t3.small | cache.t3.micro | 1 ECS task | no autoscaling

C → db.t3.medium | cache.t3.small | 2 ECS tasks | autoscaling enabled

D → db.r6g.large | cache.r6g.large | 3 ECS tasks | autoscaling aggressive

Stored as: intent.scale → solo | small | medium | large

**Q3 — Uptime Requirement**

*"How critical is uptime for this deployment?"*

A) Downtime is acceptable — dev, staging, or side project

B) Downtime is bad but not catastrophic — early stage product

C) It needs to stay up — this is a production business

Purpose: Drives redundancy decisions across the entire stack. Maps to:

A → single-AZ RDS | 1 ECS task minimum | no multi-AZ | no read replicas

B → single-AZ RDS | 1 ECS task minimum | no multi-AZ

C → multi-AZ RDS | 2 ECS task minimum | multi-AZ subnets | deletion protection on

Stored as: intent.criticality → low | medium | high

**Moment 2 — Service Confirmation**

These questions appear only when the corresponding resource was detected in Step 1, or when a decision is required. Each is shown only once and only when relevant.

**Q4 — Backend Compute Choice**

Always shown. This is the most consequential architectural decision the user makes.

*"Your Django backend will run as a container on AWS. Where do you want it hosted?"*

A) ECS Fargate — fully managed, no servers to configure (recommended)

B) ECS on EC2 — more control, slightly cheaper at high scale

C) EC2 — you manage the underlying server yourself

A one-line cost and complexity note is shown under each option. Recommended option is highlighted. Most users will pick Fargate.

Purpose: Sets aws\_service on the backend node in canvas.yml. Directly determines which CloudFormation resources get generated for compute.

Stored as: intent.compute\_choice → ecs\_fargate | ecs\_ec2 | ec2

**Q5 — Database Service Choice**

Shown only if PostgreSQL was confirmed in Step 1, which it almost always will be.

*"Which database setup do you want?"*

A) RDS PostgreSQL — reliable, well-understood, lower cost (recommended)

B) Aurora PostgreSQL — higher performance, more scalable, higher cost

Purpose: Sets aws\_service on the database node in canvas.yml.

Stored as: intent.database\_choice → rds\_postgres | aurora\_postgres

**Q6 — Worker Compute Choice**

Shown only if Celery was detected in Step 1.

*"Your background workers were detected. Where should they run?"*

A) ECS Fargate — same as your backend, fully managed (recommended)

B) ECS on EC2 — more control, cheaper at scale

C) EC2 — manage the server yourself

Purpose: Sets aws\_service on the worker node in canvas.yml.

Stored as: intent.worker\_compute\_choice → ecs\_fargate | ecs\_ec2 | ec2

**Q7 — Environment**

Always shown.

*"What environment is this deployment for?"*

A) Production

B) Staging

C) Development

Purpose: Affects resource naming conventions, sizing overrides, deletion protection, and whether multi-AZ defaults are applied regardless of Q3 answer.

Production → multi-AZ respected from Q3 | deletion protection on | full naming

Staging → single-AZ always | deletion protection off | -staging suffix

Development → single-AZ always | deletion protection off | minimal sizing override

Stored as: intent.environment → production | staging | development

**Moment 3 — Domain**

Always shown. One question, one optional follow-up.

**Q8 — Domain**

*"Do you have a domain name for this app?"*

A) Yes — I have a domain to point to this

B) Not yet — give me the AWS-generated URL for now

C) No public domain needed — internal use only

If A is selected, a text input appears:

*"What's the domain? (e.g. app.myproduct.com)"*

Purpose:

A → Provision ACM certificate | configure ALB with HTTPS listener | output CNAME record

B → Output ALB DNS name only | no ACM provisioned

C → No ALB listener on 443 | internal DNS only

Stored as: intent.domain.has\_domain → true | false | internal Stored as: intent.domain.domain\_name → string | null

**Step 2 Output**

All answers are written to the database as a single intent record in JSONB, linked to the project by project\_id.

{

"project\_id": "uuid",

"intent": {

"description": "A SaaS tool for managing freelance invoices",

"scale": "small",

"criticality": "high",

"environment": "production",

"compute\_choice": "ecs\_fargate",

"database\_choice": "rds\_postgres",

"worker\_compute\_choice": "ecs\_fargate",

"domain": {

"has\_domain": true,

"domain\_name": "app.myproduct.com"

}

}

}

**canvas.yml Update After Step 2**

Once the intent record is written, Crylo updates the draft canvas.yml generated at the end of Step 1. The aws\_service values on each node are replaced with the user's confirmed choices.

version: 1

project: invoiceapp

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

This canvas.yml is the input to Step 3. It is complete, confirmed, and unambiguous.

**What Step 2 Does Not Do**

* Does not ask for environment variable values — that is Step 4
* Does not ask about VPC, subnets, security groups, or any networking — derived at Step 4
* Does not ask about CI/CD pipeline setup — out of scope for MVP
* Does not ask about monitoring or alerting — out of scope for MVP
* Does not modify the database resource record from Step 1

**Step 2 Outputs**

| **Output** | **Location** | **Consumer** |
| --- | --- | --- |
| Intent record | Database (JSONB) | Step 3 (canvas), Step 4 (IaC generation) |
| Updated canvas.yml | Internal storage | Step 3 (canvas rendering) |

Step 2 is complete when the intent record is written and canvas.yml is updated. Step 3 opens the canvas immediately after.
