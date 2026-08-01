---
name: clyro-scan
description: >-
  Offline repo scanner for Clyro (AI-driven AWS provisioning). Scans a Django
  repo locally and writes a CLYRO.md contract file that Clyro ingests to skip
  its live Step 1 cloud scan. Django backends only. Invoke with /clyro-scan.
  Modes: default (scan + write CLYRO.md), --fix (also apply compliance fixes,
  generate secrets, then commit and push), --validate (check an existing
  CLYRO.md against the repo).
license: proprietary
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - Bash
---

# Clyro Offline Scan Skill

You are running the **Clyro offline repo scan**. Clyro is an AI-driven AWS
provisioning platform. Normally its Step 1 runs a slow cloud scan (17–41s cold
start) against a connected GitHub repo to detect the app's shape, environment
variables, and pre-deploy compliance problems. This skill moves that scan onto
the developer's own machine: you read the repo directly and emit a single
`CLYRO.md` at the repo root. Clyro reads that file on connect and skips the live
scan entirely.

**Scope: Django backends only.** Clyro currently provisions Python/Django +
PostgreSQL, optionally with a React frontend, Redis cache, Celery worker, and S3
storage. A React frontend, when present, is scanned as a secondary service — but
every hard requirement below is about the Django backend. If the repo has no
Django backend, stop and write a hard-block CLYRO.md (see *Hard blocks*).

The `CLYRO.md` you produce must be **complete** — a filled-in contract for THIS
repo, never placeholder examples. Every value comes from something you actually
read in the tree. If you cannot determine a value, set it to `null` and say why
in the human-readable section; do not invent it.

---

## Invocation

```
/clyro-scan                 # scan, write CLYRO.md (read-only on the codebase)
/clyro-scan --fix           # scan, APPLY fixes, commit each fix, ask, then push
/clyro-scan --fix --no-push # same, but stop after committing (user pushes)
/clyro-scan --fix --yes     # same as --fix, but push without asking (CI)
/clyro-scan --validate      # verify an existing CLYRO.md still matches the repo
```

Exactly one mode runs per invocation. `--fix` and `--validate` are mutually
exclusive; if both are passed, refuse and ask which one. `--no-push` and `--yes`
are only meaningful with `--fix`; `--no-push --yes` together means commit only.

---

## Shared Phase 1 — Deterministic detection (all modes)

Do this first, mechanically, before any LLM reasoning. It mirrors Clyro's own
`deterministic_detector.py` so the output schema matches what the platform
ingests.

1. **Locate the backend.** Look for `requirements.txt` + `manage.py`.
   - Root `requirements.txt` + `manage.py` → backend path `.`
   - `backend/requirements.txt` → backend path `./backend` (monorepo)
   - `requirements.txt` at root only → backend path `.`
   - No `requirements.txt` anywhere → **hard block** `missing_requirements`.
2. **Confirm Django.** `requirements.txt` must have a direct `django` line (not
   `django-storages`/`django_redis`). Match `^django(?:[=<>~![].*)?$`,
   case-insensitive. If absent → **hard block** `unsupported_framework`.
3. **Reject MySQL.** If `mysqlclient` or `pymysql` is a requirement → **hard
   block** `unsupported_database` (Clyro is PostgreSQL-only).
4. **Database.** PostgreSQL is required. `psycopg2`/`psycopg2-binary` in
   requirements → database detected (`engine: postgres`). If not detected:
   - settings mention `sqlite` → **soft block** `ambiguous_database`
   - otherwise → **soft block** `no_database_found`
5. **Find settings files.** Any `*.py` under the backend dir ending in
   `settings.py` or under a `/settings/` package (e.g. `taskboard/settings/base.py`).
   Search the tree — do not guess the project package name.
5b. **Resolve the Django project package.** `project_name` is consumed by Clyro
   downstream (it names the generated architecture), so resolve it rather than
   leaving it null: read `DJANGO_SETTINGS_MODULE` out of `manage.py` (or
   `wsgi.py`/`asgi.py`) and take its first dotted segment — for
   `taskboard.settings.base` that is `taskboard`. Only `null` if none of those
   files resolve. `wsgi_path` (e.g. `taskboard.wsgi:application`) is best-effort;
   null is fine.
