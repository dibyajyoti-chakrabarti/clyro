# Chapter 20 — Step 1 Revamp: The Offline Scan Contract

**Status: delivered.** Written 2026-07-30 as an implementation plan, and shipped in
full. Verified against the repo 2026-09-06: `backend/app/scanner/` now holds
`clyro_md.py`, `classify.py`, `compliance.py` and `runner.py`;
`deterministic_detector.py` and `backend/agents/CryloCanvas/app/RepoRecon/` are gone;
`REPORECON_RUNTIME_ARN` is gone from `config/settings.py`, which leaves only
`REASONING_RUNTIME_ARN` and `IAC_RUNTIME_ARN`; and `backend/skills/clyro-scan/`
exists and is served by `GET /api/skill/clyro-scan`.

Read this chapter as the rationale for the change, not as work outstanding. The
future tense throughout, and the "(new)" and "(rewritten)" markers in sections 4
and 5, all describe code that now exists. The present-tense descriptions of the
*old* Step 1 in section 2, the RepoRecon fallback and its 17 to 41 second cold
start, the warmup task that existed to hide it, and the settings-only env-var
detection, are descriptions of what was replaced. **Chapter 8 is the authority on
how Step 1 works now.**

One correction to the text below: the security boundary in section 4 says the
contract flows toward "the Step 3/4 LLM prompts". Under the current seven-step
wizard those consumers are the canvas at Step 4 and `IacArchitect` at Step 5. The
boundary itself is unchanged and still enforced.

Step 1 stops scanning repos. Instead, the user runs an offline coding agent
(Claude Code, Cursor, Aider) against their own checkout with the `/clyro-scan`
skill; the agent detects everything, fixes what is not cloud compliant, commits,
pushes, and leaves a `CLYRO.md` contract at the repo root. Clyro reads that file
on connect and ingests it.

Two companion documents are the specification this plan implements:

- [`backend/skills/clyro-scan/SKILL.md`](../backend/skills/clyro-scan/SKILL.md) — the skill the
  offline agent runs. Detection rules, compliance checks, and the `--fix`
  mutate/commit/push sequence. This file is the source of truth and is served
  verbatim to users; edit it there, not in a copy.
- [`backend/skills/clyro-scan/reference/CLYRO.example.md`](../backend/skills/clyro-scan/reference/CLYRO.example.md)
  — the annotated example contract. The machine-parseable YAML blocks in it are
  the ingestion schema.

---

## 1. Why

Today's Step 1 (see [Chapter 8](ch_8_wizard_step_1_connect.md)) runs
`deterministic_detector.py` first and falls back to the **RepoRecon** LLM agent
on AgentCore when detection confidence is low. Three problems:

1. **Cold start.** RepoRecon costs 17–41s, which is why `wizard_state` fires a
   warmup task on Step 1 entry just to hide it (`app/views.py:233`).
2. **Detection is shallow where it matters.** `deterministic_detector.py` only
   reads settings files, so a `STRIPE_SECRET_KEY` used in `payments/views.py` is
   invisible. The user discovers it as a 500 in production. It also leaves
   `project_name` and `wsgi_path` null.
3. **Compliance findings are diagnosis without treatment.** `compliance.py`
   produces `fix_hint`s and `build_agent_prompt()` composes a paste-able prompt,
   but the user still has to go run an agent, fix, commit, push, and rescan.

An offline agent with a real checkout beats a cloud scanner on all three: no cold
start, full-tree reasoning, and it can actually apply the fixes.

## 2. Decisions

| Decision | Choice |
|---|---|
| Role of CLYRO.md | **Required.** The live scan path is deleted, not kept as a fallback. |
| No CLYRO.md on connect | Step 1 blocks with install instructions and a "check now" button. Retryable — the project stays `repo_connected`, not `failed`. |
| Compliance findings in the file | **Recomputed server-side, always.** Ingest resources and env vars from the contract; re-run `compliance.py` against the live tree and gate Continue on the recomputed set. |
| `--fix` scope | Mutates, commits one logical fix per commit, and pushes to the current branch after confirmation. Guarded by a preflight. |
| Skill distribution | Source lives at `backend/skills/clyro-scan/SKILL.md`, served raw from a public Clyro endpoint. `curl` one-liner for Claude Code, copy-prompt button for everything else. |

## 3. What gets deleted

