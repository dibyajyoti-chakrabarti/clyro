# Chapter 8 — Wizard Step 1: Connect & Contract

Step 1 is the foundation of the whole pipeline: it establishes which repository
and branch Clyro will deploy, learns the shape of the application, and collects
the secrets that application needs. Nothing in Steps 2-7 proceeds without it.

What it no longer does is **scan**. As of the revamp in
[Chapter 20](ch_20_offline_scan_contract_plan.md), detection happens on the
user's own machine: they run the `/clyro-scan` skill with their coding agent
(Claude Code, Cursor, Aider), it reads their real checkout, fixes anything that
would break the deploy, and commits a `CLYRO.md` contract to the repo. Step 1
reads that file.

The skill is the specification for what gets detected and how — see
[`backend/skills/clyro-scan/SKILL.md`](../backend/skills/clyro-scan/SKILL.md)
and the annotated example at
[`reference/CLYRO.example.md`](../backend/skills/clyro-scan/reference/CLYRO.example.md).
This chapter covers the platform half: connection, ingestion, verification, and
storage.

## Supported shapes (MVP)

| Layer | Supported |
| --- | --- |
| Backend | Django only |
| Frontend | React (CRA or Vite), optional |
| Database | PostgreSQL only |
| Workers | Celery, optional (broker: Redis or SQS) |
| Cache | Redis, optional |
| Storage | S3 via django-storages, optional |

A repo outside this matrix gets a clear block, not a partial analysis. The skill
detects the mismatch locally and writes a blocked contract; Clyro surfaces its
`block_message`.

## 8.1 — GitHub connection

Clyro uses a **GitHub App installation**, not plain OAuth, because it gives
scoped per-repo access the user chooses, installation-level tokens, and webhook
delivery on push (reserved for drift detection later).

The user installs the app, picks the repositories to grant, then selects one
repository and a branch (defaulting to `main`). `connect_repo` persists that
choice; ingestion runs immediately after.

Clyro's own access to the repo stays **read-only** — it reads `CLYRO.md`, the
file tree, and a handful of specific files. All writes to the repository are made
by the user's own agent, on their machine, under their git credentials.

## 8.2 — Contract ingestion

`app/scanner/runner.py::run_scan_for_project` runs as a Celery task
(`AgentJob.Kind.SCAN`) and takes ~2s. There is no AgentCore runtime and no cold
start; the Step-1 warmup that used to hide RepoRecon's 17-41s start is gone.

