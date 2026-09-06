# Chapter 11: Wizard Steps 2, 5 and 6, from AWS account to running service

> **Filename note.** This file is `ch_11_wizard_step_4_deploy.md` because all of this was
> "Step 4" under the old five-step wizard. It is now three separate steps: **Step 2**
> connects the AWS account, **Step 5** generates and validates the template, and
> **Step 6** reviews and provisions. The filename is kept so existing links keep working.
>
> Rewritten 2026-09-06 against the code.

Everything here happens in the **user's** AWS account, on temporary credentials. Clyro's
own account holds no customer infrastructure.

## 11.1: Step 2, connect your AWS account

Clyro never asks for an access key. Long-lived IAM user credentials do not expire and, if
leaked, grant permanent access. The pattern here is a cross-account role with an
ExternalId, assumed for short-lived credentials, and it is the same pattern Terraform
Cloud, Pulumi and CDK Pipelines use.

### The flow

**On mount**, the frontend calls `POST /api/projects/<id>/aws-connection/`
(`app/provisioning/views.py::aws_connection_init`). Inside a transaction, with
`select_for_update` to serialise React StrictMode double-mounts, it creates or reuses a
pending `AWSAccountConnection` and mints a UUID as the **ExternalId**.

> That UUID is stored in a field called `bootstrap_stack_id`, which is misleading. It is
> the ExternalId, not a CloudFormation stack id, and the ARN-matching logic on verify
> depends on that.

**The user gets a CloudFormation quick-create URL.** Built by
`app/provisioning/cfn_bootstrap.py::generate_cfn_console_url`, it is a plain console link
carrying a stack name (`ClyroBootstrap-<project>`), the template URL, and two parameters:
Clyro's account id and the ExternalId. The template URL is a plain S3 object published by
`infrastructure/foundation/cfn_bootstrap.tf`, not a pre-signed URL, and the backend
refuses to start if it is unconfigured.

**The user creates the stack**, which takes about 30 seconds and creates exactly one
thing: an IAM role named `clyro-provisioning-<ExternalId>`, whose trust policy admits
Clyro's account and **requires a matching `sts:ExternalId`**. The user copies the
`RoleArn` output back into Clyro.

**Verify** (`aws_connection_verify`) matches the pasted ARN's role name against the
pending connections, so pasting the ARN from a different Clyro project gets a clear error
rather than a confusing failure later. Then it assumes the role with a one-hour session,
calls `sts:GetCallerIdentity` to learn the real account id, writes any staged secrets to
Secrets Manager, and records the connection.

Statuses run `aws_connect_pending`, then `aws_verified`. There is an `aws_connected`
value in between, but the same request overwrites it, so nobody ever sits in it.

### Two things that do not work as the UI implies

> **The account type check cannot fire.** Verify tries to read the account's real plan
> type with `freetier:GetAccountPlanState`, and **`bootstrap.yaml` grants no `freetier`
> permission at all**. The call is denied, the error is swallowed, `verified_account_type`
> stays null, and the mismatch condition requires it to be non-null. So the "this looks
> like a paid account, not what you selected" banner can never render, and the wizard
> always lands on `aws_verified`. The claimed account type is used as-is. This is worth
> fixing; until it is, do not describe verification as checking the account against AWS.

> **Two regions are in play and neither is chosen here.** The quick-create URL is always
> built for `us-east-1`, because the view reads a region from a request body the frontend
> does not send. Verify sends the user's region preference, which defaults to
> `ap-south-1`, and that is what `AWSAccountConnection.aws_region` records. The stack
> therefore lands in whichever region the console opens while the connection records the
> preference. There is no region picker on this step.

### Secrets are written here, not at Step 6

`_write_staged_secrets` runs inside verify. Every `EnvVarKey` with a staged value is
written to Secrets Manager under `clyro/<project-slug>/<key>`, and every key hinted
`agent_generatable` gets a fresh `secrets.token_urlsafe(48)` if it does not already have
one. The staged plaintext is cleared once the write succeeds.

The reason it happens this early is that `build_spec` at Step 5 silently drops any
`EnvVarKey` with no `secrets_manager_arn`, so a secret written later than the spec is a
secret the container never receives. Step 6's secrets screen is the fallback for anything
left unwritten.

## 11.2: Step 5, generate and validate the infrastructure

### Generation is deterministic

> **This is the single most commonly misdescribed thing in the product.** The happy path
> of template generation uses **no LLM**. `iac.generate()` calls
> `cfn_generator.generate_template(spec)`, pure Python. The `CryloIac_IacArchitect`
> runtime is scoped to the "Ask Clyro" refine chat and to a rare fallback when the
> deterministic output is not clean. Chapter 13 is the full account of why.

