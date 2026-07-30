"""Deterministic "Cloud Compliance" checks run right after a successful scan.

These are static, rule-based checks over the repo's file tree/contents — the
detection itself comes from the repo's CLYRO.md contract (see runner.py). They
are deliberately recomputed here on every ingest rather than read out of that
contract: CLYRO.md is committed and hand-editable, so a file edited to claim
every check passes must not be able to walk a blocker into the build. Clyro only
ever deploys a Django backend and/or a React frontend, so these checks are scoped
to the realistic range of Django+React project shapes (monorepo vs
single-service, workspace-committed lockfiles, multi-stage Docker builds,
DB-less backends, Django's `models/` package form, etc.) — not other
frameworks, which never reach this module. Every check here exists because we
hit it live while re-verifying the build pipeline against a real repo: each
one silently 500s or deadlocks provisioning long after the user has moved
past Step 1, so surfacing them at scan time (before the user has invested in
Steps 2-4) is the point.

Each finding is ``{id, title, passed, severity, detail, fix_hint}``. A check
that doesn't apply to this repo at all (e.g. an ALLOWED_HOSTS check when
there's no Django backend) is omitted from the findings entirely rather than
reported as a fake pass — consistently, for every check.
``severity`` is ``blocker`` (build will fail), ``warning`` (deploy will 500 or
hang), or ``info`` (works today, but fragile). ``fix_hint`` is reused verbatim
by build_agent_prompt() below to compose the AI-agent remediation prompt.
"""

from __future__ import annotations

import json
import re
from typing import Any


def _norm(path: str) -> str:
    """'./backend' -> 'backend'; also handles a bare '.' (repo root)."""
    path = (path or '').strip()
    if path in ('', '.', './'):
        return ''
    return path.removeprefix('./').rstrip('/')


def _join(base: str, name: str) -> str:
    return f'{base}/{name}' if base else name


