# Chapter 19: Audit Remediation, Production Deploy & Live E2E Verification Report

> **Dated note added 2026-09-06. This is a historical record; the body below is
> left exactly as written and is not a description of the platform today.**
>
> The session recorded here is undated in the file and took place around
> 2026-08, against the previous platform architecture. Every statement it makes
> about **Clyro's own** infrastructure has since been replaced by the
> consolidation onto a single EC2 instance:
>
> | This chapter says | What runs today |
> | --- | --- |
> | A Lambda backend behind API Gateway | uvicorn in a container on one `t4g.small`, behind nginx, with `api.clyro.cloud` as a plain Route53 A record |
> | SQS as the Celery broker, with worker and beat on Fargate | The `redis:7-alpine` container on the same box; worker and beat are containers beside it |
> | `clyro-prod-rds`, started and stopped on a cost schedule | `postgres:16-alpine` in a container, on a dedicated EBS volume |
> | A `modules/nat-instance` Terraform module and its AMI footgun | No NAT of any kind, and no private subnets |
> | An `infrastructure/workloads/celery_worker.tf` layer | No `workloads` layer at all: only `bootstrap` and `foundation` |
>
> See Chapter 6 for the current architecture. Note that the same superseded
> description still survives in code comments at `backend/config/settings.py`.
>
> Everything else here stands: the IDOR fix, the reconcile sweep, the cost
> engine work, and the live customer-stack provision and teardown result.

This chapter records a single session's work: closing out every outstanding item in
`audit/`, fixing a launch-blocking gap the audit never caught, pushing the result to
production, and driving a full Step 1→7 provisioning + teardown pass against
`clyro.cloud` with a real (free-tier) AWS account to prove it actually works. Treat this
as the permanent record of what shipped and what's still open — see ch. 6 for the
infrastructure details and ch. 18 for the IAM review.

## What shipped

### A launch-blocking gap found during planning, not in `audit/`
Every async wizard action (scan, canvas chat, IaC generate/refine, provisioning,
recreate, build, warmup, plus the new reconciliation sweep) is dispatched via Celery
`.delay()`. Production had no consumer for any of it — the Lambda's environment had no
`CELERY_BROKER_URL`, silently falling back to `settings.py`'s local-dev Redis default (a
hostname that doesn't resolve inside the Lambda's VPC). Fixed with an SQS broker + a
small ECS Fargate service running `celery worker` + `celery beat` off the existing
backend image. Full details, including the debugging path to get it actually working
live, are in ch. 6.

### Security
- Fixed a real cross-account IDOR: `github_installations()` let any authenticated user
  reassign another account's GitHub App installation by POSTing its `installation_id`.
- Added the missing production Django security settings (HSTS, secure cookies, SSL
  redirect via `SECURE_PROXY_SSL_HEADER`, `X-Frame-Options`), gated on
  `ENVIRONMENT=production`. Verified live post-deploy: no redirect loop against API
  Gateway, HSTS header present on real responses.
- Added the IAM least-privilege review (ch. 18).

### Reliability
- `app.provisioning.reconcile.sweep()`: a scheduled sweep (Celery beat, every 15 min)
  that proactively marks dead `AWSAccountConnection`s and resolves `Deployment`s stuck
  in `deleting` — found live: `teardown()`'s first step (`_assume()`) failing silently
  left both unresolved forever, with 12 dead connections and 3 stuck deployments found
  in the dev DB before this shipped.
- Fixed a duplicate-request race in `iac_generate` (a StrictMode double-effect or a
  double-click could bake a stale network config into the generated template).

### Correctness
- RepoRecon gained a deterministic manifest-based detector
  (`app.scanner.deterministic_detector`) as its fast path, falling back to the LLM agent
  only when it can't confidently classify the repo — also fixes the broker field always
  being reported as `"sqs"` even when Redis was the real one.
- Canvas gained a `"storage"` node type wired to a dedicated S3 bucket; the broker
  source-of-truth fix flows through to `canvas_builder`.
- Cost engine is now free-tier-aware: RDS/S3 are zeroed within Free Tier limits; ECS
  Fargate/ElastiCache, which have no free tier, are never zeroed.
- Deterministic ACM/HTTPS/Route53 support in `cfn_generator`, resolved live at
  `deploy.start()` since `generate()`/`refine()`/`validate()` make no AWS calls by
  design. Domain question reintroduced at Step 3.
- Fixed the Monaco *editor* worker never constructing under Vite (same fix already
  applied to the YAML worker, now applied to the base editor worker too) — **see "Still
  open" below: this did not fully resolve the console errors.**
- Added warmup for RepoRecon/Reasoning at Step 1/2, matching Step 4/5's existing
  IacArchitect warmup.

### Test coverage
- New moto-backed test suite for `deploy.py` (`tests_deploy.py`), prioritized by risk:
  `recreate()`'s `_has_been_live` gate first (a bug here would let a rebuild destroy
  live customer data), then `start()`'s `create_stack` retry loop, `teardown()`'s
  bucket/repo emptying, `poll()`'s race-guarded status transitions, and
  `_apply_stack_update`'s stateful-resource-change refusal.
- Fixed up `frontend/e2e/provisioning.spec.js` for the current 7-step wizard
  (AWS-connect moved to Step 2) and wrapped its teardown in a `finally` block so a
  failed assertion mid-run can't strand billable AWS resources.

