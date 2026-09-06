# Clyro — E2E Test #2 (post-hardening) & Latency Report

> **Dated note added 2026-09-06. This is a historical record; the measurements
> and findings below are left exactly as written.**
>
> The run happened on 2026-07-09. Since then:
>
> - The template is no longer authored by the IacArchitect LLM. The model
>   variance this report documents is what motivated the deterministic
>   generator in Chapter 13, which now authors the initial template outright.
> - RepoRecon is timed here as a live AgentCore scan (49.79s). That runtime was
>   deleted; Step 1 ingests an offline contract instead. See Chapters 8 and 20.
> - "Clyro has no stack-update path" was true then and is not now. See
>   `_apply_stack_update` in `backend/app/provisioning/deploy.py`.
> - Its step labels are the retired five-step scheme. Its "Step 3" is today's
>   Step 4, and its "Step 4" spans today's Steps 2, 5 and 6.
>
> Fix A4, the `DesiredCount: 0` then build then scale-up ordering that this run
> proved, is still exactly how provisioning works.

**Date:** 2026-07-09
**Driver:** Browser-driven E2E through the real Chrome UI
**Environment:** Local dev (Docker Compose) — frontend `:5173`, backend `:8000`, Postgres, Redis, Celery worker
**Project under test:** `E2E-Hardening-Test` (`e1b03519-3f8c-419e-b829-2fa3d7521e69`)
**Repository:** `Durvesh717/test-app` @ `main` (Django REST + Celery + React)
**AWS:** account `321613317660`, `us-east-1` (bootstrap stack `ClyroBootstrap-E2E-Hardening-Test`, deployed by the user)
**Intent:** Free tier · Production · <1,000 users · AWS-generated URL
**Models:** IaC generate = **Kimi K2.5**
**Scope:** Steps 1–4 through generate → validate → `IAC_READY`, then A4 implemented and a real
provision + teardown driven through the GUI.

The previous project (`E2E-Latency-Test`) was deleted before this run.

---

## TL;DR

Every Phase A fix holds on a freshly generated template. **cfn-lint: 0 errors. Spec-conformance: 0
blockers. Deployment reached `IAC_READY`.** Zero errors, exceptions, tracebacks, or warnings in
`clyro_backend` / `clyro_celery_worker` logs across the wizard run.

A real deploy then **proved A4** (CloudFormation reached `CREATE_COMPLETE` in ~8.5 min, which was
impossible before) and **falsified the plan's premise for A0** — CodeBuild *does* persist the
working directory across phases, so the `cd` A0 added broke the frontend build. Backend image
built and pushed; frontend `post_build` failed; stack torn down cleanly with zero resources left.
The corrected buildspec has **not yet been exercised live.**

---

## Latency summary

Authoritative agent latencies are server-side Celery task durations (`succeeded in Xs`). Everything else is client-side, measured with an injected `window.fetch` interceptor.

| # | Step | Operation | Latency | Prev. run |
|---|---|---|---:|---:|
| 1 | Step 1 | **RepoRecon scan** (Celery) | **49.79 s** | 41.2 s |
| — | Step 2 | `save_intent` (`POST /intent/` 201) | **89 ms** | 65 ms |
| 2 | Step 3 | **CryloCanvas chat** (Celery) | **15.45 s** | 17.4 s |
| — | Step 3 | Canvas finalize (`POST /canvas/finalize/` 200) | **360 ms** | 434 ms |
| — | Step 4 | AWS connection verify (`POST /aws-connection/verify/` 200) | **1.23 s** | — |
| — | Step 4 | Env-vars save → Secrets Manager write (`POST /env-vars/save/` 200) | **2.46 s** | — |
| 3 | Step 4 | **CryloIac generate** — Kimi K2.5 (Celery) | **344.64 s** (5.74 min) | 372.0 s |
| 4 | Step 4 | **CryloIac validate** — cfn-lint, deterministic (`POST /iac/validate/` 200) | **1.12 s** | 1.2 s |

Supporting client-side calls: `POST /projects/` 51 ms · `GET /github/repos/` 1.68 s · `GET /github/branches/` 1.74 s · `POST /canvas/agent/` 91 ms (202) · `POST /iac/generate/` 63 ms (202) · job polls ~17–27 ms each.

Generate remains ~85% of total wizard wall-clock. It is dominated by the single model call, as established in the prior report (~19% draft / ~52% internal self-correction loop / ~26% final streaming). This run did not change that; Phase B targets it.

---

## Generated template

- 33,295 chars, **62 resources** (previous paid-tier run: 74). Free tier → **0 NAT gateways**, ECS tasks on public subnets with `AssignPublicIp: ENABLED`, `db.t3.micro`, `BackupRetentionPeriod` clamped.
- **cfn-lint: valid — 0 errors, 1 warning** (`W1020`, `Fn::Sub` with no variables — pre-existing, cosmetic).
- **`check_spec_conformance`: 0 findings, 0 blockers.** `security_scan` + reachability + secret-interpolation: clean.
- `validate()` → **`iac_ready`**.

