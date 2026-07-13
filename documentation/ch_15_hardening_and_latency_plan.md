# Clyro Provisioning — Hardening & Latency Execution Plan

> **Audience:** a Claude Code session executing this plan with **cold context**. Everything
> needed to make correct changes is in this file. **Do not guess** at file paths, function
> names, or AWS specifics — every anchor below was verified against the live repo on
> 2026-07-08/09. When a step says "read X first," read it — line numbers drift, so anchor
> by **symbol name**, not line number.

---

## 0. READ FIRST — environment, execution model, and anti-hallucination rules

### 0.1 Where code runs (this trips people up)
There are **two** codebases with **different deploy models**:

1. **Backend (Django)** — `backend/app/**`, `backend/core/**`. Runs in the local Docker
   container `clyro_backend` (+ `clyro_celery_worker`). **Edits take effect after a
   container restart.** After editing backend code:
   ```
   docker compose restart backend celery_worker
   ```
   (If `clyro_backend` crash-loops on `ModuleNotFoundError`, it's the known stale anon-venv
   volume — fix: `docker compose up -d --build --renew-anon-volumes backend`.)

2. **Agents (AgentCore)** — `backend/agents/CryloIac/app/IacArchitect/**` (and the two
   CryloCanvas agents). These run on **deployed AWS Bedrock AgentCore runtimes in
   `ap-south-1`, account `321613317660`**. **Editing agent code locally does NOTHING until
   the agent is REDEPLOYED to AgentCore.** The IaC runtime is
   `arn:aws:bedrock-agentcore:ap-south-1:321613317660:runtime/CryloIac_IacArchitect-6oodT43I5f`.
   - Runtime ARNs are Django settings: `IAC_RUNTIME_ARN`, `REASONING_RUNTIME_ARN`,
     `REPORECON_RUNTIME_ARN`.
   - **Model selection is payload-driven** (the backend sends `{"model": "<key>"}`;
     `resolve_model_id` honors it) → **no redeploy** needed to change models.
   - **Prompt / tool / output-format changes to the agent DO require a redeploy.** The command
     is **`agentcore deploy`** run from `backend/agents/CryloIac/agentcore/` (see
     `backend/agents/CryloIac/README.md` §"Scaffolding the deployable project" — you may need
     to regenerate the CDK scaffold + `agentcore.json` first per that README; it creates the
     `AgentCore-CryloIac-<target>` stack). After deploy, confirm the runtime picked up the
     change (see the log-line check in §0.3). **Batch all agent changes and redeploy once per
     phase.**
   - **MCP tools (cfn-lint, cfn-guard, compliance) run in a separate `crylo-mcp-cfn` Lambda**
     (the `CryloIacGw` gateway target), **not** in the agent runtime and **not** in the Django
     backend. Changing a *tool* means redeploying that Lambda too (per the README). This
     matters for B6 (cfn-guard is NOT available in the backend container — verified).

### 0.2 How to run backend code / test template generation
Server-side shell (no HTTP token needed):
```
docker exec clyro_backend python manage.py shell -c "<python>"
# or, for multi-line scripts:
docker exec -i clyro_backend python manage.py shell < /path/to/script.py
```
- Live test project used during discovery (has a finalized canvas + intent + env-vars, and a
  torn-down deployment whose `cloudformation_template` is still in the DB — read it for the
  current authoring style): `Project id = 7d9a840c-4540-40b5-9cfe-0727418718bc` (name
  "E2E-Latency-Test"), AWS account `321613317660`, region `us-east-1`.
- The **deployed customer app** used in the E2E test is a separate local repo at
  **`/home/durvesh/git/test-app/`** (`Durvesh717/test-app@main`, Django+Celery+React). Read
  `test-app/backend/taskboard/settings/base.py` for how it consumes env (relevant to A2).
- Regenerate a template and inspect it (the pattern used throughout discovery):
  ```python
  from app.provisioning import iac
  from core.models import Project, Deployment
  p = Project.objects.get(id="7d9a840c-4540-40b5-9cfe-0727418718bc")
  res = iac.generate(p, model="kimi-k2-5")   # ~4 min, billable; Kimi/MiniMax per user pref
  d = Deployment.objects.filter(project=p).order_by("-created_at").first()
  # d.cloudformation_template holds the YAML
  print(iac.lint_template(d.cloudformation_template, "us-east-1"))
  ```