### A Terraform footgun found along the way
`modules/nat-instance`'s `data "aws_ami"` used `most_recent = true` with no pinning — it
resolves to a different AMI id every time Amazon publishes an AL2023 point release, and
AWS forces an EC2 replacement on an AMI change. A routine, otherwise-unrelated
`terraform plan` on `foundation` wanted to destroy and recreate the live NAT instance for
exactly this reason. Fixed with `lifecycle { ignore_changes = [ami] }`.

## Production deploy

Both `deploy-frontend.yml` and `deploy-backend.yml` were triggered against
`clyro.cloud` (not just prepared) — the backend run included the real migration step
against `clyro-prod-rds` (two new migrations: `IntentRecord.route53_hosted_zone_id`,
`AWSAccountConnection.health_status`/`last_reconciled_at`). `infra-start.yml` was run
first since the prod RDS/NAT instance were stopped by the overnight cost-saving
schedule.

New Terraform (`infrastructure/workloads/celery_worker.tf` + a small
`infrastructure/foundation/iam.tf` addition) was applied directly via `terraform apply`
using the `clyro` AWS CLI profile, since this environment's own safety controls block
`terraform apply` from an agent by default — each apply required explicit operator
confirmation, including a `-target`ed apply for the foundation change specifically to
avoid an unrelated, pre-existing NAT-instance-replacement plan (see above) getting
swept in.

## Live E2E verification against clyro.cloud

Drove the full wizard interactively (Steps 1→7 + teardown) against production, using a
**disposable free-tier AWS account** (never Clyro's own production account) for the
CFN bootstrap quick-create — that one step genuinely can't be automated (it opens a
real AWS Console tab), so it was driven by a human while everything else was driven
programmatically via browser automation.

**Result: full success.** Real SQS queue, ALB, CloudFront distribution, RDS database,
and S3 frontend/app-storage buckets were provisioned end-to-end (`run_provision_task`
completed in 784s), reached "Your infrastructure is live," and were torn down again via
the UI's delete flow — confirmed via CloudFormation directly (`describe-stacks` returned
"Stack ... does not exist" once complete) and via an independent post-teardown sweep of
the test account: zero `clyro-*`/`app-dev-*` CloudFormation stacks, ECS clusters, RDS
instances, or S3 buckets remained. The ElastiCache Redis replication group was, as
expected, the slowest resource to tear down (several minutes after everything else had
already gone to `DELETE_COMPLETE`).

### Bugs found live during this pass (beyond what's listed above)

1. **The `crylo-github` GitHub App's Setup URL was configured for `localhost`, not
   `clyro.cloud`** — blocked new installations in production entirely. This is a GitHub
   App dashboard setting, not a code fix; corrected during this session. Follow-up:
   GitHub Apps only support a single Setup URL (Callback URLs support multiple, Setup
   URL doesn't) — local dev and production can't cleanly share one App's post-install
   redirect. Recommended fix: a second GitHub App scoped to local dev.
2. **The deterministic detector's settings-file search used a fixed list of
   conventional paths** (`settings.py`, `config/settings.py`, ...) and missed a
   custom-named Django project package (`backend/taskboard/settings/base.py`) —
   silently found zero env vars, causing two false-positive compliance blockers
   (`DATABASE_URL`/`ALLOWED_HOSTS` "not detected" when the repo handled both
   correctly). Fixed to search the tree directly for any `*settings.py` or `settings/`
   package instead of guessing the project's own name; regression test added.
3. **ECS's image-tag resolution appeared to cache the digest per task-definition
   revision** — after fixing the Celery container's entrypoint and pushing a new
   `:latest` image, tasks kept pulling the *old* pre-fix image (confirmed via
   `imageDigest` in `describe-tasks`) until a **new task-definition revision** was
   registered, even though nothing else about the task definition changed. Operational
   note for future image-only updates to this service: register a new revision (or wait
   for the next `terraform apply` that touches `container_definitions`) rather than
   assuming a `:latest`-tagged service picks up a fresh push automatically.

### Still open (not fixed this session)

- **Monaco YAML language service RPC errors are still present in production**
  (`Missing requestHandler or method: getCodeAction/findDocumentSymbols/getFoldingRanges`),
  observed live on the Step 5 template review screen. This session's fix (applying the
  YAML worker's wrapper-file pattern to the base editor worker too) did not resolve
  it — the errors reference YAML-specific language-service methods, so the actual root
  cause is more specific than what was fixed. Cosmetic only (cfn-lint validity bar
  unaffected), but still open; needs a fresh root-cause pass, ideally with real browser
  devtools open on the Step 5 screen rather than reasoning from the bundled/minified
  stack trace alone.
- **`REDIS_URL` is classified as a user-supplied secret, not auto-generated** — found
  live on the Step 1→2 secrets screen: `SECRET_KEY` and `AWS_S3_BUCKET_NAME` are
  reasonable to ask the user for, but `REDIS_URL` should probably be injected by Clyro
  the same way `DATABASE_URL`/`CELERY_BROKER_URL` already are, since the real
  ElastiCache endpoint isn't known until provisioning. Worth checking whether
  `deterministic_detector._GENERATED_ENV_KEYS` should include it, or whether this
  needs a deeper look at why the repo's own `REDIS_URL` usage wasn't classified as
  cache-related.
- Everything flagged as out of scope in the original `audit/` review-only items (IAM
  Access Analyzer periodic review, generated customer role deep-dive) remains a
  standing/recurring item, not a one-time fix — see ch. 18.
