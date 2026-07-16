"""Deterministic, manifest-based repo detector — the fast, free floor RepoRecon
(Step 1) never had. Mirrors the guardrail pattern already used at Step 3 canvas
chat (``app.canvas.services``) and Step 4/5 ``iac.refine()``: try the cheap
deterministic path first, only pay for an LLM call (and its ~17s AgentCore cold
start) when this can't confidently classify the repo.

Reproduces the exact detection rules already documented in the RepoRecon
system prompt (``backend/agents/CryloCanvas/app/RepoRecon/main.py``) — same
output schema, same block reasons — for the narrow, common case this covers
confidently. Anything it isn't sure about (ambiguous frameworks, an unusual
layout, existing IaC already in the repo) returns ``None`` so the caller falls
back to the LLM agent unchanged.

Also fixes a real bug in that schema along the way: the agent's own output
always set ``infrastructure.queue.type = "sqs"`` whenever a Celery worker was
detected, regardless of the actual configured broker — this module instead
inspects ``CELERY_BROKER_URL``/requirements to report the real broker.
"""

from __future__ import annotations

import re
from typing import Any

from app import github_utils as _default_github_utils

_GENERATED_ENV_KEYS = {
    "DATABASE_URL", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND",
    "AWS_STORAGE_BUCKET_NAME", "DEFAULT_FILE_STORAGE",
}
_OPTIONAL_ENV_KEYS = {"DEBUG", "ALLOWED_HOSTS"}

_ENV_VAR_RE = re.compile(
    r"""os\.environ\.get\(\s*['"](?P<k1>[A-Z0-9_]+)['"]|"""
    r"""os\.environ\[\s*['"](?P<k2>[A-Z0-9_]+)['"]\s*\]|"""
    r"""os\.getenv\(\s*['"](?P<k3>[A-Z0-9_]+)['"]|"""
    r"""\benv\(\s*['"](?P<k4>[A-Z0-9_]+)['"]|"""
    r"""\bconfig\(\s*['"](?P<k5>[A-Z0-9_]+)['"]"""
)

_IAC_DIR_MARKERS = ("terraform/", "cloudformation/", "cdk/", "infrastructure/")


def _requirement_matches(requirements: str, package: str) -> bool:
    """True if ``package`` is a direct requirement line — 'django' must not
    match 'django-storages' or 'django_redis'."""
    pattern = re.compile(rf"^{re.escape(package)}(?:[=<>~!\[].*)?\s*$", re.IGNORECASE | re.MULTILINE)
    return bool(pattern.search(requirements))


def _requirement_contains(requirements: str, needle: str) -> bool:
    return needle.lower() in requirements.lower()


def _find_backend_path(tree: set[str]) -> tuple[str, str] | None:
    """Return (dir_prefix, requirements_path) for the backend service, or None.
    dir_prefix is "" for a root-level backend, else "backend/"-style."""
    if "requirements.txt" in tree and "manage.py" in tree:
        return "", "requirements.txt"
    if "backend/requirements.txt" in tree:
        return "backend/", "backend/requirements.txt"
    if "requirements.txt" in tree:
        return "", "requirements.txt"
    return None


def _find_settings_paths(tree: set[str], backend_prefix: str) -> list[str]:
    """Any settings.py-shaped file under the backend directory. Found live:
    a fixed list of conventional paths (settings.py, config/settings.py, ...)
    misses a custom-named Django project package (e.g. a project called
    "taskboard" keeps its settings at taskboard/settings/base.py) — search
    the tree directly instead of guessing the project's own name."""
    found = []
    for path in tree:
        if backend_prefix and not path.startswith(backend_prefix):
            continue
        rest = path[len(backend_prefix):] if backend_prefix else path
        if not rest.endswith(".py"):
            continue
        if rest.endswith("settings.py") or "/settings/" in rest:
            found.append(path)
    return sorted(found)


def _classify_env_key(key: str, context: str) -> str:
    if key in _GENERATED_ENV_KEYS:
        return "generated"
    if key in _OPTIONAL_ENV_KEYS:
        return "optional"
    context_upper = (context or "").upper()
    if any(marker in context_upper for marker in ("DATABASES", "CACHES")) or key in _GENERATED_ENV_KEYS:
        return "generated"
    return "user_secret"