- **cfn-lint** is available server-side via `iac.lint_template(template, region)` →
  `{is_valid, errors, warnings, diagnostics:[...]}` (`errors`/`warnings` are **int counts**;
  detail lines are in `diagnostics`).
- **Deploys are billable and USER-RUN.** `deploy.start` is gated by the harness — never run
  it yourself. Hand the user this one-liner (via a leading `!`) when a live deploy is needed:
  ```
  ! docker exec clyro_backend python manage.py shell -c "from app.provisioning import deploy; from core.models import Project, AgentJob; from app import tasks; p=Project.objects.get(id='7d9a840c-4540-40b5-9cfe-0727418718bc'); print(deploy.start(p)); j=AgentJob.objects.create(project=p, kind=AgentJob.Kind.PROVISION); tasks.run_provision_task.delay(str(j.id), str(p.id))"
  ```
- **Do NOT print raw result dicts** from provisioning calls to the terminal — they contain
  temp STS credentials and get scrubbed/blocked. Print only the specific fields you need.

### 0.3 Anti-hallucination checklist (apply to every task)
- [ ] Read the target function/file **before** editing; match `old_string` exactly.
- [ ] Anchor by **symbol name** (function/RE-constant), never a bare line number.
- [ ] Verify spec keys against `backend/app/provisioning/build_spec.py` (see §2) — do not
      invent keys.
- [ ] After a **template**-affecting change: regenerate and run `iac.lint_template` — 0 errors.
- [ ] After a **backend** change: `docker compose restart backend celery_worker`.
- [ ] After an **agent** change: redeploy CryloIac, then confirm via a CloudWatch log line
      `IacArchitect invoked (mode=..., model=...)` (log group
      `/aws/bedrock-agentcore/runtimes/CryloIac_IacArchitect-6oodT43I5f-DEFAULT`, `ap-south-1`).
- [ ] Never commit test files or throwaway scripts; keep them in the scratchpad. Commit
      messages: one short line; many small single-concern commits.

### 0.4 Source-of-truth documents
- `clyro-e2e-latency-report.md` (repo root, untracked) — full E2E findings + latencies.
- Memory: `deploy-e2e-findings.md`, `step4-iac-state.md`, `backend-venv-drift.md`.

---

## 1. Why we're doing this (confirmed root causes)

A real E2E deploy (Django+Celery+React app `Durvesh717/test-app`) provisioned cleanly but the
app never went live. Four defects, all **confirmed from the generated template**:

| # | Defect | Root cause (verified) |
|---|---|---|
| A | Cold-start **build→ECS deadlock** | `provision_with_feedback` runs the build only *after* CFN `CREATE_COMPLETE`; ECS is authored `DesiredCount: 1` on an ECR image that's empty until the build → `CannotPullContainerError` → ECS never stabilizes → CFN never completes. Deadlock. |
| B | Worker crash-loop | `CELERY_BROKER_URL` authored as `!Sub ${TaskQueue.Arn}` — the SQS **ARN**, not a `sqs://` broker URL → kombu falls back to pyamqp → `UnicodeError: idna label too long`. |
| C | Backend ALB `/health` `Target.Timeout` | Template wrote ALB→backend **egress** but **omitted** the reciprocal **ingress** on `BackendSecurityGroup` from the ALB SG on `8000`. Backend SG default-denies inbound → health check unreachable. |
| D | Frontend build fails | `codebuild_spec._frontend_buildspec` does `cd ./frontend` in the `build` phase but not in `post_build`; CodeBuild doesn't persist CWD across phases → `OUT_DIR=dist||build` resolves at repo root → syncs a non-existent dir → `exit 1`. |

**Unifying insight:** B, C, D are **fully determined by the build spec**, yet Clyro delegates
their wiring to the LLM (which makes subtle errors) and only validates *"is the infra
well-formed?"* (cfn-lint/cfn-guard), never *"does it match the spec / will the app run?"*. The
loop can't catch them because it reads **CFN stack events only**, never container/build logs.
The fix: **generate spec-derivable wiring deterministically, and validate spec-conformance
before deploy.**