6. **Detect the rest from requirements + settings:**
   - cache/redis: `django-redis` or `redis` → Redis cache
   - worker: `celery` → Celery worker; `django-celery-beat` → `scheduled: true`
   - broker: inspect `CELERY_BROKER_URL`/settings. `redis://` present (or no
     `sqs`) → `redis`; explicit `sqs` → `sqs`. **Do not blindly default to
     sqs** — report the real broker.
   - storage: `boto3` **and** `django-storages` **and** `S3Boto3Storage` in
     settings → S3 storage
   - Dockerfile: `<backend>/Dockerfile` present → `dockerfile_found: true`,
     else `dockerfile_generated: true` (Clyro generates one).
7. **Detect a React frontend (optional, secondary).**
   - `frontend/package.json` with `"react"` and without `"next"` → React
     frontend at `./frontend` (monorepo).
   - root `package.json` alongside root backend, `"react"` without `"next"` →
     React at `.`.
   - `"next"` present → not a supported frontend for v1; note it, treat frontend
     as not detected.
8. **Extract env vars from the whole backend tree**, not just settings files.
   This is the single biggest advantage you have over Clyro's own scanner, which
   only ever reads settings: a `STRIPE_SECRET_KEY` referenced in
   `payments/views.py` or a `SENDGRID_API_KEY` in `notifications/email.py` is
   invisible to it, and the user hits a missing-secret 500 in production. Walk
   every `*.py` under the backend dir (skip `migrations/`, `tests/`, `.venv/`,
   `node_modules/`) and match these access patterns:
   `os.environ.get('KEY')`, `os.environ['KEY']`, `os.getenv('KEY')`,
   `env('KEY')` (django-environ), `config('KEY')` (python-decouple). Record
   `key`, `source` (file), `context` (the source line, ≤200 chars). First
   occurrence wins; prefer a settings file as the `source` when a key appears in
   both. Classify each — see *Env var classification*.
9. **Existing IaC.** If the tree has `terraform/`, `cloudformation/`, `cdk/`, or
   `infrastructure/` markers, set `existing_iac.found: true` with the path.
   Clyro may reconcile rather than generate.

**Confidence.** Mark `high` when the layout matched cleanly. Mark `low` for
unusual layouts, existing IaC, or ambiguous DB. Low confidence still writes
CLYRO.md but the metadata flags it so Clyro can double-check.

### Env var classification

Each env var gets one `classification`. These are the values Clyro ingests —
use exactly these three in the machine-parseable block:

| classification | meaning | examples |
|---|---|---|
| `generated`   | Clyro's own infra provisions the value at deploy time; user never sees it | `DATABASE_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `AWS_STORAGE_BUCKET_NAME`, `DEFAULT_FILE_STORAGE`; any var whose context line touches `DATABASES`/`CACHES` |
| `optional`    | safe production default exists; user may skip | `DEBUG`, `ALLOWED_HOSTS` |
| `user_secret` | user must supply a value | everything else (`DJANGO_SECRET_KEY`, `STRIPE_SECRET_KEY`, `SENDGRID_API_KEY`, …) |

Rules: key in the generated set → `generated`. Key in `{DEBUG, ALLOWED_HOSTS}` →
`optional`. Context line mentions `DATABASES` or `CACHES` → `generated`.
Otherwise → `user_secret`.

Every `user_secret` also carries a `hint`, and Clyro ingests it — it decides
what the user is asked for in the wizard, so it is part of the contract, not
decoration. One of:

- `agent_generatable` — the value is just entropy, with no external authority
  (e.g. `DJANGO_SECRET_KEY` = a random 50-char string). Clyro mints its own
  value server-side at deploy time and never prompts the user for it. In `--fix`
  mode you *also* write one to `.env.clyro` so the repo runs locally; the two
  values are independent and that is fine.