### Phase A fixes verified on real output

| Fix | Expectation | Result |
|---|---|---|
| **A0** frontend buildspec CWD | `post_build` `cd`s into `build_path` before `aws s3 sync` | ✅ `- cd ./frontend` present |
| **Bucket fix** | CodeBuild references the bucket by logical id | ✅ `BUCKET_NAME: !Ref FrontendBucket`; IAM `!GetAtt FrontendBucket.Arn` |
| **A1** SG rules from `network_edges` | every `alb`/`sg_ingress` edge realized | ✅ all 5 edges satisfied |
| **A2** env values | no `*_URL`/`*BROKER*` is an ARN; TLS scheme | ✅ `CELERY_BROKER_URL = rediss://…:6379/0?ssl_cert_reqs=required`, `REDIS_URL = rediss://…` |
| **A3** conformance gate | 0 blockers on a good template | ✅ 0 blockers; `IAC_READY` reached |
| Ordering | env-vars saved **before** generate | ✅ `SECRET_KEY` ARN wired into both task definitions |

**Defect B (ARN broker) did not recur** — deterministically prevented by `enforce_env_values`.
**Defect C (missing ALB ingress) did not recur naturally**: the LLM authored `BackendSecurityGroupIngress` itself this time, so `enforce_security_group_rules` added **nothing** (`Clyro*` rules: none). This is a useful negative result — the defect is model-variance, not a deterministic failure, which is exactly why the enforce pass + conformance gate matter. It also exercised the resolver against a *different* naming style than it was developed on (`ALBSecurityGroup` vs `AlbSecurityGroup`), via the logical-id-stem fallback, without duplicating the rule.

---

## Findings

### 1. The Canvas Agent is confidently wrong about the Celery broker  *(new, user-visible)*

Asked "which component is the Celery broker?", CryloCanvas answered:

> "SQS (the queue node) is serving as the Celery broker… Redis (cache) = Likely used as Celery result backend."

Both halves are false for this app:
- `taskboard/settings/base.py` sets `CELERY_RESULT_BACKEND = "django-db"` — Redis is **not** the result backend.
- The worker **cannot** reach the provisioned SQS queue from `sqs://` alone. kombu resolves the queue by Celery's AMQP queue name (`celery`), not the provisioned `clyro-taskboard-prod-task-queue`, and the task role grants no `sqs:GetQueueUrl`/`CreateQueue`.

It cited the canvas's `worker→queue "consumes"` edge as proof, but that edge is `kind: "none"` in the build spec (no SG rule; IAM-scoped) and says nothing about the broker.

This is now also an **internal inconsistency**: after A2, `build_spec._broker_for` wires **Redis** as the broker, so the explanation the user reads before approving the architecture contradicts the template Clyro generates.

**Root cause:** nothing in Clyro carries a broker choice. `canvas_builder.py:122` hardcodes `aws_service: "sqs"` for any detected queue node; the agent then narrates its own guess. **Fix (upstream, as the plan anticipates):** RepoRecon should detect the broker from the app's dependencies + Celery config and record it, so canvas, agent narration, and template all read one source of truth.

### 2. Detected S3 storage never becomes a canvas node → `AWS_S3_BUCKET_NAME` points at the static-site bucket  *(new)*

Step 1's summary lists "S3 storage", but the finalized canvas has **no `storage` node** — only `service / static / database / cache / worker / queue`. With no bucket of its own, the LLM wired the app's object storage to the frontend's CloudFront origin bucket:

```
AWS_S3_BUCKET_NAME = !Ref FrontendBucket
```

So `django-storages` uploads would land in the bucket that serves the static site. Not a lint or conformance error, and pre-existing (the previous run did the same). Worth an explicit `storage` node or a dedicated app bucket.

### 3. Step 3 → Step 4 still does not auto-advance in-session  *(reproduced)*

`POST /canvas/finalize/` returned `200 finalized` in 360 ms, but the wizard stayed on Step 3; a reload correctly hydrated to Step 4. Resume hydration works; the in-session transition is the gap. Unchanged from the previous report.

### 4. Existing persisted templates now report a conformance blocker  *(expected consequence)*

`enforce_codebuild_projects` is guarded on `BuildArchiveBucket:`, so a template generated *before* the bucket fix keeps its old guessed bucket name. `check_spec_conformance` now flags that as a blocker. This is correct — that template genuinely would fail `aws s3 sync` — but it means **older projects must regenerate, not merely re-validate**, before provisioning.

---

---

## Deploy attempt #1 (after implementing A4) — partial success, then torn down

A4 was implemented (`enforce_ecs_desired_count` → build → `scale_services_to_spec`) and the stack
was provisioned through the GUI.

| Phase | Result | Duration |
|---|---|---:|
| CloudFormation create → `CREATE_COMPLETE` | ✅ **62 resources** | **~8.5 min** |
| Backend CodeBuild (docker → ECR) | ✅ Succeeded (1 image pushed) | — |
| Frontend CodeBuild | ❌ **Failed in POST_BUILD** | — |
| ECS scale-up | never ran (build failed first — correct behaviour) | — |
| Teardown (GUI) → stack `GONE` | ✅ zero resources left | **8.4 min** |