def _extract_env_vars(settings_files: dict[str, str]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for path, content in settings_files.items():
        for line in content.splitlines():
            match = _ENV_VAR_RE.search(line)
            if not match:
                continue
            key = next(v for v in match.groupdict().values() if v)
            if key in seen:
                continue
            seen[key] = {
                "key": key,
                "source": path,
                "context": line.strip()[:200],
                "classification": _classify_env_key(key, line),
                "production_default": None,
            }
    return list(seen.values())


def detect(
    token: str, repo_full_name: str, branch: str, github_utils=None,
) -> dict[str, Any] | None:
    """Best-effort deterministic detection. Returns a RepoRecon-shaped result
    dict with an extra ``confidence`` key ("high" | "low"), or None when the
    repo tree itself couldn't be read at all. Callers should only trust a
    "high" confidence result and fall back to the LLM agent otherwise."""
    gh = github_utils or _default_github_utils

    try:
        tree = set(gh.get_repo_tree(token, repo_full_name, branch))
    except Exception:
        return None

    backend = _find_backend_path(tree)
    if backend is None:
        # No requirements.txt anywhere — this is itself the documented hard
        # block, and fully mechanical to detect.
        return {
            "status": "hard_block",
            "block_reason": "missing_requirements",
            "block_message": "No requirements.txt found — Clyro currently supports Python/Django backends only.",
            "detected_resources": None,
            "env_vars": None,
            "confidence": "high",
        }

    backend_prefix, requirements_path = backend
    requirements = gh.get_file_content(token, repo_full_name, requirements_path, branch) or ""

    if not _requirement_matches(requirements, "django"):
        return {
            "status": "hard_block",
            "block_reason": "unsupported_framework",
            "block_message": "This repo's backend isn't Django — Clyro currently supports Django backends only.",
            "detected_resources": None,
            "env_vars": None,
            "confidence": "high",
        }

    if _requirement_contains(requirements, "mysqlclient") or _requirement_contains(requirements, "pymysql"):
        return {
            "status": "hard_block",
            "block_reason": "unsupported_database",
            "block_message": "This repo uses MySQL — Clyro currently supports PostgreSQL only.",
            "detected_resources": None,
            "env_vars": None,
            "confidence": "high",
        }

    # Frontend
    frontend_path = "frontend/package.json" if "frontend/package.json" in tree else None
    frontend_detected = False
    if frontend_path:
        pkg_content = gh.get_file_content(token, repo_full_name, frontend_path, branch) or ""
        frontend_detected = '"react"' in pkg_content and '"next"' not in pkg_content
    elif "package.json" in tree and not backend_prefix:
        # Single-directory repo — package.json coexists with requirements.txt at root.
        pkg_content = gh.get_file_content(token, repo_full_name, "package.json", branch) or ""
        frontend_detected = '"react"' in pkg_content and '"next"' not in pkg_content
        frontend_path = "package.json"

    # An unusual layout we don't confidently model — fall back to the LLM.
    is_monorepo = bool(backend_prefix) or bool(frontend_path and frontend_path != "package.json")
    if ("package.json" in tree or "frontend/package.json" in tree) and not frontend_path:
        return {"confidence": "low"}
    if any(marker in path for path in tree for marker in _IAC_DIR_MARKERS):
        return {"confidence": "low"}  # existing IaC — let the LLM reason about it

    settings_paths = _find_settings_paths(tree, backend_prefix)
    settings_files = {
        p: (gh.get_file_content(token, repo_full_name, p, branch) or "") for p in settings_paths
    }
    all_settings_content = "\n".join(settings_files.values())

    database_detected = _requirement_contains(requirements, "psycopg2")
    if not database_detected:
        has_sqlite = "sqlite" in all_settings_content.lower()
        block_reason = "ambiguous_database" if has_sqlite else "no_database_found"
        message = (
            "This repo's database configuration looks like SQLite, not PostgreSQL."
            if has_sqlite else
            "Couldn't find a database configuration — Clyro requires PostgreSQL."
        )
        return {
            "status": "soft_block",
            "block_reason": block_reason,
            "block_message": message,
            "detected_resources": None,
            "env_vars": None,
            "confidence": "low",  # soft blocks stay ambiguous enough to defer to the LLM's judgment
        }

    cache_detected = _requirement_contains(requirements, "django-redis") or _requirement_contains(requirements, "redis")
    worker_detected = _requirement_contains(requirements, "celery")
    scheduled = _requirement_contains(requirements, "django-celery-beat")

    # Real broker choice, not a blind default — the bug item 9 in the audit
    # flagged: the old agent schema always claimed queue.type="sqs" whenever a
    # worker existed, regardless of what CELERY_BROKER_URL actually pointed at.
    broker_is_redis = cache_detected and (
        "redis://" in all_settings_content or not _requirement_contains(requirements, "sqs")
    )
    broker_is_sqs = worker_detected and not broker_is_redis and (
        _requirement_contains(requirements, "sqs") or "sqs" in all_settings_content.lower()
    )

    storage_detected = (
        _requirement_contains(requirements, "boto3")
        and _requirement_contains(requirements, "django-storages")
        and "S3Boto3Storage" in all_settings_content
    )

    dockerfile_path = f"{backend_prefix}Dockerfile"
    dockerfile_found = dockerfile_path in tree

    detected_resources = {
        "repository": {"is_monorepo": is_monorepo},
        "services": {
            "backend": {
                "detected": True,
                "framework": "django",
                "path": f"./{backend_prefix}" if backend_prefix else ".",
                "project_name": None,
                "wsgi_path": None,
                "dockerfile_found": dockerfile_found,
                "dockerfile_generated": not dockerfile_found,
            },
            "frontend": {
                "detected": frontend_detected,
                "framework": "react" if frontend_detected else None,
                "path": "./frontend" if (frontend_detected and is_monorepo) else ("." if frontend_detected else None),
            },
            "worker": {
                "detected": worker_detected,
                "type": "celery" if worker_detected else None,
                "scheduled": scheduled,
                "broker": "redis" if broker_is_redis else ("sqs" if broker_is_sqs else None),
            },
        },
        "infrastructure": {
            "database": {"detected": True, "engine": "postgres", "source": requirements_path},
            "cache": {"detected": cache_detected, "engine": "redis" if cache_detected else None,
                      "source": requirements_path if cache_detected else None},
            "storage": {"detected": storage_detected, "type": "s3" if storage_detected else None,
                        "source": "settings" if storage_detected else None},
            "queue": {"detected": broker_is_sqs, "type": "sqs" if broker_is_sqs else None,
                      "source": "celery_detected" if broker_is_sqs else None},
        },
        "existing_iac": {"found": False, "type": None, "path": None},
    }

    return {
        "status": "complete",
        "block_reason": None,
        "block_message": None,
        "detected_resources": detected_resources,
        "env_vars": _extract_env_vars(settings_files),
        "confidence": "high",
    }
