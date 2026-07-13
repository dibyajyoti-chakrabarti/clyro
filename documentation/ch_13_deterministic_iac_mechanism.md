# Fix Step 4: Deterministic IaC Generation + Provisioning Robustness + Latency

## Context

Live E2E test (Playwright, real AWS) + code exploration confirmed the user's four complaints and their root causes:

1. **High latency everywhere** — AgentCore cold start ~17s (warmup `IAC_WARMUP_ENABLED` defaults False), each Bedrock round ~25s/~41K tokens, lint/security fix loops add up to 4 extra LLM rounds, frontend polls `deploy/status/` every ~2s receiving the full 39KB log each time.
2. **IaC generation too slow** — Sonnet authors a ~600-line CFN template token-by-token with extended thinking + agent-side tool loops + backend fix loops. Minutes per generate.
3. **IaC full of bugs** — the LLM transcribes an *already fully deterministic* build spec (`build_spec.py` resolves sizing, ports, subnets, naming, exact CFN resource list per node — Step4.md §4.3) into YAML and injects variance: unquoted `Description` colon (YAML syntax error), missing ECR repo, wrong subnets, non-deterministic logical IDs. ~2400 lines of `iac.py` (15 enforcers, 5 checkers, 2 bounded fix loops) exist purely to patch that variance, and still leak (observed live: fix-loop message overwrote the user-turn message; the lint error survived two "fixed it" turns).
4. **Provisioning loops / false success** — `cfn_events.status_kind()` maps any `*_COMPLETE` (incl. `DELETE_COMPLETE` during rollback) to `done` → "✅ X ready" while the stack is being torn down; `ROLLBACK_IN_PROGRESS` isn't terminal so `deploy.poll()` reports generic `in_progress`; `provision_with_feedback` runs an LLM refine round on failure and retries (~30 min per failed cycle); free-tier RDS `BackupRetentionPeriod: 7` mismatch had no preflight/auto-fix (account self-reported "paid" in Step 2 but is RDS-free-tier-limited).

Decision (user-approved): **replace LLM template generation with a deterministic Python generator**; keep the LLM only for the "Ask Clyro" refine chat. Matches the project's own design principle (“deterministic where possible, model reasoning only on ambiguity”, Crylo_Agentic_Network_Design.md §1.5). Scope also includes provisioning robustness and a latency pass. Full E2E re-verify explicitly deferred.

## Part A — Deterministic CFN generator

**New module: `backend/app/provisioning/cfn_generator.py`** (pure Python, no Django — same style as `build_spec.py` / `codebuild_spec.py`, which is the in-repo precedent for deterministic CFN fragments).

- Input: the `build_spec()` dict. Output: complete CloudFormation template as a Python dict, serialized with PyYAML (already in requirements). Quoting/`!Sub`/`!Ref` handled via a small custom representer for CFN intrinsics (or emit long-form `Fn::Sub`/`Ref` maps — simpler, lint-clean, no custom tags needed).
- Emits per Step4.md §4.3 + the target state already encoded in the enforcers/authoring rules:
  - Networking: VPC, subnets (multi-AZ from spec), IGW, NAT (skip when `nat_gateway: false`), route tables, SGs from the connection graph (`enforce_security_group_rules` logic).
  - Per node type: exactly the `_CFN_RESOURCES` sets from `build_spec.py:42` (ECS Fargate service+worker, ALB stack, RDS + Secrets Manager secret, ElastiCache, SQS, S3+CloudFront+OAC).
  - **Fixed logical IDs** (`BackendService`, `DbInstance`, `FrontendBucket`, …) — removes the LLM-chosen-name fragility called out in `codebuild_spec.py`'s docstring and `deploy.py:381` suffix-matching hack.
  - CodeBuild pipeline: call `codebuild_spec.generate_codebuild_resources()` directly with the now-known logical IDs (no more splice-by-regex via `enforce_codebuild_projects`).
  - Env/secrets wiring per `enforce_required_env`/`enforce_env_values`; observability (alarms, Container Insights, log groups + awslogs driver) per design doc §8; deletion policies, DBName, health-check path, desired counts, free-tier clamps — all folded in from the corresponding `enforce_*` functions (they are the spec of correct output; port their logic, then they become dead code on the generate path).
  - `BackupRetentionPeriod`: 7 only when `environment == production` and `account_type == paid`; else 1.