---

## 2. The build spec is the source of truth (data model)

Built by `build_spec.build_spec(...)` in `backend/app/provisioning/build_spec.py` (function at
`def build_spec(`, ~line 119; the dict is returned ~line 276). Consumed via
`iac._spec_for(deployment)` (which calls `canvas_ops.parse_canvas`, `_intent_for_spec`,
`_env_vars_for_spec`, then `build_spec`). **Verify these keys before using them.**

- `spec["resources"]`: list of `{node_id, label, type, aws_service, cfn_resources:[...],
  security_group, image, container_port, public, build_path, ...}`. `type` ∈
  {service, worker, static, database, cache, queue}. `image: "ecr"` marks containerized nodes.
- `spec["network_edges"]` (built at build_spec.py ~223–256): each edge is one of:
  - `{"kind":"sg_ingress", "from","to","from_sg","to_sg","port","protocol":"tcp","description"}`
  - `{"kind":"alb", "from","to","alb_sg","target_sg","listener_port","redirect_http","target_port","description"}`
  - `{"kind":"none", "from","to","reason","description"}`  ← async/IAM, no SG rule.
  **This is the authoritative connection graph. C's missing ingress IS an `alb` edge here —
  the data was present; the LLM just didn't author the rule.**
- `spec["generated_env"]` (built ~261–268): `[{"key_name","hint"}]` — **no value**; the LLM
  synthesizes the value from the hint (this is why B happened).
- `spec["secrets"]`: `[{"key_name","secretsmanager_arn","classification"}]` — user secrets
  written to Secrets Manager, referenced via `{{resolve:secretsmanager:...}}`.
- `spec["account_type"]` ∈ {"paid","free_tier"}; `spec["networking"]["task_placement"]` ∈
  {"public","private"} (free-tier = public, no NAT).

---

## PHASE A — Correctness / Hardening (do first)

### A0 — Fix the frontend buildspec CWD bug (Defect D) — smallest, do first
- **Why:** `post_build` runs at the repo root, not `./frontend`, so `dist`/`build` aren't
  found and `aws s3 sync` fails.
- **File/symbol:** `backend/app/provisioning/codebuild_spec.py` → `def _frontend_buildspec(build_path)`.
- **Approach:** ensure the output-dir detection and `s3 sync` run **inside `build_path`**.
  Simplest: prefix the `post_build` commands with `cd {build_path}` (mirroring the `build`
  phase), OR compute an absolute `OUT_DIR` (e.g. `OUT_DIR="{build_path}/dist"; [ -d "$OUT_DIR" ] || OUT_DIR="{build_path}/build"`).
  Keep the existing `dist`→`build` fallback (Vite vs CRA) — the comment there is correct.
- **Type:** backend-only (deterministic codegen). No agent redeploy.
- **Verify:** regenerate a template; the frontend `AWS::CodeBuild::Project`'s BuildSpec
  `post_build` must `cd` into the frontend path before `aws s3 sync`. (A live re-deploy to
  fully confirm is user-run + billable — get sign-off first.)
- **Guardrail:** this is generated by `codebuild_spec.py` and spliced in by
  `iac.enforce_codebuild_projects` — the LLM does NOT author it. Fix it here, not in the prompt.

### A1 — Generate security-group rules deterministically from `network_edges` (Defect C) — highest leverage
- **Why:** SG wiring is 100% spec-derivable and the LLM's weakest spot (it dropped the
  ALB→backend ingress). Emit every rule from the declared edges so nothing can be missed.