| Thing | Location | Why |
|---|---|---|
| RepoRecon agent | `backend/agents/CryloCanvas/app/RepoRecon/` | the offline agent replaces it |
| `_run_scan_agent` | `app/scanner/runner.py:7-31` | no AgentCore call remains in Step 1 |
| `deterministic_detector.py` | `app/scanner/` | superseded — but extract its classification tables first, see §4 |
| `REPORECON_RUNTIME_ARN` | `config/settings.py:181` | dead setting |
| Step 1 warmup | `app/views.py:233` | no cold start left to hide |
| Scan progress theatre | `step1/ScanProgress.jsx` (7 messages on a 10s interval) | ingest is ~2s |

`ScanResult.draft_canvas_yaml` is written by the scan and **read by nothing** —
verified by grep across the backend and frontend. The contract does not carry a
canvas seed, and the column stays only to avoid a pointless migration.

## 4. Backend

### `app/scanner/clyro_md.py` (new)

- `fetch(token, repo, branch)` — `github_utils.get_file_content('CLYRO.md')`,
  `None` on 404.
- `parse(text)` — collect **every** ` ```yaml ` fence, `yaml.safe_load` each, and
  merge recognized top-level keys (`repository`, `services`, `infrastructure`,
  `existing_iac`, `env_vars`, `compliance_findings`, `status`, `block_reason`,
  `block_message`, metadata). Key-driven, not heading-position-driven, so a user
  reordering sections or renaming a heading does not break ingestion. HTML
  comments supply the schema version.
- `validate(parsed) -> list[str]` — hand-rolled, no new dependency. Required
  keys, enum values (`classification` ∈ {generated, optional, user_secret},
  `severity` ∈ {blocker, warning, info}, `hint` ∈ {agent_generatable,
  third_party}, `engine == postgres`, `framework == django`), types, and
  `schema_version == 1`. Every error names the offending key so the UI can print
  something actionable — this is the surface non-Claude agents will hit, so error
  quality is a feature, not polish.
- `to_detection(parsed)` — emits the exact RepoRecon output shape
  `{status, block_reason, block_message, detected_resources, env_vars}`. Keeping
  that shape means `canvas_core/canvas_builder.py`, `provisioning/iac.py:319`,
  and `provisioning/build_spec.py` need no changes at all.

### `app/scanner/classify.py` (new, extracted)

Lift `_GENERATED_ENV_KEYS`, `_OPTIONAL_ENV_KEYS`, and `_classify_env_key` out of
the dying detector. The server **overrides** the contract's classification for
keys it owns: a contract claiming `DATABASE_URL: user_secret` would make Clyro
prompt the user for a connection string it must generate itself. Contract wins
on unknown keys; Clyro wins on its own.

### `app/scanner/runner.py` (rewritten)

`run_scan_for_project(project)` becomes:

1. Fetch `CLYRO.md`. Absent ⇒ `ScanResult.BLOCKED`,
   `block_reason='clyro_md_missing'`, and **leave the project at
   `repo_connected`**. Today's block path sets `Project.Status.FAILED`
   (`runner.py:50`), which would strand a user who simply has not run the skill
   yet.
2. Parse and validate. Invalid ⇒ `BLOCKED`, `clyro_md_invalid`, with the error
   list persisted for the UI.
3. Contract's own `status: hard_block` / `soft_block` ⇒ surface its
   `block_message`, same as today.
4. Valid ⇒ ingest `detected_resources` and `env_vars`, re-classify known keys,
   persist `hint` and `acquire_url` onto `EnvVarKey`.
5. **Always** re-run `compliance.run_compliance_checks` against the live tree.
   Existing code, unchanged, no LLM, ~2s of GitHub calls. This is what stops a
   hand-edited all-green contract from walking a blocker into the build.
6. Diff the recomputed findings against the contract's ⇒ `contract_drift`. With
   `--fix` pushing real fixes before Clyro ever looks, agreement is the normal
   case, so disagreement is an anomaly the UI should shout about rather than a
   routine yellow bar.
7. Staleness: compare the contract's `commit_sha` to the branch head. **A
   mismatch alone is not staleness** — the skill commits `CLYRO.md` itself, so
   the sha inside the file is normally its own parent. On mismatch, call GitHub's
   compare API and only warn when a detection-relevant path changed
   (`requirements.txt`, `package.json`, `*settings*.py`, `Dockerfile`, `urls.py`,
   `*/migrations/*`). One extra API call, and it makes the warning mean
   something.

`github_utils` gains `get_branch_head_sha` and a compare helper.

### Migration

- `ScanResult`: `source` (`clyro_md` | `live`), `contract_raw` (TextField, audit
  trail of exactly what was ingested), `contract_meta` (JSON — schema version,
  `generated_at`, `commit_sha`, confidence, scan mode), `contract_drift` (JSON).
- `EnvVarKey`: `hint`, `acquire_url`.

### Endpoint

`GET /api/skill/clyro-scan` — public, unauthenticated, serves
`backend/skills/clyro-scan/SKILL.md` as `text/markdown` so the `curl` one-liner in the UI
works and the copy-prompt button has something to fetch.

`POST /projects/<pk>/scan/` keeps its name, `AgentJob.Kind.SCAN`, and Celery
plumbing even though ingest is now ~2s — reusing the existing poll path keeps the
frontend diff small.

### `agent_generatable` secrets

`hint: agent_generatable` means the value is entropy with no external authority.
Clyro mints its own at secret-write time and never prompts the user — a small
branch in `env_vars_save`. The `.env.clyro` value the skill wrote locally is
independent and stays on the user's machine; Clyro never reads it, which keeps
the gitignored secret file out of the platform's blast radius entirely.

### Security boundary

`CLYRO.md` is untrusted, user-authored content that flows toward the Step 3/4
LLM prompts. Only the strictly-validated, schema-shaped output of
`to_detection()` may propagate downstream. `contract_raw` is stored for audit and
must never reach an agent prompt — not the canvas chat, not `IacArchitect`.
Without that boundary a repo can inject instructions into infrastructure
generation.

## 5. Frontend

Phases in `hooks/useScanFlow.js`:

```
connect → select → contract → ingesting → results
                      ↑            ↓
                      └── contract_missing | contract_invalid | blocked
```

- **`step1/ContractSetup.jsx`** (new) — shown right after repo and branch are
  picked, *before* any ingest attempt: the `curl` one-liner installing the skill
  into `~/.claude/skills/clyro-scan/`, the `/clyro-scan --fix` command, a
  copy-prompt button for non-Claude agents, and **"I've committed CLYRO.md —
  check now"** which triggers ingest.
- **`step1/ContractInvalid.jsx`** (new) — validation errors as a list with "fix
  and re-check". Distinguishes missing from malformed; malformed is where
  non-Claude agents land.
- **`step1/ScanResults.jsx`** — provenance header ("From CLYRO.md · generated 2h
  ago · commit `abc1234`"), drift banner, stale-commit warning. `CompliancePanel`
  keeps its shape, and the `compliance_prompt` copy button stays useful for a
  second `--fix` round.
- **`shared/EnvVarsPanel.jsx`** — render `acquire_url` links on `third_party`
  secrets; drop `agent_generatable` keys from the required-input set.
- **`ScanProgress.jsx`** — replaced by a short ingest spinner.
- A distinct state for *contract present, but a failed check has no `fix_hint`*
  (or `makemigrations` could not run without the user's venv): blocked, with the
  exact local command. Not the same thing as a missing or malformed contract.
- `constants/stepConfig.js` — Step 1 subtitle. No new `Project.Status` needed;
  `repo_connected` covers "awaiting contract".

## 6. Commit order

1. `backend/skills/clyro-scan/` layout; SKILL.md and example contract spec fixes
2. `scanner/clyro_md.py` — parser and validator
3. `scanner/classify.py` — extraction from the detector
4. migration — `ScanResult` contract fields, `EnvVarKey.hint`/`acquire_url`
5. `runner.py` — ingest, compliance recompute, drift and staleness
6. serve-skill endpoint
7. delete RepoRecon, deterministic detector, warmup, `REPORECON_RUNTIME_ARN`
8. frontend — `ContractSetup` and the recheck flow
9. frontend — `ScanResults` provenance and drift
10. frontend — remove the scan theatre
11. rewrite [Chapter 8](ch_8_wizard_step_1_connect.md) for the new Step 1

## 7. Risks

- **Non-Claude agents produce schema drift.** Validator error quality is the
  whole mitigation. Budget real effort there.
- **`CLYRO.md` committed on a different branch than the deploy branch** reads as
  missing. Needs an explicit error message naming the branch Clyro looked at.
- **`--fix` writes to the user's git history and remote.** Mitigated by the
  preflight in SKILL.md: clean tree required, explicit paths only, never
  `add -A`, never `--force`, confirmation before push, and `git check-ignore`
  verification before any secret file can be staged.
- **`makemigrations` cannot run without the user's virtualenv.** The finding
  stays failed, Clyro blocks, and the receipt prints the command. Correct
  behaviour, but it is the most likely reason a user gets stuck at Step 1.