def run_compliance_checks(
    token: str,
    repo_full_name: str,
    branch: str,
    detected_resources: dict[str, Any],
    env_vars: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    from app import github_utils

    services = (detected_resources or {}).get('services', {}) or {}
    backend = services.get('backend') or {}
    frontend = services.get('frontend') or {}
    infra = (detected_resources or {}).get('infrastructure', {}) or {}
    env_keys = {(v.get('key') or '').upper() for v in (env_vars or [])}

    findings: list[dict[str, Any] | None] = []

    try:
        tree = set(github_utils.get_repo_tree(token, repo_full_name, branch))
    except Exception:
        # Tree fetch failing shouldn't take down the whole scan — surface one
        # finding explaining why the rest weren't checked, and stop.
        return [{
            'id': 'tree_fetch_failed',
            'title': 'Could not read repository file tree',
            'passed': False,
            'severity': 'warning',
            'detail': 'GitHub API call to list repo files failed — compliance checks were skipped.',
            'fix_hint': None,
        }]

    if frontend.get('detected'):
        fe_path = _norm(frontend.get('path', ''))
        findings.append(_check_frontend_lockfile(fe_path, tree))
        findings.append(_check_frontend_build_script(
            token, repo_full_name, branch, fe_path, tree, github_utils,
        ))

    if backend.get('detected'):
        be_path = _norm(backend.get('path', ''))
        is_django = (backend.get('framework') or '').lower() == 'django'

        # Only meaningful when a database was actually detected — a legitimately
        # DB-less backend has nothing to read a connection string for.
        if (infra.get('database') or {}).get('detected'):
            findings.append(_check_database_url_env(env_keys))

        # Django-specific checks are omitted entirely (not faked as a pass) when
        # the backend isn't Django, so every check has exactly one `id` and one
        # meaning, whether present or absent from the findings list.
        if is_django:
            findings.append(_check_allowed_hosts_env(env_keys))

        if backend.get('dockerfile_found'):
            findings.append(_check_dockerfile_base_image(
                token, repo_full_name, branch, be_path, tree, github_utils,
            ))

        if is_django:
            findings.append(_check_django_migrations(be_path, tree))
            findings.append(_check_health_endpoint(
                token, repo_full_name, branch, be_path, tree, github_utils,
            ))

    return [f for f in findings if f is not None]


def _check_frontend_lockfile(fe_path: str, tree: set[str]) -> dict[str, Any]:
    lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
    # An npm/yarn/pnpm workspace monorepo commits a single lockfile at the repo
    # root even though the frontend's own package.json lives in a subfolder —
    # check both locations before flagging a blocker.
    found = next(
        (lf for lf in lockfiles if _join(fe_path, lf) in tree or lf in tree),
        None,
    )
    passed = found is not None
    return {
        'id': 'frontend_lockfile',
        'title': 'Frontend lockfile committed',
        'passed': passed,
        'severity': 'blocker',
        'detail': (
            f'Found {found}.' if passed else
            'No package-lock.json/yarn.lock/pnpm-lock.yaml found — the build runs `npm ci`, '
            'which hard-fails without a committed lockfile.'
        ),
        'fix_hint': None if passed else (
            f'Run `npm install` inside `{fe_path or "."}` and commit the generated '
            'package-lock.json (do not gitignore it).'
        ),
    }


def _check_frontend_build_script(token, repo_full_name, branch, fe_path, tree, github_utils) -> dict[str, Any]:
    pkg_path = _join(fe_path, 'package.json')
    if pkg_path not in tree:
        return {
            'id': 'frontend_build_script',
            'title': 'package.json has a build script',
            'passed': False,
            'severity': 'blocker',
            'detail': f'No package.json found at {pkg_path}.',
            'fix_hint': f'Add a package.json with a "build" script under `{fe_path or "."}`.',
        }
    content = github_utils.get_file_content(token, repo_full_name, pkg_path, branch)
    has_build = False
    try:
        has_build = bool((json.loads(content or '{}').get('scripts') or {}).get('build'))
    except json.JSONDecodeError:
        pass
    return {
        'id': 'frontend_build_script',
        'title': 'package.json has a build script',
        'passed': has_build,
        'severity': 'blocker',
        'detail': (
            '"scripts.build" is defined.' if has_build else
            'No "build" script in package.json — the build runs `npm run build` unconditionally, '
            'and output must land in dist/ or build/.'
        ),
        'fix_hint': None if has_build else (
            f'Add a "build" script to `{pkg_path}` (e.g. `"build": "vite build"` or '
            '`"build": "react-scripts build"`) that writes output to dist/ or build/.'
        ),
    }


def _check_database_url_env(env_keys: set[str]) -> dict[str, Any]:
    passed = 'DATABASE_URL' in env_keys
    return {
        'id': 'database_url_env',
        'title': 'Reads DATABASE_URL as a single connection string',
        'passed': passed,
        'severity': 'blocker',
        'detail': (
            'DATABASE_URL detected.' if passed else
            'No DATABASE_URL usage detected — Clyro injects a single Postgres connection '
            'string (postgres://user:pass@host:port/db) into this env var.'
        ),
        'fix_hint': None if passed else (
            'Parse a single DATABASE_URL env var for the DB connection (e.g. via '
            'dj-database-url for Django, or an equivalent for your framework), instead of '
            'separate DB_HOST/DB_USER/DB_PASSWORD env vars.'
        ),
    }


def _check_allowed_hosts_env(env_keys: set[str]) -> dict[str, Any]:
    passed = 'ALLOWED_HOSTS' in env_keys
    return {
        'id': 'allowed_hosts_env',
        'title': 'ALLOWED_HOSTS is read from environment',
        'passed': passed,
        'severity': 'warning',
        'detail': (
            'ALLOWED_HOSTS is read from env — Clyro sets this permissively at deploy time '
            'since its ALB health check sends the target\'s private IP as the Host header, '
            'which no static hostname can match.' if passed else
            'ALLOWED_HOSTS does not appear to be read from environment — if it\'s hardcoded, '
            'the ALB health check will get a 400 and the service will never stabilize.'
        ),
        'fix_hint': None if passed else (
            'Read ALLOWED_HOSTS from an environment variable '
            '(`ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")`) instead of '
            'hardcoding it.'
        ),
    }


_DOCKERFILE_FROM = re.compile(
    r'^FROM\s+(?:--platform=\S+\s+)?'
    r'([a-zA-Z0-9$\{][a-zA-Z0-9._\-/$\{\}]*(?::[a-zA-Z0-9._-]+)?)'
    r'(?:\s+[Aa][Ss]\s+(\S+))?\s*$',
    re.MULTILINE,
)


def _is_registry_host(segment: str) -> bool:
    """Docker's own heuristic: the first path segment is a registry hostname
    (not a Docker Hub user/org namespace) if it looks like a host — contains a
    '.' or ':', or is 'localhost'. Covers ECR (incl. private per-account URLs),
    GCR, GHCR, Quay, self-hosted registries, etc. without a fixed allowlist."""
    return '.' in segment or ':' in segment or segment == 'localhost'


def _check_dockerfile_base_image(token, repo_full_name, branch, be_path, tree, github_utils) -> dict[str, Any] | None:
    dockerfile_path = _join(be_path, 'Dockerfile')
    if dockerfile_path not in tree:
        # backend.dockerfile_found gates the call site, so this only fires on a
        # stale/disagreeing detection — omit rather than fake a pass.
        return None
    content = github_utils.get_file_content(token, repo_full_name, dockerfile_path, branch) or ''

    matches = list(_DOCKERFILE_FROM.finditer(content))
    # A later `FROM <name>` can reference an earlier build stage (multi-stage
    # builds), not a registry pull at all — collect declared stage names first.
    stage_names = {m.group(2).lower() for m in matches if m.group(2)}

    bare_images = []
    for m in matches:
        image = m.group(1)
        if image.lower() in stage_names or image.lower() == 'scratch':
            continue
        if image.startswith('$'):
            continue  # build-arg-parameterized base image — can't resolve statically
        if '/' in image and _is_registry_host(image.split('/')[0]):
            continue
        bare_images.append(image)

    passed = not bare_images
    return {
        'id': 'dockerfile_registry',
        'title': 'Dockerfile avoids anonymous Docker Hub pulls',
        'passed': passed,
        'severity': 'warning',
        'detail': (
            'Base image(s) already pull from a non-Docker-Hub registry.' if passed else
            f'Found {", ".join(bare_images)} pulled straight from Docker Hub — Docker Hub '
            'rate-limits anonymous pulls (~100/6hr, shared across every build using it), a '
            'real occasional CodeBuild failure mode (429 Too Many Requests).'
        ),
        'fix_hint': None if passed else (
            f'In {dockerfile_path}, change `FROM {bare_images[0]}` to the equivalent on the '
            f'public ECR mirror, e.g. `FROM public.ecr.aws/docker/library/{bare_images[0]}`.'
        ),
    }


def _check_django_migrations(be_path: str, tree: set[str]) -> dict[str, Any]:
    prefix = f'{be_path}/' if be_path else ''
    # Django apps can define models either as a single models.py or as a
    # models/ package (models/__init__.py + models/foo.py, common in larger
    # apps) — both forms need to be recognized, or the package form is
    # invisible to this check (never flagged either way).
    models_dirs = {
        p.rsplit('/models.py', 1)[0]
        for p in tree
        if p.startswith(prefix) and p.endswith('/models.py')
    } | {
        p.rsplit('/models/__init__.py', 1)[0]
        for p in tree
        if p.startswith(prefix) and p.endswith('/models/__init__.py')
    }
    missing = []
    for app_dir in models_dirs:
        has_migration = any(
            p.startswith(f'{app_dir}/migrations/') and p.endswith('.py') and not p.endswith('__init__.py')
            for p in tree
        )
        if not has_migration:
            missing.append(app_dir)
    passed = not missing
    return {
        'id': 'django_migrations',
        'title': 'Django apps have committed migrations',
        'passed': passed,
        'severity': 'blocker',
        'detail': (
            'Every app with models.py has at least one migration file.' if passed else
            f'{", ".join(missing) or "An app"} has models.py but no migrations/ files — Clyro '
            'runs `manage.py migrate`, not `makemigrations`, so a missing migration is a silent '
            'no-op and every query 500s with "relation ... does not exist".'
        ),
        'fix_hint': None if passed else (
            f'Run `python manage.py makemigrations` locally for {", ".join(missing) or "the affected app(s)"} '
            'and commit the generated migrations/ files.'
        ),
    }


_HEALTH_ROUTE = re.compile(
    r'(?:path|re_path|url)\s*\(\s*r?["\'][^"\']*health',
    re.IGNORECASE,
)
_HEALTH_PACKAGE_INCLUDE = re.compile(
    r'include\s*\(\s*["\'][\w.]*health[_-]?check',
    re.IGNORECASE,
)


def _check_health_endpoint(token, repo_full_name, branch, be_path, tree, github_utils) -> dict[str, Any]:
    url_files = [p for p in tree if p.split('/')[-1] in ('urls.py',) and p.startswith(f'{be_path}/' if be_path else '')]
    found = False
    for path in url_files:
        content = github_utils.get_file_content(token, repo_full_name, path, branch) or ''
        # Require an actual route registration (path/re_path/url call, or an
        # include() of a health-check package) rather than a bare substring
        # search — the old check false-passed on a mere comment or field name
        # containing "health" and this still catches django-health-check-style
        # includes whose route name itself doesn't literally say "health".
        if _HEALTH_ROUTE.search(content) or _HEALTH_PACKAGE_INCLUDE.search(content):
            found = True
            break
    return {
        'id': 'health_endpoint',
        'title': 'Exposes a /health route',
        'passed': found,
        'severity': 'warning',
        'detail': (
            'A health-check-looking route was found.' if found else
            'No route containing "health" was found in urls.py — Clyro\'s ALB target group '
            'health check is hardcoded to GET /health, and it needs a 200 with no auth required.'
        ),
        'fix_hint': None if found else (
            'Add a route at /health that returns 200 with no authentication required '
            '(e.g. `path("health", lambda request: HttpResponse("ok"))`).'
        ),
    }


def build_agent_prompt(repo_full_name: str, branch: str, findings: list[dict[str, Any]]) -> str | None:
    """A ready-to-paste prompt for an AI coding agent (Claude Code, Cursor, etc.)
    to fix every failed check in the user's own repo. Returns None if nothing
    failed — there's nothing to fix."""
    failed = [f for f in findings if not f.get('passed') and f.get('fix_hint')]
    if not failed:
        return None

    lines = [
        f'I am deploying `{repo_full_name}` (branch `{branch}`) through Clyro, an AI-driven '
        'AWS provisioning tool. Its pre-deploy scan flagged the following issues that will '
        'either fail the build or cause the deployed app to crash/never become healthy. '
        'Fix each one directly in this repo, make the smallest change that satisfies it, and '
        'do not change unrelated code:',
        '',
    ]
    for i, f in enumerate(failed, 1):
        lines.append(f'{i}. **{f["title"]}**')
        lines.append(f'   Problem: {f["detail"]}')
        lines.append(f'   Fix: {f["fix_hint"]}')
        lines.append('')

    lines.append(
        'After making these changes, commit them to the branch above so the next scan/build '
        'picks them up.'
    )
    return '\n'.join(lines)