- **Files/symbols:**
  - Read: `build_spec.py` `network_edges` construction (§2) — the edge shapes.
  - Read: a **current generated template** (regenerate on the test project) to see how SG
    resources + rules are authored today: `AWS::EC2::SecurityGroup` (with inline
    `SecurityGroupIngress`/`SecurityGroupEgress`) **and** standalone
    `AWS::EC2::SecurityGroupIngress` resources both appear. Note the logical-id conventions
    (`AlbSecurityGroup`, `BackendSecurityGroup`, `DbSecurityGroup`, `CacheSecurityGroup`,
    `WorkerSecurityGroup`) and how `security_group` names in the spec map to them.
  - Add: a new deterministic pass in `backend/app/provisioning/iac.py`, e.g.
    `enforce_security_group_rules(template, spec)`, and call it in `generate()` alongside the
    other `enforce_*` passes (see the `enforce_*` block inside `def generate` — there are
    currently 6: `enforce_free_tier_limits`, `enforce_elasticache_deletion_policy`,
    `enforce_rds_deletion_policy`, `enforce_log_group_naming`, `enforce_sg_description_charset`,
    `enforce_codebuild_projects`).
- **Approach (choose based on what you find in the current template):**
  - **Preferred / robust:** own the SG *rules* deterministically. For each edge:
    - `kind: "sg_ingress"` → ensure a `SecurityGroupIngress` on `to_sg` from `from_sg` on `port/protocol`.
    - `kind: "alb"` → ensure (a) ALB SG ingress from internet on `listener_port`, (b) ALB SG
      **egress** to `target_sg` on `target_port`, **and (c) `target_sg` INGRESS from the ALB SG
      on `target_port`** ← the rule that was missing.
    - `kind: "none"` → no SG rule.
    Add any missing rule as a standalone `AWS::EC2::SecurityGroupIngress`/`Egress` resource
    (idempotent: don't duplicate a rule the LLM already emitted — match on group/source/port).
  - Because this reuses the `enforce_*` philosophy already applied to CodeBuild
    (`enforce_codebuild_projects` splices deterministic resources in), it's the same pattern.
- **Optionally** tell the agent it no longer needs to author SG *rules* (they're enforced) —
  that's a **prompt change → agent redeploy** (batch with Phase B agent changes). Not required
  for correctness; the enforce pass wins regardless.
- **Type:** backend-only for the enforce pass (immediate). Prompt note is agent-redeploy.
- **Verify:** regenerate; assert for every `alb` edge there is a
  `SecurityGroupIngress` with `GroupId → target_sg's SG`, `SourceSecurityGroupId → alb_sg's SG`,
  `FromPort==ToPort==target_port`. cfn-lint 0 errors. (This exact assertion is also A3.)
- **Guardrail:** SG **logical IDs** are LLM-chosen; map spec `security_group` names → template
  logical IDs by reading the template, don't hardcode. Keep the pass idempotent.

### A2 — Correct framework env values (Defect B) — never emit an ARN as a URL
- **Why:** `CELERY_BROKER_URL = !Sub ${TaskQueue.Arn}` is never a valid broker URL. More
  broadly, `generated_env` ships only `{key_name, hint}` and the LLM invents values it can get
  semantically wrong; nothing validates env-value semantics.
- **Broker question — RESOLVED for test-app (verified 2026-07-09):** the app expects **SQS**.
  `test-app/backend/requirements.txt` pins **`celery[sqs]`** (installs kombu's SQS transport),
  and `taskboard/settings/base.py` sets `CELERY_BROKER_URL = os.environ["CELERY_BROKER_URL"]`
  while `REDIS_URL` is used **only** for the Django cache (`django_redis`), NOT as the broker.
  So Clyro provisioned SQS correctly and the app wants SQS — the ONLY bug is the **value**: it
  injected the ARN instead of the `sqs://` transport URL. **Fix: emit `sqs://` (kombu's IAM-auth
  SQS form), never the ARN.** Note kombu/Celery with `sqs://` also needs the region + queue
  reachable via `broker_transport_options` — verify the app resolves the queue from `sqs://`
  alone (AWS region via env) or whether Clyro must also pass a predefined-queue URL; test with
  a live worker before calling this done.
- **Generalization (other apps):** don't assume — the broker type is app-specific. RepoRecon
  (Step 1) *should* detect broker/transport from the app's deps + Celery config; if it doesn't
  today, capturing it there is the real upstream fix so `build_spec` can wire the right URL.
  The invariant that always holds: **a `*_URL`/`*BROKER*` value must never be a raw ARN.**
- **Files/symbols:**
  - `build_spec.py` `generated_env` construction (~261–268) — where to attach a correct value
    template, OR
  - `iac.py` — a new `enforce_env_values(template, spec)` pass (added to `generate()`'s
    `enforce_*` block) that rewrites known keys to correct values based on the spec's resources.
- **Approach:** for each well-known generated key, emit a **valid** value derived from the
  provisioned resource, matching the app's expected scheme:
  - `DATABASE_URL` → `postgres://...` from the RDS endpoint/secret (already worked — keep).
  - `REDIS_URL` → `redis://<cache-endpoint>:6379` (already worked — keep).
  - `CELERY_BROKER_URL` → **the app's actual broker**: if Redis-broker, set it to the same
    Redis URL; if genuinely SQS (app configured with `kombu[sqs]`), the valid form is `sqs://`
    (Celery derives region/queue from `broker_transport_options`/env), **never the ARN**.
- **Add a validation rule** (feeds A3): flag any env value that is a raw ARN
  (`^arn:aws:`) used where a connection URL is expected (`*_URL`, `*_BROKER*`) → blocker.
- **Type:** backend-only. No agent redeploy (deterministic value injection/enforcement).
- **Verify:** regenerate; assert no `*_URL`/`*BROKER*` env value starts with `arn:aws:`; the
  broker value matches the app's expected scheme. cfn-lint 0 errors.
- **Guardrail:** don't assume the framework — detect it. Document the assumption you make.

### A3 — Pre-deploy spec-conformance gate (Layer 2) — catches anything A1/A2 miss, in seconds
- **Why:** an ECS-stabilization failure costs ~3 hours before CFN times out. A static check
  that the template **realizes the spec** fails in milliseconds, before provisioning.
- **File/symbol:** `iac.py` — a new `check_spec_conformance(template, spec) -> list[finding]`,
  modeled on the existing `check_ecs_network_reachability(template, spec)` and
  `check_secret_interpolation(template, spec)` (findings are `{severity, message}`; `blocker`
  severity gates `IAC_READY` via `validate()`). Call it where those are called in `generate()`
  (the `findings = security_scan(...) + check_ecs_network_reachability(...) + check_secret_interpolation(...)`
  line) and in `validate()`.
- **Checks to implement (all derivable from the spec):**
  1. Every `network_edge` of kind `alb`/`sg_ingress` has a matching SG rule in the template
     (this is the A1 assertion — same predicate).
  2. No `*_URL`/`*BROKER*` env value is a raw ARN (the A2 assertion).
  3. Every ECS service references an ECR image that the build pipeline actually produces
     (`buildable_node_ids(spec)` from `codebuild_spec.py` ↔ the task-def `Image`).
  4. Frontend `static` node's buildspec targets the S3 bucket the template creates.
- **Type:** backend-only. No agent redeploy.
- **Verify:** temporarily break one rule (e.g. delete an SG ingress) and confirm the gate
  returns a `blocker` and `validate()` does NOT reach `IAC_READY`.
- **Guardrail:** reuse the existing finding schema + `blocker` semantics so it plugs into
  `validate()`/`_security_fix_loop` unchanged. Read those before wiring.

### A4 — Break the cold-start build→ECS deadlock (Defect A)
- **Why:** first deploy can never reach `CREATE_COMPLETE` (see §1-A).
- **Files/symbols:** `backend/app/provisioning/deploy.py` (`provision_with_feedback` ~519,
  `_poll_to_terminal` ~501, `poll` ~245 — note `poll` flips to `BUILDING` when
  `cfn_events.is_live`), `backend/app/provisioning/build.py` (`build_with_feedback` ~213,
  `start_build` ~115), and how ECS `DesiredCount` is authored (template).
- **Approach — pick ONE (document the choice):**
  1. **DesiredCount 0 → build → scale up (recommended, deterministic):** author ECS services
     at `DesiredCount: 0` (an `enforce_*` pass can force this at generate time) so CFN
     completes immediately; then after `build_with_feedback` pushes the image, scale the
     services to their target count (add an ECS `update_service --desired-count` step to the
     build/provision flow — note `build_with_feedback` currently does NOT touch ECS).
  2. **Build during provisioning:** trigger `start_build` as soon as the ECR repos +
     CodeBuild projects exist (mid-CFN), in parallel with the CFN wait, so the image lands and
     ECS stabilizes and CFN completes on its own. (This is what the manual workaround did.)
  3. **In-stack CodeBuild custom resource** the ECS service `DependsOn` — biggest change.
- **Also fix:** `run_provision_task` abandons after its poll cap (~20 min) leaving the stack
  orphaned — ensure the chosen flow drives to a real terminal state (or the runtime-aware
  detector in A5 handles "stuck").
- **Type:** backend-only (options 1–2). Option 3 touches the template/agent.
- **Verify:** a full user-run deploy reaches `CREATE_COMPLETE` and the ECS services run their
  target task count with the real image. **Billable + user-run — get sign-off.**
- **Guardrail:** if you go with option 1, the target desired count must come from the spec
  (`sizing.tasks`), not hardcoded.

### A5 — Make self-correction runtime-aware (Layer 4) — the long-tail backstop
- **Why:** the loop reads CFN events only, so it's blind to container crashes, ALB health, and
  build failures (all of B/C/D). It also waits ~3h on a stuck stabilization.
- **Files/symbols:** `deploy.py` `_root_failure` (~455), `provision_with_feedback` (~519),
  `_poll_to_terminal` (~501), `_correction_instruction` (~511).
- **Approach:**
  1. **Stuck-stabilization detector:** if an ECS service is cycling (running≠desired with
     `CannotPullContainerError` / repeated task stops / ALB `unhealthy`) for N minutes, treat
     as a failure now — don't wait for CFN's ~3h timeout.
  2. **Richer root cause:** extend `_root_failure` to also read (via the assumed-role clients)
     ECS `describe_tasks` stopped reasons + the container's CloudWatch logs, ALB
     `describe_target_health` reasons, and CodeBuild failure logs — feed the *actual* error
     into `_correction_instruction` so `iac.refine` can act on it (e.g. surface the kombu idna
     error, or the `Target.Timeout`).
  3. Note build failures currently short-circuit in `build_with_feedback` (`BUILD_FAILED`, no
     refine) — decide whether build-log-driven correction is in scope.
- **Type:** backend-only.
- **Verify:** simulate/observe a runtime failure and confirm the loop surfaces the real cause
  (not a generic "service did not stabilize") within minutes.
- **Guardrail:** keep it bounded (still one correction round); don't loop forever on runtime
  errors.

---

## PHASE B — Latency (execute after Phase A; several need an agent redeploy — batch them)

> Evidence (from AgentCore traces, free-tier Kimi generate, 223.6 s total): ~19% initial
> draft, **~52% internal self-correction loop** (cfn-lint ×2, cfn-guard ×1, ~12 model turns),
> ~26% final template streaming. Backend deterministic work is ~3 s total (cfn-lint subprocess
> ~0.9 s ×2–3; all `enforce_*` passes ~1 ms each). So the target is the model call + its loop,
> not backend overhead. **Do not switch the generate model to Haiku** (fast but no-ops on
> edits — quality loss). Sonnet≈Kimi on speed; keep a strong model.

### B1 — Warm the runtime (zero quality risk)
- **Why:** cold-start is pure overhead (17 s cold vs 3 s warm on canvas).
- **Approach:** fire a cheap warm-up `invoke_agent_runtime` (see
  `backend/app/agentcore.py::invoke_runtime`, `require_runtime_arn`) when the user reaches
  Step 4 / finalizes the canvas, so the runtime is hot before Generate. Or use AgentCore
  provisioned concurrency if available. A tiny no-op payload the agent can short-circuit.
- **Type:** backend (trigger) + possibly a tiny agent branch to answer a warm-up ping cheaply
  (if so → agent redeploy; otherwise backend-only).
- **Verify:** measure generate latency with vs without a preceding warm-up ping.

### B2 — Stream output + phase progress to the UI (perceived latency)
- **Why:** a 220 s wait should look like live progress, not a spinner. Same wall-clock.
- **Files:** `agentcore.py::parse_runtime_response` already handles the SSE `data:` stream and
  drops `{"__heartbeat__": true}` — the agent already streams. Surface the streamed template
  into the Step-4 Monaco editor, and derive a phase indicator from tool-call events
  (`Tool #N: cfn___validate_cloudformation_template` / `..._compliance`).
- **Type:** backend (stream passthrough) + frontend (render). Likely no agent redeploy.
- **Verify:** template renders progressively; phase labels advance (drafting → validating →
  fixing → compliance → finalizing).

### B3 — Speculative prefetch (hide the latency)
- **Why:** start `iac.generate` before the user clicks Generate.
- **Approach:** on canvas finalize (`CanvasVersion.Status.FINALIZED` / Step 3→4), auto-enqueue
  `tasks.run_iac_generate_task.delay(job_id, project_id)` (same task the button uses). Debounce
  (prefetch once). On spec change, hash `_spec_for(...)`; if changed, discard + regenerate.
- **Env-var ordering caveat:** `_spec_for` includes `_env_vars_for_spec`; correct secret
  wiring needs the `SECRET_KEY` ARN, which exists only after the env-vars sub-step. Two clean
  options: **(a)** collect user secrets earlier (they're discovered by the Step-1 scan, so
  they're canvas-independent) so the spec is complete at prefetch time — the user's preferred
  option; **(b)** prefetch the structure and inject the secret ARN deterministically once known
  (an `enforce_*`-style patch, since only the ARN's random suffix is unknown). Generated env
  (`DATABASE_URL`, etc.) is derived at generate time regardless.
- **Type:** backend + frontend flow. No agent redeploy.
- **Verify:** finalize canvas → observe a generate job start automatically; arriving at Step 4
  shows an in-progress/ready template; changing the canvas invalidates + regenerates.

### B4 — Add UNIVERSAL cfn-lint pitfalls to the agent prompt (agent redeploy)
- **Why:** the self-correction loop keeps re-fixing the *same* errors. **Only bake in
  model-agnostic, CFN-universal ones** (per user: app-specific errors like "DBUsername not
  defined" must NOT be hardcoded — they overfit and don't generalize; that long tail is what
  the loop is for).
- **Approach:** audit recent traces in the IaC runtime log group
  (`/aws/bedrock-agentcore/runtimes/CryloIac_IacArchitect-6oodT43I5f-DEFAULT`, `ap-south-1`) for
  recurring "validation error" lines; add only the **universal** ones to the pitfalls section
  of the agent system prompt (`backend/agents/CryloIac/app/IacArchitect/main.py` — the prompt
  already lists pitfalls, e.g. W3011 dual DeletionPolicy/UpdateReplacePolicy). Candidate
  universal rule confirmed in traces: **"IAM role ARNs use `!GetAtt Role.Arn`, never `!Ref`."**
- **Type:** **agent redeploy.**
- **Verify:** after redeploy, regenerate; the previously-recurring universal error no longer
  appears in the first draft (fewer fix rounds).

### B5 — Move MECHANICAL fixes into `enforce_*` passes (with the safety rule)
- **Why:** deterministic fixes (~1 ms) beat LLM re-emission rounds. There are already 6
  `enforce_*` passes; the mechanical universe is bounded (~5–10 total).
- **THE SAFETY RULE (critical — the user's concern):** only move a fix to a deterministic pass
  if it is **either (i) a total function over the template (no edge case)** — e.g. "every
  stateful resource gets both DeletionPolicy + UpdateReplacePolicy" — **or (ii) cfn-lint-caught
  if the pass misses it** (because `lint_template` runs *after* the `enforce_*` block in
  `generate()` and `_lint_fix_loop` will still catch lint-visible misses). **Never** tell the
  LLM to skip a **semantic, non-lint-visible** concern that a deterministic pass might handle
  incompletely — that's the one quadrant where a missed edge case slips through silently.
- **Approach:** add `enforce_*` passes for clearly-mechanical items (e.g. `HealthCheckPath`
  normalization `/health/`→`/health` seen in every generation; `!Ref`→`!GetAtt` for role ARNs
  *only if* provably total). Add to the `enforce_*` block in `generate()`. Optionally tell the
  agent not to spend rounds on these (prompt → **agent redeploy**, batch with B4/B7).
- **Type:** backend for the passes; prompt note is agent redeploy.
- **Verify:** the targeted error is fixed deterministically post-generate; cfn-lint 0 errors;
  fewer internal fix rounds in traces.

### B6 — Make cfn-guard advisory + move it server-side
- **Why:** the trace shows the agent spending turns reasoning about cfn-guard findings it then
  dismisses as "generic rules that conflict with the spec." **But the backend does NOT run
  cfn-guard today** (only `security_scan` regex + reachability + secret-interp + cfn-lint), so
  simply skipping it in the agent would LOSE that coverage.
- **PREREQUISITE (verified):** cfn-guard is **not installed in the `clyro_backend` container**
  (`import cfn_guard` fails; no `cfn-guard` binary). It currently lives only in the
  `crylo-mcp-cfn` MCP Lambda. So "run cfn-guard server-side" requires **either** adding
  cfn-guard to the backend image (Dockerfile/requirements + a `lint_template`-style wrapper),
  **or** having the backend call the `crylo-mcp-cfn` gateway. Do this prerequisite first, or
  B6 has nowhere to run.
- **Approach:** (1) run cfn-guard **server-side** after the agent returns (as an advisory report
  surfaced to the user, like cfn-lint), and (2) tell the agent to run compliance **once** and
  NOT loop/re-emit on generic findings. The authoritative blocker gate stays
  `security_scan` + the new `check_spec_conformance` (A3).
- **Type:** backend (server-side cfn-guard) + agent prompt (don't loop) → **agent redeploy**.
- **Verify:** compliance findings still surface to the user; the agent no longer burns turns
  agonizing over them (shorter loop in traces).

### B7 — Diff-based self-correction in GENERATE mode (biggest structural loop win; agent redeploy)
- **Why:** in generate mode the model re-emits the FULL `===TEMPLATE===` every fix round
  (~10 K tokens each). Refine already has an efficient `@@SEARCH@@/@@REPLACE@@` diff path.
- **Files/symbols:** `main.py` — `_REFINE_RULES`, `_OUTPUT_FORMAT` (the `===EDITS===`
  `@@SEARCH@@/@@REPLACE@@/@@END@@` block), `_parse_edits`, `_parse_output`. Reuse this edit
  path for the generate loop's internal fixes: draft once, then emit **edits** to fix cfn-lint
  errors instead of re-emitting the whole template.
- **Type:** **agent redeploy** (changes the generate output/flow). Verify `_parse_output`
  handles the mixed draft-then-edit path (edits applied deterministically via `_parse_edits`).
- **Verify:** still validates to 0 cfn-lint errors; internal fix rounds emit small diffs (trace
  shows far fewer output tokens per round); total generate time drops.

---

## 3. Sequencing & dependencies
1. **A0** (buildspec) — trivial, independent, do first.
2. **A1** (SG from edges) and **A2** (env values) — independent backend passes; do together.
3. **A3** (conformance gate) — depends on A1/A2 predicates; encode the same assertions.
4. **A4** (deadlock) — independent; needs a user-run deploy to fully verify.
5. **A5** (runtime-aware loop) — independent; complements A4.
6. **Phase B** after A. Batch all **agent-redeploy** items (B4, B6, B7, optional A1/B5 prompt
   notes) into **one** CryloIac redeploy to avoid repeated deploys. B1–B3 are backend/frontend.

## 4. Global guardrails
- Regenerate + `iac.lint_template` (0 errors) after every template-affecting change.
- Restart `backend celery_worker` after backend edits; **redeploy CryloIac** after agent edits
  (nothing agent-side takes effect otherwise).
- Keep every `enforce_*`/`check_*` addition **idempotent** and **spec-driven** (no hardcoded
  logical IDs, ports, or counts — read them from the template/spec).
- Live deploys are **billable and user-run** — never invoke `deploy.start`; hand the user the
  `!` one-liner in §0.2 and monitor read-only.
- Don't commit test files/throwaway scripts. One-line commit messages; small single-concern
  commits.
- When unsure, **read the function and a freshly-generated template** before editing — do not
  infer structure.
```