### A4 is proven

The stack reached `CREATE_COMPLETE`. Before A4 this was impossible: services were authored
`DesiredCount: 1` against an empty ECR repo, so ECS could never stabilize, CFN never completed,
and the build that would have filled the repo never ran. Authoring `DesiredCount: 0` breaks the
cycle — CFN completed in ~8.5 min and the backend image built and pushed.

### The frontend failure was a regression I introduced in A0

```
[Container] Entering phase POST_BUILD
[Container] Running command cd ./frontend
/codebuild/output/tmp/script.sh: 4: cd: can't cd to ./frontend
[Container] Command did not exit successfully cd ./frontend exit status 2
```

**CodeBuild carries the working directory across phases.** The execution plan asserted the
opposite, and A0 was built on that premise: it added `cd {build_path}` to `post_build`. Since
`build` had already `cd`-ed into `frontend/`, `post_build` started there and `cd ./frontend`
resolved to `frontend/frontend/`. `npm ci` and `vite build` both succeeded (`dist/index.html`,
`dist/assets/index-*.js`, 28 modules) — only the added `cd` failed.

Fixed by anchoring on an absolute `OUT_DIR="$CODEBUILD_SRC_DIR/frontend/dist"`, which is correct
whether or not the working directory persists. **Lesson: a static assertion ("the `cd` is present
in the template") verified the change matched the plan, not that the plan was right.** Only the
live build could catch this.

### Correction to the earlier Defect-D analysis

The bucket-name mismatch (§Findings) is real but **model variance**, not the universal cause. In
*this* generation IacArchitect named the bucket `clyro-taskboard-prod-frontend-<acct>` — exactly
what the old reconstructed name would have been — so the mismatch did not occur here, and the
frontend build failed solely on the `cd`. In the *previous* project's template the bucket was
`clyro-taskboard-prod-<acct>` (no node-id segment), which is what broke `aws s3 sync` there.
Referencing the bucket by logical id removes the variance permanently; it was not what broke this
build.

### A second bug found in A4's own wiring (fixed before deploy #2)

`tasks.run_build_task` ("Retry build") calls `build.build_with_feedback` **directly**, bypassing
`provision_with_feedback`. The scale-up initially lived in the latter, so a retried build would
have reported `COMPLETE`/`LIVE` while every ECS service still ran **zero tasks**. Scale-up moved
into `build_with_feedback` (shared by both paths) and `run_build_task`'s `soft_time_limit` raised
1200 → 2100 s to cover the build poll plus the steady-state wait.

### Clyro has no stack-update path

`deploy.start()` only ever calls `create_stack`, and refuses a live stack ("already provisioned").
So a corrected buildspec cannot reach an already-provisioned stack through the product — the only
route is teardown + re-provision. Worth addressing: an `update_stack` path would have turned this
into a 2-minute fix instead of a full recreate.

### Teardown is clean

Verified across six services after `DELETE_COMPLETE`: no CloudFormation stack, S3 buckets, ECR
repos (including the pushed image), ECS clusters, RDS instances, load balancers, or ElastiCache
groups remain. The auto-empty logic (commit `8e8fc16`) handled the non-empty bucket/repo that
CloudFormation would otherwise refuse to delete. **No ongoing charges.**

Left in the account intentionally: the `ClyroBootstrap-E2E-Hardening-Test` IAM role stack and the
`clyro/e2e-hardening-test/SECRET_KEY` secret (~$0.40/mo), both reusable on the next provision.

---

## Still not verified

- **Frontend `post_build`** — `aws s3 sync` from the absolute `OUT_DIR`, and
  `cloudfront create-invalidation`, have **never executed successfully**. The corrected buildspec
  has not yet run in CodeBuild.
- **Defect B** — whether `rediss://…?ssl_cert_reqs=required` actually connects the Celery worker to
  the transit-encrypted ElastiCache. Verified in the template only.
- **Defect C** — whether the ALB health check passes now that `BackendSecurityGroup` has its
  ingress on 8000. The services never ran a task, so the health check never fired.
- **A4's scale-up** — `scale_services_to_spec` has never run against a real stack.
- **A5 (runtime-aware self-correction)** — not implemented; the correction loop still reads CFN
  stack events only, so it remains blind to container crashes, ALB health, and build logs.

## Methodology

- Drove the real UI in Chrome for Steps 1–4 (clicks, typing, form controls). The user performed the AWS bootstrap-role connect and supplied `SECRET_KEY`.
- Agent latencies taken from Celery `succeeded in Xs` (authoritative); HTTP latencies from an injected `window.fetch` interceptor.
- Template assertions run server-side via `manage.py shell` against `Deployment.cloudformation_template`, parsed with `cfnlint.decode.cfn_yaml`.
- Logs swept for `error|exception|traceback|critical|failed|warning` across `backend` and `celery_worker` after every stage.