- **`iac.generate()` rewired**: call the generator instead of `_invoke_iac`; keep `lint_template` + `_collect_findings` as a safety net (must be clean by construction); drop `_apply_enforcers`, `_lint_fix_loop`, `_security_fix_loop`, `enforce_codebuild_projects` from the generate path. No model param, no AgentJob streaming phases needed — keep the existing AgentJob flow so the frontend contract is unchanged, the job just completes in <1s.
- **Refine path kept LLM-backed but fixed** (`iac.refine`):
  - Keep `_apply_edits` + fix loops (LLM edits can still break things).
  - **Message bug fix**: never let `fix_msg` *overwrite* the user-turn message (`iac.py:2311,2319`) — append (e.g. "…Also auto-fixed 2 lint errors.") so the chat reply always describes the user's actual request.
  - Offer a "Regenerate" that calls the deterministic generator (discarding manual edits, with confirm).
- **Tests** (new `backend/app/provisioning/tests/` or existing tests layout): for ≥4 representative specs (staging+paid ECS full stack, free-tier, service-on-ec2, domain vs no-domain) assert generator output has 0 cfn-lint errors and 0 blocker findings; snapshot test the template dict.

## Part B — Provisioning robustness

1. **`cfn_events.py` status mapping** (`status_kind`, `translate_event`):
   - Distinguish operation: during a failed create, resource-level `DELETE_IN_PROGRESS`/`DELETE_COMPLETE` and `*ROLLBACK*` statuses → new kind `rolled_back` with messages "↩️ Rolling back X…" / "🗑️ X removed", never "✅ ready".
   - Unit tests for the full status matrix.
2. **Top-level rollback state**: add `ROLLING_BACK` to `Deployment.Status` (`core/models.py:296`) + migration. In `deploy.poll()`: stack `ROLLBACK_IN_PROGRESS`/`DELETE_IN_PROGRESS` (post-failure) → `ROLLING_BACK`; only `CREATE_COMPLETE`/`UPDATE_COMPLETE` enter the BUILDING branch (drop `UPDATE_ROLLBACK_COMPLETE` from that path; it stays "live" only for the re-provision block in `start`).
3. **Deterministic failure auto-fix table** replacing the LLM refine round in `provision_with_feedback` (`deploy.py:1069`): a dict of (root-cause regex → pure template transform), seeded with the free-tier RDS backup-retention error → clamp via existing `_BACKUP_RETENTION_RE`; retry once after stack delete. Unknown failures surface immediately with the translated reason — no LLM, no loop.
4. **Frontend** (`StepFour.jsx` / provisioning feed): render `rolled_back` kind + `ROLLING_BACK` status distinctly ("Provisioning failed — AWS is rolling back…", red/amber), so the interim state is honest.

## Part C — Latency pass

1. `IAC_WARMUP_ENABLED` default True (`config/settings.py:150`) — still useful for refine; also fire warmup when Step 4 loads (`iac_current` view).
2. **Incremental deploy status**: `GET /deploy/status/?since=<sequence>` returns only newer log entries (+status/outputs/error); frontend appends and passes its high-water mark. Kills the growing 39KB-per-2s payloads.
3. Frontend poll dedupe: StepFour currently double-polls (~1s apart, two intervals observed live) — consolidate to one 3s poller.
4. **Monaco console spam** (`CfnEditor.jsx`): monaco-yaml worker missing `findLinks`/`getFoldingRanges`/`findDocumentSymbols` handlers → 100+ console errors per session. Fix worker wiring per monaco-yaml docs or disable links/folding/documentSymbols in editor options.
5. Frontend model picker: generate step no longer takes a model — remove the "choose a model to generate" gate in `StepFour.jsx`/`IacEditor.jsx` (generate button enabled directly); keep the model select on the Ask Clyro refine panel.

## Out of scope (explicitly)

- Full Playwright E2E re-verify against real AWS (user deferred).
- CryloIac agent redeploy (untouched; still serves refine).
- The broader AgentCore/Strands multi-agent build-out from the design doc.

## Verification

- `pytest backend/app/provisioning` — generator specs lint-clean + blocker-free; cfn_events status-matrix tests; auto-fix table test.
- `docker compose up`, walk Step 4 in the UI: generate returns a valid template in ~1s, Validate → Valid, model picker only in chat panel, no monaco console errors.
- Simulated rollback check: unit-test `poll()` mapping with recorded event fixtures from the failed live run (ROLLBACK_IN_PROGRESS → `ROLLING_BACK`, resource deletes → `rolled_back` kind).
- Findings log from the E2E session lives at scratchpad `ecs-e2e-findings.md` — each of findings #1–#8 maps to a fix above; walk the list post-implementation.
