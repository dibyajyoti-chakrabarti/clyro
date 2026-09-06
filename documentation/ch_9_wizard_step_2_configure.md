# Chapter 9: Wizard Step 3, Tell us about your app

> **Filename note.** This file is `ch_9_wizard_step_2_configure.md` because the wizard
> used to have five steps and intent collection was the second of them. Intent is now
> **Step 3**. The filename is kept so existing links keep working. Step 2 is connecting
> the AWS account, covered in [Chapter 11](ch_11_wizard_step_4_deploy.md).
>
> Rewritten 2026-09-06 against the code. The previous version of this chapter described
> eight questions, most of which are no longer asked, and mapped them onto sizing rules
> that no longer hold.

Step 3 collects the small amount of information that reading the repository cannot
supply. It runs after the AWS account is connected and before the canvas.

## The design principles, which still hold

**Never re-ask what Step 1 already knows.** Celery detected in the contract means the
worker exists; psycopg2 means PostgreSQL. Repeating detected information tells the user
the system did not actually read their code.

**Plain English only.** No AWS terminology in the questions. A developer who does not
know AWS should be able to answer every one without searching for anything.

**Fixed options wherever possible.** Open text introduces ambiguity; options map cleanly
onto infrastructure decisions. Exactly one field in Step 3 is free text.

**Ask less over time.** The question set has shrunk deliberately. Every question removed
was one whose answer could be defaulted safely or moved somewhere it fits better, and the
canvas at Step 4 is editable, so a default the user dislikes is one click from being
changed rather than a decision they had to make blind.

## The questions

Four, defined in
`frontend/src/pages/app/ProjectWizard/constants/questions.js::getQuestions`. They render
**all at once on a single page**, not one card at a time.

| # | `id` | Question | Options |
| --- | --- | --- | --- |
| 1 | `environment` | What environment is this deployment for? | Production, Staging / Testing, Development |
| 2 | `scale` | How many users do you expect at launch? | `solo`, `small` (under 1,000), `medium` (real traffic), `large` (significant load) |
| 3 | `domain_has` | Do you have a custom domain for this app? | `yes`, `no` (use the AWS URL), `internal` |
| 4 | `domain_name` | What's your domain? | Free text. **Shown only when `domain_has` is `yes`.** |

The conditional field is filtered out of the "can continue" check as well as the render,
so a hidden question never blocks progress.

## What used to be asked, and where it went

| Removed question | Field | What happens now |
| --- | --- | --- |
| Describe your app in one sentence | `description` | Not asked, not set, not read. The field still exists on the model and in the serializer. |
| How critical is uptime? | `criticality` | Not asked. Defaults to `medium` in `build_spec.py` and in `iac.py`. See the note on multi-AZ below. |
| Which database setup? (RDS or Aurora) | `database_choice` | Defaulted to `rds_postgres` by `canvas_core/canvas_builder.py`. Changeable on the canvas. |
| Where should the workers run? | `worker_compute_choice` | Defaulted to `ecs_fargate` by `canvas_builder.py`. Changeable on the canvas. |
| Where should the backend run? | `compute_choice` | Hardcoded to `ecs_fargate` by the Step 3 component itself. Changeable on the canvas. |
| What type of AWS account? | `aws_account_type` | **Moved to Step 2**, where it is compared against the account being connected. |

`aws_account_type` never reaches the record through this step. `iac.ensure_deployment()`
backfills it from the connection on **every** call, not once, because a free-tier project
that had picked up a paid-account value would go on to be given four NAT gateways.

## Storage

One `IntentRecord` row per project, upserted by `POST /api/projects/<id>/intent/`
(`app/views.py::save_intent`), table `intent_records`. Every field is nullable. Saving
moves the project to `intent_collected` and fires a warmup of the reasoning runtime, so
the canvas at Step 4 does not open onto a cold start.

## What each answer actually decides

This is the part worth being precise about, because the mapping is smaller than it looks.

### `scale` sets sizing

From `canvas_core/cost_engine.py::SIZING_BY_SCALE`, applied in `build_spec.py`:

| scale | Fargate vCPU | Fargate GB | RDS class | Cache node | Service tasks |
| --- | --- | --- | --- | --- | --- |
| `solo` | 0.25 | 0.5 | `db.t3.micro` | `cache.t3.micro` | 1 |
| `small` | 0.5 | 1 | `db.t3.small` | `cache.t3.micro` | 1 |
| `medium` | 1 | 2 | `db.t3.medium` | `cache.t3.small` | 2 |
| `large` | 2 | 4 | `db.r6g.large` | `cache.r6g.large` | 3 |

A worker service always runs exactly one task, whatever the scale. Only the serving
service picks up the task count above.

### `environment` sets names, and nothing else

It maps to a short prefix (`prod`, `staging`, `dev`) which cascades into every resource
name, the `clyro-`-scoped IAM prefix that the connector role's policy requires, and a
truncated prefix for the ALB and target group names, whose combined AWS limit is 32
characters.

It also appears in the multi-AZ gate, which is
`(not free_tier) and criticality == "high" and environment == "production"`.

> **Multi-AZ is currently always off.** `criticality` is no longer collected and defaults
> to `medium`, so the gate can never open. That makes `environment` a naming decision in
> practice, and nothing more. It does not change sizing, replica counts, backup retention
> or deletion protection. This is a consequence of removing the uptime question rather
> than an intentional decision, and it is worth revisiting.

### `domain_has` sets the ALB listener

`has_domain` requires **both** `domain_has == "yes"` and a non-empty `domain_name`. With
a domain, the ALB listens on 443, HTTP redirects to HTTPS, and an ACM certificate is
requested. Without one, the ALB is plain HTTP on port 80.

`no` and `internal` are treated identically today. There is no internal-only path: no
internal ALB and no private DNS. If a user picks `internal` expecting a private
deployment, they will not get one.

The hosted zone is derived by taking the last two labels of the domain, so
`app.example.com` gives `example.com`. That is wrong for multi-part suffixes such as
`co.uk`. `IntentRecord.route53_hosted_zone_id` overrides it, but has no UI anywhere; when
it is blank, `deploy.start()` resolves the zone live with `route53:ListHostedZones`.

### The account type, set in Step 2, overrides most of the above

A free-tier account discards the scale-based sizing entirely and substitutes the smallest
tier: 0.25 vCPU, 0.5 GB, `db.t3.micro`, `cache.t3.micro`, one task. It also drops the NAT
Gateway, moves ECS tasks into the public subnets with public IPs so they can still reach
ECR, forces multi-AZ off, and cuts RDS backup retention from 7 days to 1. The generator
re-forces the instance classes a second time, because a non-eligible class taken from the
spec failed live with "This instance size isn't available with free plan accounts".

Note that this is a spend-minimising path, not a zero-cost guarantee. Fargate itself is
not free-tier eligible. The Step 2 copy currently says only that "NAT Gateway and some
services will be excluded", which understates it considerably.

## Dead code in this step

Worth knowing before reading the directory, because three files look authoritative and
are not. `QuestionCard.jsx`, `IntentSummary.jsx` and `hooks/useQuestionFlow.js` implement
the old one-question-at-a-time flow with a progress bar and a summary table. Nothing
imports them. `useQuestionFlow.js` still calls `getQuestions()` with arguments the current
function does not accept, and still branches on the removed `description` question.
`ACCOUNT_TYPE_OPTIONS` in `questions.js` is exported and imported nowhere; the Step 2 card
duplicates that copy inline with different wording.

The resume path has a related leftover: `StepThree.jsx` tries to auto-advance past Step 3
when `intent.description` is set, and `description` is never set. What actually happens on
resume is that the form renders pre-filled from the saved record with Continue already
enabled, which is the desired behaviour, reached by accident.

## Step 3 outputs

| Output | Location | Consumer |
| --- | --- | --- |
| `IntentRecord` row | `intent_records` | Step 4 canvas, Step 5 IaC generation |

Only seven of its fields ever reach the generator: `scale`, `criticality`, `environment`,
`domain_has`, `domain_name`, `route53_hosted_zone_id` and `aws_account_type`.
`compute_choice`, `database_choice`, `worker_compute_choice` and `description` influence
the canvas only, and `build_spec` reads the resulting `aws_service` off the canvas nodes
instead.