Generation starts on its own once the step hydrates and finds no template. There is no
confirmation screen. The request de-duplicates in-flight jobs and enqueues
`run_iac_generate_task`; the frontend polls the `AgentJob`.

The model picker in the UI applies only to refine turns. It defaults to GLM-5. Anthropic
model ids are still listed in `IacArchitect/model/load.py`, but they currently fail on
this AWS account with `INVALID_PAYMENT_INSTRUMENT`, which is part of why the defaults are
MiniMax M2.5 to generate and GLM-5 to refine.

The progress messages in the editor are a timed six-stage loader driven by elapsed
seconds, not by the real backend phase. The real phase is reported separately, and the
`thinking` field on it is for backend debugging and is deliberately never rendered.

### What validation actually runs

All in-process and deterministic:

1. **cfn-lint**, through `cfnlint.api.lint`, region-aware.
2. **Fourteen enforcers**, deterministic rewriters applied in a fixed order: free-tier
   limits, RDS and ElastiCache deletion policies, RDS `DBName`, log group naming,
   security group rules, task egress, the ECR image repository, the CloudFront and S3
   origin policy, the health check path, URL-safe secret charsets, required env, env
   values, ECS desired count, and security group description charsets.
   `enforce_codebuild_projects` is deliberately outside that list and called separately.
3. **Five checks**: `security_scan` (a regex pass for placeholder images, broken
   credential interpolation, hardcoded account ids, wildcard principals, `Resource: "*"`
   on sensitive IAM actions, and unverified CloudFront policy ids),
   `check_ecs_network_reachability`, `check_secret_interpolation`,
   `check_within_capabilities` and `check_spec_conformance`.

Two of those deserve naming. **`check_within_capabilities` parses
`backend/cfn-templates/bootstrap.yaml` itself** and blocks any resource type the connector
role has not been granted permission to create, so a template that would fail on an IAM
denial is caught before it is submitted. It is a denylist, and it disables itself if the
file cannot be parsed. **`check_spec_conformance`** asks whether the template actually
realises the build spec: a security group rule for every network edge, ALB ingress in
both directions, no ARN sitting in an env var that wants a URL, required literal env
present, an ECR repository for every buildable node, no `IAM::ManagedPolicy`, legal
CloudFront origin request policies, URL-safe generated secrets, a matching health check
path, task egress, ECS images matching what CodeBuild pushes, and a frontend bucket name
that resolves.

> **cfn-guard does not run server-side.** Only cfn-lint does. cfn-guard lives in the
> `clyro-mcp-cfn` Lambda as an MCP tool the *agent* may call during a refine turn, and
> only for models that support tool use. Do not describe every template as cfn-guard
> checked.

### Refine

The agent classifies a turn as an answer (template untouched) or an edit. Edits arrive as
search-and-replace blocks, each of which must match exactly once or the whole thing falls
back to a full-template rewrite. A response with no `Resources:` in it is discarded and
the current template kept.

Two bounded repair loops sit behind it, both capped at two rounds and both **strictly
monotonic**: a lint fix loop that accepts a round only if it reduces the error count, and
a security fix loop driven only by blocker-severity findings. Warnings and criticals are
left for the user to decide about.

### What gates Continue

> **A successful generate does not unlock Continue. The user must click Validate.**
> `generate()` and `refine()` both leave the deployment in `generating_iac`; only
> `validate()` can set `iac_ready`, and only when cfn-lint is clean and there are no
> blockers. This is the likeliest thing for a reader to get wrong about Step 5.

`validate()` also adds one check the others do not: `check_required_secrets_present`,
which is database-driven rather than template-driven. And it refuses to demote a
deployment that already has a live stack, which was a fix for a real incident.

## 11.3: Step 6, review and provision

Four phases in one screen: review, secrets, provisioning, success.

### Review

The template is parsed client-side into a bill of materials. Some tiles on this screen are
hardcoded, including the "~10-15 min" estimate and the manual-actions count. They are not
computed from anything.

### The provisioning order

This is the part documentation gets wrong most often, so here it is in order, with the
functions that own each part.

1. **`deploy.start(project)`**, synchronously in the request. It re-runs the findings
   collection and refuses on any blocker, because a stale `iac_ready` is not evidence.
   It assumes the role, refuses if a live stack already exists, deletes a rolled-back one,
   clears the previous log and output rows, resolves the Route53 hosted zone, and calls
   `create_stack` with up to four attempts and five-second backoffs to ride out
   "already exists" and "in progress" races.

2. **Every ECS service is authored with `DesiredCount: 0`.** `iac.enforce_ecs_desired_count`
   rewrites whatever the template said, because ECS defaults to 1 and a service that wants
   a task cannot start before an image exists. The stack has to be able to reach
   `CREATE_COMPLETE` with an empty ECR repository.