1. **Fetch** `CLYRO.md` from the repo root on the selected branch.
2. **Parse** — `app/scanner/clyro_md.py::parse` loads *every* ` ```yaml ` fence
   in the document and merges the recognized top-level keys. This is deliberately
   blind to document structure: the contract is committed, reviewed in PRs, and
   documented as hand-editable, so users reorder sections and rewrite prose. Keys
   are collected by name, never by which heading they sat under.
3. **Validate** — `validate()` returns every problem at once, each naming the
   offending key. Enums (`classification`, `hint`, `severity`, `engine`,
   `framework`), types, schema version, duplicate keys, and a hard rejection of
   any `value:` field, since a populated value means a secret is sitting in a
   committed file.
4. **Ingest** — `to_detection()` emits the exact shape the retired RepoRecon
   agent returned, so `canvas_core/canvas_builder.py`, `provisioning/iac.py`, and
   `provisioning/build_spec.py` consume it unchanged.
5. **Verify compliance** — always recomputed, never read from the file. See 8.3.
6. **Detect drift and staleness** — see 8.4.

### Outcomes

| Outcome | `ScanResult.status` | `block_reason` | Project status | UI |
| --- | --- | --- | --- | --- |
| Contract ingested | `complete` | — | `scan_complete` | results |
| No `CLYRO.md` | `blocked` | `clyro_md_missing` | **stays `repo_connected`** | setup instructions + re-check |
| Malformed `CLYRO.md` | `blocked` | `clyro_md_invalid` | **stays `repo_connected`** | per-field errors + re-check |
| Contract reports hard block | `blocked` | its `block_message` | `failed` | blocked |
| Contract reports soft block | `blocked` | its `block_message` | `repo_connected` | blocked |

The two retryable rows matter: a user who simply hasn't run the skill yet must
not be moved to `failed`. Every other block path in the codebase sets `failed`,
and doing that here would strand them behind a dead-end status with no way back.

## 8.3 — Compliance is Clyro's, not the contract's

`CLYRO.md` carries a `compliance_findings` block, and Clyro **ignores its
verdicts**. `app/scanner/compliance.py` re-runs every applicable check against
the live file tree on every ingest.

The reason is simple: the contract is a committed, editable file. Trusting its
findings would mean a repo could mark `frontend_lockfile: passed` and walk a
guaranteed `npm ci` build failure straight into CodeBuild. Recomputation costs a
tree fetch and a few file reads — no LLM, no cold start — and the recomputed set
is what gets stored and what gates the Continue button.

Checks, severities, and the "omitted, never faked as a pass" rule for
architecture-dependent checks are unchanged; they are documented in
`compliance.py` and mirrored in the skill.

## 8.4 — Drift and staleness

Two independent disagreements, both surfaced in `ScanResult.contract_drift` and
rendered as a banner above the checklist. Both are warnings — the recomputed
findings already gate the wizard, so drift exists to explain *why* the user is
seeing something they didn't expect.

**Compliance drift.** Any check whose recomputed result differs from what the
contract claimed. Because `--fix` pushes real fixes before Clyro ever looks,
agreement is the normal case, which is why the UI treats disagreement as an
anomaly worth interrupting for rather than a routine yellow bar.

**Staleness.** The contract records `commit_sha` — HEAD at scan time. **A
mismatch against the branch head is not staleness**: the skill commits `CLYRO.md`
itself, so the head is normally one commit *ahead* of the sha recorded inside the
file. On mismatch Clyro calls GitHub's compare API and warns only when a
detection-relevant path changed — `requirements.txt`, `package.json`, any
`*settings*.py`, `Dockerfile`, any `urls.py`, or anything under `migrations/`
(`clyro_md.is_detection_relevant`). An unreachable base sha (force-push, squash)
is reported as "can't tell", not as clean.

## 8.5 — Environment variables

The offline agent walks the **entire backend tree**, not just settings files.
This is the biggest data-quality gain of the revamp: the old in-cloud detector
read settings only, so a `STRIPE_SECRET_KEY` referenced in `payments/views.py`
was invisible and the user met it as a 500 in production.

Patterns matched: `os.environ.get('KEY')`, `os.environ['KEY']`,
`os.getenv('KEY')`, `env('KEY')` (django-environ), `config('KEY')`
(python-decouple). `.env` files are excluded — universally gitignored, never
reliable.

### Classification

Three values, and they are the only three Clyro ingests:

| Classification | Meaning |
| --- | --- |
| `generated` | Clyro's infrastructure provisions the value at deploy time; the user never sees it (`DATABASE_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `AWS_STORAGE_BUCKET_NAME`, `DEFAULT_FILE_STORAGE`, anything whose context touches `DATABASES`/`CACHES`) |
| `optional` | A safe production default exists (`DEBUG`, `ALLOWED_HOSTS`) |
| `user_secret` | Everything else |

**Clyro overrides the contract on the keys it owns.** `app/scanner/classify.py`
re-derives the classification for its own generated/optional key sets: a contract
claiming `DATABASE_URL: user_secret` would otherwise make the wizard prompt for a
connection string Clyro generates itself, and overwrite whatever was typed. For
every other key the contract's claim stands — only the offline agent can see that
`SENDGRID_API_KEY` is a third-party credential.

### Secret hints

Each `user_secret` also carries a `hint`, persisted on `EnvVarKey` and used to
decide what the user is actually asked for:

- **`agent_generatable`** — the value is entropy with no external authority (a
  Django `SECRET_KEY` only has to be secret, not to match anything). `env_vars_save`
  mints one with `secrets.token_urlsafe(48)`; the user is never prompted, and the
  field is not required to continue. It never overrides a value the user did
  supply and never regenerates one already in Secrets Manager — rotating a signing
  key mid-deploy would invalidate every session and token the app has issued.
- **`third_party`** — only an external console has the value, so `acquire_url` is
  rendered next to the input field.

`--fix` also writes an `agent_generatable` value into a gitignored `.env.clyro`
so the repo runs locally. Clyro never reads that file; the two values are
independent, which keeps the local secret file entirely outside the platform's
blast radius.

## 8.6 — Persistent storage

`ScanResult` (JSONB, `scan_results` table):