- `third_party` — the value exists only in an external console, so nobody can
  generate it. Emit an `acquire_url` alongside it (Stripe →
  https://dashboard.stripe.com/apikeys, SendGrid →
  https://app.sendgrid.com/settings/api_keys, etc.). Clyro renders that link
  next to the input field. Omit `acquire_url` only when you genuinely cannot
  identify the service.

Set `hint: third_party` when the key name or its context names a recognizable
external service; `agent_generatable` when the value is arbitrary entropy the
app only compares against itself. When neither is clear, use `third_party`
without an `acquire_url` — asking the user is safe, silently minting a value for
something that had to match an external system is not.

**Never write a secret VALUE into CLYRO.md.** Only key names, sources, and
classifications. Values live in `.env.clyro`, which must be gitignored.

---

## Shared Phase 2 — Compliance checks

Run every applicable check below and record a finding
`{id, title, passed, severity, detail, fix_hint}`. Severity is `blocker` (build
fails), `warning` (deploy 500s or never becomes healthy), or `info` (fragile).

**A check that does not apply to this repo is OMITTED entirely — never faked as
a pass.** The applicability gate is the "Applies when" column: this is what the
user means by *some compliance points are optional and depend on architecture*.
For every omitted check, still record it in CLYRO.md's `## Compliance` prose
under **Conditional / not-applicable checks** with a one-line reason, so the
contract documents why it was skipped.

### Django backend checks

| id | severity | Applies when | What it verifies |
|---|---|---|---|
| `database_url_env` | blocker | a database is detected (conditional — a legitimately DB-less backend omits this) | `DATABASE_URL` is among the extracted env vars. Clyro injects one Postgres connection string; the app must read it as a single URL, not split `DB_HOST`/`DB_USER`/… |
| `allowed_hosts_env` | warning | always (Django) | `ALLOWED_HOSTS` is read from env. Clyro's ALB health check sends the target's private IP as the `Host` header; a hardcoded `ALLOWED_HOSTS` returns 400 and the service never stabilizes. |
| `django_migrations` | blocker | always (Django) | Every app with `models.py` OR a `models/` package has ≥1 real migration file in `migrations/` (not just `__init__.py`). Clyro runs `migrate`, not `makemigrations`; a missing migration silently no-ops and every query 500s with `relation ... does not exist`. |
| `health_endpoint` | warning | always (Django) | A `urls.py` registers a route whose path contains `health` (via `path`/`re_path`/`url`, or an `include()` of a health-check package). Clyro's ALB target group hardcodes `GET /health` and needs a 200 with no auth. |
| `dockerfile_registry` | warning | **conditional** — only if a Dockerfile is committed in the backend dir (if Clyro generates the Dockerfile, this is skipped) | No `FROM` line pulls a bare image straight from Docker Hub. Docker Hub rate-limits anonymous pulls (~100/6hr shared), a real CodeBuild 429 failure mode. Multi-stage stage refs and `scratch` and build-arg (`$`) bases are ignored; a `FROM` with a registry host (contains `.`/`:` or `localhost`) in the first path segment passes. |

### React frontend checks (conditional — only if a React frontend was detected)

These are **architecture-dependent**: a Django-only repo omits both. Document
them as not-applicable when there is no frontend.

| id | severity | Applies when | What it verifies |
|---|---|---|---|
| `frontend_lockfile` | blocker | React frontend detected | A `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` exists at the frontend dir OR repo root (workspace monorepos commit one root lockfile). Build runs `npm ci`, which hard-fails without a committed lockfile. |
| `frontend_build_script` | blocker | React frontend detected | `package.json` defines `scripts.build`, output landing in `dist/` or `build/`. Build runs `npm run build` unconditionally. |

### Failure-to-read guard

If you cannot read the repo tree at all, emit a single finding
`tree_fetch_failed` (warning) and stop the compliance phase — do not emit fake
passes for the rest.

---

## CLYRO.md output format — what Clyro actually ingests

**This section is the authoritative format. Follow it exactly — do not invent
fence tags or key names.** Clyro's ingester (`clyro_md.py`) is deliberately
structure-blind: it scans the whole document, finds **every fenced code block
whose language is `yaml` (or `yml`)**, parses each as YAML, and merges the
recognized top-level keys into one dict. Everything else — prose, tables, HTML
comments, headings — is ignored for ingestion.

Two hard rules follow from that:

1. **Fences must be ` ```yaml `.** A block fenced ` ```clyro `, ` ```clyro:env `,
   ` ```json `, or with no language is **invisible** to the parser. If none of
   your blocks are `yaml`, ingestion fails with *"No machine-readable ```yaml
   block found in CLYRO.md."* — the contract is rejected even though it looks
   complete.
2. **Use these exact top-level keys** (anything else is silently dropped):
   `repository`, `services`, `infrastructure`, `existing_iac`, `env_vars`,
   `compliance_findings`, `status`, `block_reason`, `block_message`, `agent`,
   `generated_at`, `commit_sha`, `scan_mode`, `confidence`, `schema_version`.
   Note: it is `services`/`infrastructure`/`env_vars`/`compliance_findings` —
   **not** `resources`/`env`/`compliance`.

You may split these across several `yaml` fences (one per section, as below) or
combine them; the parser merges by key name regardless of which heading a fence
sits under. Emit exactly these blocks, filled in from what you read in THIS repo
(a fuller annotated example lives at `reference/CLYRO.example.md`):

**Resource graph** — `repository` + `services` + `infrastructure` + `existing_iac`:

```yaml
repository:
  is_monorepo: true
services:
  backend:
    detected: true
    framework: django
    path: ./backend            # "." for a root-level backend
    project_name: taskboard    # Django project package; null only if unresolvable
    wsgi_path: taskboard.wsgi:application   # best-effort; null is fine
    dockerfile_found: true
    dockerfile_generated: false  # true when Clyro will generate the Dockerfile
  frontend:                    # detected:false when backend-only
    detected: true
    framework: react
    path: ./frontend
  worker:
    detected: true
    type: celery
    scheduled: true
    broker: redis              # real broker (redis|sqs), NOT a blind sqs default
infrastructure:
  database:
    detected: true
    engine: postgres           # PostgreSQL only; MySQL/SQLite are blocks
    source: backend/requirements.txt
  cache:
    detected: true
    engine: redis
    source: backend/requirements.txt
  storage:
    detected: true
    type: s3
    source: settings
  queue:
    detected: false            # true only when the Celery broker is SQS
    type: null
    source: null
existing_iac:
  found: false
  type: null
  path: null
```

**Environment variables** — one entry per var under `env_vars` (classification is
one of `generated`/`optional`/`user_secret`; every `user_secret` also carries a
`hint` of `agent_generatable` or `third_party`, and `third_party` carries an
`acquire_url` when the service is recognizable):

```yaml
env_vars:
  - key: DATABASE_URL
    source: backend/config/settings/base.py
    context: "dj_database_url.parse(os.environ['DATABASE_URL'])"
    classification: generated
    production_default: null
  - key: DJANGO_SECRET_KEY
    source: backend/config/settings/base.py
    context: "SECRET_KEY = os.environ['DJANGO_SECRET_KEY']"
    classification: user_secret
    production_default: null
    hint: agent_generatable
  - key: STRIPE_SECRET_KEY
    source: backend/payments/views.py
    context: "stripe.api_key = os.environ['STRIPE_SECRET_KEY']"
    classification: user_secret
    production_default: null
    hint: third_party
    acquire_url: https://dashboard.stripe.com/apikeys
  - key: DEBUG
    source: backend/config/settings/base.py
    context: "DEBUG = os.environ.get('DEBUG', 'False') == 'True'"
    classification: optional
    production_default: "False"
```

**Compliance** — applied findings only, under `compliance_findings` (omitted
architecture-dependent checks are documented in prose, never emitted as findings):

```yaml
compliance_findings:
  - id: health_endpoint
    title: Exposes a /health route
    passed: false
    severity: warning
    detail: No route containing "health" was found in urls.py.
    fix_hint: >-
      Add a route at /health that returns 200 with no authentication required
      (e.g. path("health", lambda request: HttpResponse("ok"))).
```

**Block status + metadata** — always emit both (on a clean scan `status:
complete` and the block fields are null):

```yaml
status: complete          # complete | hard_block | soft_block
block_reason: null        # missing_requirements | unsupported_framework | unsupported_database | ambiguous_database | no_database_found
block_message: null
agent: "clyro-scan skill"
commit_sha: "<git rev-parse HEAD at scan time>"
scan_mode: default        # default | fix | validate
confidence: high          # high | low
schema_version: 1
```

---

## Mode behaviour

### Default `/clyro-scan`
Run Phase 1 + Phase 2. Write `CLYRO.md` at the repo root using the exact machine
blocks from *CLYRO.md output format* above (` ```yaml ` fences, keys
`services`/`infrastructure`/`env_vars`/`compliance_findings`), with `commit_sha`
set to `git rev-parse HEAD`. Do
**not** modify any other file. Do not write `.env.clyro`. Do not stage, commit,
or push — CLYRO.md is left in the working tree for the user to review and commit
themselves. Print a summary: N resources, N env vars (by classification), and
compliance X/Y passing with the failing ids. When anything failed, end by
pointing at `/clyro-scan --fix`, which fixes, commits, and pushes.

### `/clyro-scan --fix`

The point of `--fix` is that the repo Clyro eventually reads is **already cloud
compliant**: fix the failures, commit each one, push to the branch the user is
deploying, and regenerate CLYRO.md so it describes the fixed repo rather than the
broken one. This is the only mode that writes to the user's history and remote,
so it runs a preflight first and aborts rather than improvising.

#### Preflight — run before touching anything, abort on any failure

Abort means: change no file, create no commit, and print which check failed.

1. Inside a git work tree (`git rev-parse --is-inside-work-tree`).
2. `git status --porcelain` is **empty**. Any pre-existing uncommitted or staged
   change ⇒ abort and list the files. Otherwise your commits would swallow the
   user's in-flight work, which you cannot cleanly undo for them.
3. Not detached HEAD, and no rebase/merge/cherry-pick in progress.
4. An `origin` remote exists and the current branch has an upstream
   (`git rev-parse --abbrev-ref @{upstream}`). If there is no upstream, continue
   but force `--no-push` behaviour and say so.
5. Record the branch name and `git rev-parse HEAD` — the head sha goes into
   CLYRO.md's metadata as `commit_sha`.

Then run Phase 1 + Phase 2, and remediate every **failed** check that has a
`fix_hint`, making the smallest change that satisfies it and touching nothing
unrelated. Use each finding's `fix_hint` as the spec:

- `database_url_env` → refactor settings to read one `DATABASE_URL` via
  `dj-database-url` (`DATABASES = {'default': dj_database_url.parse(os.environ['DATABASE_URL'])}`)
  and add `dj-database-url` to `requirements.txt`.
- `allowed_hosts_env` → `ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')`.
- `django_migrations` → run `python manage.py makemigrations <app>` and commit
  the generated files. If you cannot run it, tell the user the exact command.
- `health_endpoint` → add `path('health', lambda request: HttpResponse('ok'))`
  (import `HttpResponse`) to the root `urls.py`.
- `dockerfile_registry` → rewrite `FROM <img>` to
  `FROM public.ecr.aws/docker/library/<img>`.
- `frontend_lockfile` → run `npm install` in the frontend dir and commit the
  lockfile (tell the user if you cannot run npm).
- `frontend_build_script` → add a `build` script to `package.json`.

#### Secret hygiene — before any `git add`

For `user_secret` vars hinted `agent_generatable` (e.g. `DJANGO_SECRET_KEY`),
generate a value and write it to `.env.clyro` (create/append). For `third_party`
secrets, do NOT invent a value — print the `acquire_url` for the user to fetch
it.

`.env.clyro` holds real secret material, and this mode pushes. So, before
staging anything:

1. Ensure `.gitignore` contains `.env.clyro`; add the line if missing (this
   `.gitignore` edit is itself a legitimate part of the fix commit).
2. Verify it with `git check-ignore .env.clyro`. If that does not report the
   file as ignored, **abort before committing** — do not attempt a workaround.
3. If `.env.clyro` is already tracked (`git ls-files --error-unmatch .env.clyro`
   succeeds), abort and tell the user to `git rm --cached .env.clyro` and rotate
   anything that was in it. Do not commit over it.

#### Regenerate, commit, push

After fixing, re-run Phase 2 so the findings describe the post-fix repo, then
write CLYRO.md with the fresh findings and `scan_mode: fix`.

Commit **one logical fix per commit**, staging explicit paths only. Never
`git add -A`, `git add .`, or `git commit -a` — an unexpected file in the tree
must not ride along in a pushed commit. One short imperative subject line per
commit, no body needed:

```
git add backend/urls.py            && git commit -m "fix: add /health route for ALB health check"
git add backend/Dockerfile         && git commit -m "fix: pull python base image from public ECR mirror"
git add .gitignore CLYRO.md        && git commit -m "chore: add CLYRO.md contract for Clyro deploys"
```

Then push, unless `--no-push` was passed or there is no upstream:

- Print the branch, its upstream, and `git diff --stat <preflight_head>..HEAD` so
  the user sees exactly what is about to leave the machine.
- **Ask for confirmation before pushing**, unless `--yes` was passed.
- Push with a plain `git push`. Never `--force`, `--force-with-lease`, or a
  refspec targeting a different branch. If the push is rejected as non-fast-forward,
  stop and tell the user to pull/rebase — do not resolve it yourself.

If anything fails mid-sequence, stop and report the exact state (which fixes are
committed, whether the push happened). Committed-but-unpushed is a safe place to
land; the user can inspect with `git log` and push or reset themselves.

Print a receipt like:

```
Fixed   Added /health route to backend/urls.py
Fixed   Rewrote Dockerfile FROM to public ECR mirror
Skipped django_migrations — needs your venv: python manage.py makemigrations blog
Secret  DJANGO_SECRET_KEY generated -> .env.clyro (gitignored, stays local)
Action  STRIPE_SECRET_KEY -> get it at https://dashboard.stripe.com/apikeys
Wrote   CLYRO.md (5 resources, 9 env vars, 6/7 compliance passing)
Commits 3 on `main`, pushed to origin/main
```

Checks with no `fix_hint`, and fixes you could not run locally (a
`makemigrations` needing the project's virtualenv), stay **failed** in CLYRO.md.
Do not paper over them — Clyro blocks the deploy on that finding, which is the
correct outcome, and the receipt tells the user the exact command to run.

### `/clyro-scan --validate`
Read the existing `CLYRO.md`. If absent, say so and suggest running
`/clyro-scan`. If present:
1. Re-run Phase 1 + Phase 2 against the current repo.
2. Diff the fresh result against CLYRO.md's machine-parseable blocks. Report:
   - env vars in code but missing from CLYRO.md (or vice versa)
   - classification mismatches
   - resource-graph drift (new/removed service or infra)
   - compliance findings that changed pass/fail
   - schema-version mismatch (see the CLYRO.md `Schema version` comment)
   - staleness: `commit_sha` in the metadata block vs `git rev-parse HEAD`. A
     mismatch alone is not staleness — CLYRO.md's own commit moves HEAD past the
     sha recorded inside it. Only report stale when
     `git diff --name-only <commit_sha>..HEAD` touches something detection
     depends on: `requirements.txt`, `package.json`, any `*settings*.py`,
     `Dockerfile`, any `urls.py`, or any `migrations/` path.
3. Do **not** modify any file, including CLYRO.md. Print `VALID` (matches) or a
   drift report with the exact fields to update and the command to fix it
   (`/clyro-scan` to regenerate, `/clyro-scan --fix` to also remediate).

---

## Hard blocks

When Phase 1 hits a block, still write CLYRO.md, but with a `status` other than
`complete` and the resource/env sections null:

- `missing_requirements` (hard) — no `requirements.txt`.
- `unsupported_framework` (hard) — backend isn't Django.
- `unsupported_database` (hard) — MySQL detected.
- `ambiguous_database` / `no_database_found` (soft) — no PostgreSQL detected;
  confidence `low` so Clyro can re-examine.

State the block clearly in the human-readable section with the fix, e.g. add
`psycopg2-binary` and configure PostgreSQL.

A block is not a compliance failure and `--fix` does not try to fix one: adding
PostgreSQL to a repo that has no database, or porting a Flask app to Django, is
not a mechanical edit. Write the block CLYRO.md, commit nothing, and explain the
fix.

---

## Guarantees / constraints

- CLYRO.md is committed; `.env.clyro` is gitignored. Never put secret values in
  CLYRO.md — only key names, sources, classifications, and hints.
- Only `--fix` writes to git, and only after its preflight passes. Default and
  `--validate` modes never stage, commit, or push. Never `--force` push, never
  push a branch other than the current one, never commit with `-a`/`add -A`.
- Never claim a check passed without evidence from the tree.
- Django only. React frontend is the sole supported secondary service; anything
  else (Vue, Next, non-Python backends) is out of scope — note it, don't scan
  it.
- Machine-parseable blocks are the source of truth for ingestion; keep them
  exactly matching the human-readable tables.
- Set the `Schema version` comment to `1`, and always emit `commit_sha` in the
  metadata block — Clyro uses it to tell a fresh contract from a stale one.