3. **Poll to terminal**, at 8 second intervals with a 25 minute ceiling per attempt.
   `poll()` flips a completed stack to `building` under `select_for_update`; it never
   promotes straight to complete.

4. **Build.** `build.build_with_feedback` downloads the repository tarball with a GitHub
   App installation token, converts it from tar.gz to **zip** (CodeBuild's S3 source only
   auto-extracts zip) and strips the wrapper directory, uploads it to a build-archive
   bucket in the customer's account, and starts one CodeBuild per buildable node. The
   GitHub token never enters the CodeBuild environment: the build source is a plain S3
   object Clyro uploaded, so no GitHub credential can appear in a customer log stream.
   Build polling is 10 seconds with a 15 minute ceiling.

5. **Migrations.** `deploy.run_migrations` runs the application's migrations as a
   **one-off ECS `RunTask` on the live service's own task definition**, lifting its
   subnets, security groups and public-IP setting, in the container matched by node id.
   Five minute timeout. The only migrate command currently known is Django's
   `python manage.py migrate --noinput`, and the worker node is deliberately excluded.
   **A migration that runs and fails stops the deploy.** A migration that cannot be
   *located*, because there is no matching service or no migration framework, is not a
   failure and passes silently.

6. **Scale to the spec.** `deploy.scale_services_to_spec` sets each service to its
   desired count from the spec, matching service names by suffix so `-backend-worker` is
   not mistaken for `backend`. It then waits: 10 second polls, an 8 minute ceiling, and
   **three consecutive good samples** before it believes the result. A good sample means
   running equals desired with nothing pending, no task stopped after the scale-up (which
   would be a crash loop), and all ALB targets healthy.

7. Only then does the deployment become complete and the project `live`.

> **The migrations and the scale-up are owned by `build.py`, not by the provisioning
> supervisor.** That is deliberate: it means the "Retry build" path repeats them too.

### When it fails

Four separate mechanisms, at different layers, and they are more bounded than they sound:

- **Deterministic repair** (`_deterministic_template_fix`) fires for free-tier account
  rejections only. It prefers the connection's verified account type over sniffing the
  AWS error text, and fixes the backup retention period and the DB instance class in one
  pass. Everything else returns false.
- **The feedback loop** (`provision_with_feedback`) runs **exactly one** bounded round:
  find the root cause from the first non-stack failed event, enrich it, attempt the
  deterministic fix, revalidate, resubmit, poll. No LLM is involved. Unknown failures
  surface the real AWS error.
- **Rollback** is CloudFormation's own. A retry deletes the rolled-back stack first.
- **Live-stack self-heal** (`_heal_live_stack`) is the only path that calls the LLM, and
  only when the stack is already complete and the application failed. It refines, computes
  a **change set**, and **refuses the update** if it would replace or remove any stateful
  resource: an RDS instance or cluster, an ElastiCache replication group or cluster, EFS,
  or S3.

**Recreate** is a full teardown and reprovision, and it is hard-gated to projects that
have never been live, both in the view and in `deploy.recreate`. It is not a general
retry.

Two frontend behaviours worth knowing: a `failed` status is **not treated as terminal**
while the supervising `AgentJob` is still running, so the UI keeps polling and says
"retrying with a correction". And `build_failed` is a distinct terminal state offering
"Retry build", which explicitly does not resubmit CloudFormation.

Stack outputs are filtered before they are persisted; anything leaking the account id is
stripped.

### Verified end to end, 2026-09-06

The first complete unattended run finished on this date: a GitHub repository to a running
ECS service in a third-party AWS account, with migrations applied and no manual step.

It required one fix. The connector role had every ECS service-management action but not
`ecs:RunTask`, so every first deploy into a customer account died at 100% with "Could not
start the database migration". Earlier runs never reached that point because RDS blocked
them first. Fixed in commit `5e1c245`, which also granted the `DescribeTasks`,
`ListTasks` and `StopTask` the migration poll and its timeout cleanup need.

Two honest limits on that result. The task's health status was `UNKNOWN`, because the
generated task definition carries no container health check. And the development-shaped
topology has no load balancer, so **public reachability was not demonstrated**. The run
proves the pipeline, not the endpoint.

## Step outputs

| Output | Location | Consumer |
| --- | --- | --- |
| Deployed CloudFormation stack | The user's AWS account | The live infrastructure |
| Stack outputs (URLs, ARNs), account-id-safe | `DeploymentStackOutput` and the success screen | Step 7 |
| Provisioning log | `ProvisioningLogEntry` | The live feed, audit, debugging |
| Secrets Manager entries | The user's AWS account | Container runtime env |