| Field | Contents |
| --- | --- |
| `detected_resources` | the contract's `repository` / `services` / `infrastructure` / `existing_iac` blocks |
| `env_vars` | normalized list: `key`, `source`, `context`, `classification`, `production_default`, `hint`, `acquire_url` |
| `compliance_findings` | **recomputed** by `compliance.py`, not the contract's |
| `source` | `clyro_md` for contract ingests; `live` backfilled onto rows from the retired scanner |
| `contract_raw` | the CLYRO.md text as ingested, for audit |
| `contract_meta` | `agent`, `generated_at`, `commit_sha`, `scan_mode`, `confidence`, `schema_version` |
| `contract_drift` | drift/staleness notes, or the validation errors on a blocked ingest |
| `draft_canvas_yaml` | **dead** — written by the old scanner, read by nothing; the contract carries no canvas seed |

`EnvVarKey` rows are upserted per `(project, key_name)` with the classification,
source, context, hint, and acquire URL. Values are staged separately (8.7).

> **Security boundary.** `contract_raw` is untrusted, agent-authored text from a
> repo Clyro does not control. Only the validated output of `to_detection()` may
> propagate downstream. It must never be interpolated into an LLM prompt — not
> the Step 3 canvas chat, not `IacArchitect`. Without that boundary a repository
> can inject instructions into infrastructure generation. `contract_raw` is
> deliberately excluded from `ScanResultSerializer`.

## 8.7 — Secrets staging

After the results screen, Step 1's second sub-phase collects values for every
`user_secret` that Clyro can't mint itself. No AWS account exists yet (that's
Step 2), so values land in `EnvVarKey.staged_value` and are written to Secrets
Manager later by `env_vars_save`, which clears the staged plaintext once the
write succeeds.

## 8.8 — Skill distribution

`GET /api/skill/clyro-scan` serves `backend/skills/clyro-scan/SKILL.md` as
`text/markdown`, public and unauthenticated — users install the skill before they
have a project, so requiring a session would be circular. The name is resolved
through an allowlist rather than composed into a filesystem path.

Serving it from the backend rather than a CDN keeps one source of truth: the skill
a user installs is the skill the running backend was deployed with, so the
instructions and the ingestion schema cannot drift apart across a release.

Step 1's setup screen gives a `curl` one-liner into `~/.claude/skills/clyro-scan/`
for Claude Code, plus a link to the raw skill for users on other agents.

## 8.9 — Failure states

| Failure | Severity | Behaviour |
| --- | --- | --- |
| No `CLYRO.md` on the branch | Retryable block | Setup instructions, install command, re-check button |
| `CLYRO.md` malformed / wrong schema version | Retryable block | Per-field validation errors, regenerate and re-check |
| Contract: `missing_requirements` | Hard block | Show minimum requirements |
| Contract: `unsupported_framework` | Hard block | Show supported list |
| Contract: `unsupported_database` (MySQL) | Hard block | Show supported databases |
| Contract: `ambiguous_database` / `no_database_found` | Soft block | Ask the user to confirm the target database |
| Recomputed blocker check fails | Block Continue | Checklist + copyable fix prompt; `--fix` resolves most |
| Failed check with no `fix_hint` (e.g. `makemigrations` needs the user's venv) | Block Continue | Exact local command in the receipt and the checklist |
| Insufficient GitHub permissions / no access | Hard block | Guide through re-granting the App |
| Dockerfile missing | Auto-resolve | `dockerfile_generated: true`; Clyro generates one at build |

## Step 1 outputs

| Output | Location | Consumer |
| --- | --- | --- |
| `detected_resources` | `scan_results` (JSONB) | Step 3 canvas, Step 5 IaC |
| `env_vars` + `EnvVarKey` rows | `scan_results`, `env_var_keys` | Step 1 staging, Step 6 secret write |
| Recomputed `compliance_findings` | `scan_results` (JSONB) | Step 1 gate |
| `contract_meta` / `contract_drift` | `scan_results` (JSONB) | Step 1 provenance + drift banner |

## What Step 1 does not do

- Does not scan the repository — the offline agent does, on the user's machine
- Does not write to the user's repository; `/clyro-scan --fix` does that locally,
  under the user's own git credentials, after its own preflight
- Does not read `.env.clyro`, or any secret value the agent generated locally
- Does not trust the contract's compliance verdicts
- Does not ask about instance sizes, traffic, or scale — that's Step 3
- Does not generate CloudFormation — that's Step 5
