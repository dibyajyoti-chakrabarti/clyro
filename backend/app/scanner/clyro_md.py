"""Ingestion of ``CLYRO.md`` — the contract an offline coding agent writes into
the user's repo in place of Clyro's own Step 1 scan.

The user runs the ``/clyro-scan`` skill (``backend/skills/clyro-scan/SKILL.md``) locally
with Claude Code / Cursor / Aider; it reads their real checkout, applies
compliance fixes, and commits a ``CLYRO.md`` at the repo root. This module reads
that file back and turns it into the detection shape the rest of the pipeline
already speaks, so ``canvas_core.canvas_builder``, ``provisioning.iac`` and
``provisioning.build_spec`` need no changes.

Two properties drive the design:

**Forgiving parse, strict validate.** CLYRO.md is documented as hand-editable and
is reviewed in PRs, so users *will* reorder sections, rename headings, and edit
prose. Parsing therefore ignores document structure entirely: every ```yaml fence
in the file is loaded and its recognized top-level keys are merged. What we
refuse to be loose about is the *content* — ``validate()`` rejects unknown enum
values and wrong types with per-key messages, because that error text is the only
feedback a user gets when a non-Claude agent emits a slightly-off schema.

**The file is untrusted input.** It is authored outside our system, by an LLM, in
a repo we don't control. Only the strictly-validated output of ``to_detection()``
is allowed downstream; the raw text is persisted for audit only and must never
reach an agent prompt (see ch_20 §4).
"""

from __future__ import annotations

import datetime
import re
from typing import Any

import yaml

CONTRACT_PATH = "CLYRO.md"
SCHEMA_VERSION = 1


def _jsonable(value: Any) -> Any:
    """Coerce YAML-native scalars that JSON can't represent into strings.

    An unquoted ``generated_at: 2026-08-01`` (or a full timestamp) is valid YAML
    and loads as a ``datetime.date``/``datetime`` — but the parsed contract is
    later stored/serialized as JSON, where those types raise "Object of type
    date is not JSON serializable" and 500 the whole scan. The contract is
    hand-editable, so we can't rely on the author quoting every date; normalize
    defensively to ISO strings instead of rejecting the block.
    """
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return value.isoformat()
    return value

# Recognized top-level keys across every yaml block in the document. Anything
# else a user adds is ignored rather than rejected — the contract is meant to be
# extensible without breaking v1 ingestion.
_DETECTION_KEYS = ("repository", "services", "infrastructure", "existing_iac")
_TOP_LEVEL_KEYS = _DETECTION_KEYS + (
    "env_vars", "compliance_findings", "status", "block_reason", "block_message",
    "agent", "generated_at", "commit_sha", "scan_mode", "confidence", "schema_version",
)

_YAML_FENCE = re.compile(r"^[ \t]*```[ \t]*ya?ml[ \t]*\n(.*?)^[ \t]*```", re.MULTILINE | re.DOTALL)
_HTML_COMMENT = re.compile(r"<!--\s*(?P<key>[A-Za-z ]+?)\s*:\s*(?P<value>[^>]*?)\s*-->")

_CLASSIFICATIONS = {"generated", "optional", "user_secret"}
_HINTS = {"agent_generatable", "third_party"}
_SEVERITIES = {"blocker", "warning", "info"}
_STATUSES = {"complete", "hard_block", "soft_block"}
_BLOCK_REASONS = {
    "missing_requirements", "unsupported_framework", "unsupported_database",
    "ambiguous_database", "no_database_found",
}
_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")

# Paths whose contents feed detection. Used by the staleness check: CLYRO.md's
# own commit always moves the branch head past the sha recorded inside it, so a
# bare sha mismatch means nothing — only a change to one of these does.
_DETECTION_RELEVANT = (
    "requirements.txt", "package.json", "Dockerfile", "urls.py", "/migrations/",
)


class ContractError(Exception):
    """Raised when CLYRO.md exists but cannot be used. ``errors`` is the list of
    per-field messages shown to the user in Step 1."""

    def __init__(self, reason: str, errors: list[str]):
        self.reason = reason
        self.errors = errors
        super().__init__(f"{reason}: {'; '.join(errors)}")


def fetch(token: str, repo_full_name: str, branch: str, github_utils=None) -> str | None:
    """Raw CLYRO.md text from the repo root, or None if the branch has no such
    file. A missing contract isn't an error — Step 1 shows setup instructions."""
    from app import github_utils as _default_github_utils

    gh = github_utils or _default_github_utils
    return gh.get_file_content(token, repo_full_name, CONTRACT_PATH, branch)


def parse(text: str) -> dict[str, Any]:
    """Merge every yaml fence in the document into one dict, plus the metadata
    carried in the leading HTML comments.

    Deliberately structure-blind: keys are collected by name, not by which
    heading they appeared under, so the document stays safely hand-editable. A
    fence that isn't valid YAML is skipped rather than fatal — a user breaking
    the prose example in one section shouldn't stop us reading the real blocks —
    but if *nothing* parsed, that's a contract error.
    """
    merged: dict[str, Any] = {}
    blocks_seen = 0

    for match in _YAML_FENCE.finditer(text or ""):
        try:
            loaded = yaml.safe_load(match.group(1))
        except yaml.YAMLError:
            continue
        if not isinstance(loaded, dict):
            continue
        loaded = _jsonable(loaded)
        blocks_seen += 1
        for key, value in loaded.items():
            if key in _TOP_LEVEL_KEYS and key not in merged:
                merged[key] = value

    if not blocks_seen:
        raise ContractError(
            "clyro_md_invalid",
            ["No machine-readable ```yaml block found in CLYRO.md. Regenerate it with /clyro-scan."],
        )

    # HTML comments are the human-facing mirror of the metadata block. They only
    # fill gaps — the yaml block wins where both are present.
    for match in _HTML_COMMENT.finditer(text or ""):
        key = match.group("key").strip().lower().replace(" ", "_")
        value = match.group("value").strip()
        if key == "generated":
            merged.setdefault("generated_at", value)
        elif key == "schema_version":
            merged.setdefault("schema_version", value)
        elif key in ("confidence", "status"):
            merged.setdefault(key, value)

    return merged


def validate(parsed: dict[str, Any]) -> list[str]:
    """Every problem with the contract, as user-facing messages. Empty = usable.

    Returns all errors rather than raising on the first, so a user regenerating a
    hand-edited file fixes everything in one pass.
    """
    errors: list[str] = []

    version = parsed.get("schema_version")
    if version is not None:
        try:
            if int(version) != SCHEMA_VERSION:
                errors.append(
                    f"schema_version is {version}, but this Clyro version ingests "
                    f"schema {SCHEMA_VERSION}. Regenerate CLYRO.md with the current skill."
                )
        except (TypeError, ValueError):
            errors.append(f"schema_version must be an integer, got {version!r}.")

    status = (parsed.get("status") or "complete")
    if status not in _STATUSES:
        errors.append(f"status must be one of {sorted(_STATUSES)}, got {status!r}.")

    reason = parsed.get("block_reason")
    if reason and reason not in _BLOCK_REASONS:
        errors.append(f"block_reason must be one of {sorted(_BLOCK_REASONS)}, got {reason!r}.")

    # A blocked contract carries no resources by design, so there is nothing
    # further to check — the block message is what Step 1 shows.
    if status != "complete":
        if not parsed.get("block_message"):
            errors.append(f"status is {status!r} but block_message is empty, so there is nothing to show the user.")
        return errors

    errors.extend(_validate_services(parsed))
    errors.extend(_validate_infrastructure(parsed))
    errors.extend(_validate_env_vars(parsed))
    errors.extend(_validate_findings(parsed))
    return errors


def _validate_services(parsed: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    services = parsed.get("services")
    if not isinstance(services, dict):
        return ["services block is missing or not a mapping."]

    backend = services.get("backend")
    if not isinstance(backend, dict):
        return ["services.backend is missing. Clyro requires a Django backend."]
    if not backend.get("detected"):
        errors.append("services.backend.detected is false. Clyro requires a Django backend.")
    framework = (backend.get("framework") or "").lower()
    if framework and framework != "django":
        errors.append(f"services.backend.framework must be 'django', got {framework!r}.")
    if not backend.get("path"):
        errors.append("services.backend.path is empty. Use '.' for a root-level backend.")

    frontend = services.get("frontend")
    if isinstance(frontend, dict) and frontend.get("detected"):
        fe_framework = (frontend.get("framework") or "").lower()
        if fe_framework != "react":
            errors.append(f"services.frontend.framework must be 'react', got {fe_framework!r}.")
        if not frontend.get("path"):
            errors.append("services.frontend.detected is true but path is empty.")

    worker = services.get("worker")
    if isinstance(worker, dict) and worker.get("detected"):
        broker = worker.get("broker")
        if broker not in ("redis", "sqs"):
            errors.append(
                f"services.worker.broker must be 'redis' or 'sqs' when a worker is detected, got {broker!r}."
            )
    return errors


def _validate_infrastructure(parsed: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    infra = parsed.get("infrastructure")
    if not isinstance(infra, dict):
        return ["infrastructure block is missing or not a mapping."]

    database = infra.get("database")
    if not isinstance(database, dict) or not database.get("detected"):
        errors.append("infrastructure.database.detected is false. Clyro requires PostgreSQL.")
    elif (database.get("engine") or "").lower() != "postgres":
        errors.append(
            f"infrastructure.database.engine must be 'postgres', got {database.get('engine')!r}."
        )

    cache = infra.get("cache")
    if isinstance(cache, dict) and cache.get("detected") and (cache.get("engine") or "").lower() != "redis":
        errors.append(f"infrastructure.cache.engine must be 'redis', got {cache.get('engine')!r}.")

    storage = infra.get("storage")
    if isinstance(storage, dict) and storage.get("detected") and (storage.get("type") or "").lower() != "s3":
        errors.append(f"infrastructure.storage.type must be 's3', got {storage.get('type')!r}.")
    return errors


def _validate_env_vars(parsed: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    env_vars = parsed.get("env_vars")
    if env_vars is None:
        return ["env_vars block is missing."]
    if not isinstance(env_vars, list):
        return ["env_vars must be a list."]

    seen: set[str] = set()
    for index, var in enumerate(env_vars):
        label = f"env_vars[{index}]"
        if not isinstance(var, dict):
            errors.append(f"{label} is not a mapping.")
            continue

        key = var.get("key")
        if not key or not isinstance(key, str):
            errors.append(f"{label} has no key.")
            continue
        label = f"env_vars.{key}"
        if not _KEY_RE.match(key):
            errors.append(f"{label} is not a valid environment variable name.")
        if key in seen:
            errors.append(f"{label} is listed more than once.")
        seen.add(key)

        classification = var.get("classification")
        if classification not in _CLASSIFICATIONS:
            errors.append(
                f"{label}.classification must be one of {sorted(_CLASSIFICATIONS)}, got {classification!r}."
            )

        hint = var.get("hint")
        if hint is not None and hint not in _HINTS:
            errors.append(f"{label}.hint must be one of {sorted(_HINTS)}, got {hint!r}.")

        acquire_url = var.get("acquire_url")
        if acquire_url and not str(acquire_url).startswith(("http://", "https://")):
            errors.append(f"{label}.acquire_url must be an http(s) URL, got {acquire_url!r}.")

        # The contract carries key names, not values. A populated `value` means
        # a secret is sitting in a committed, PR-reviewed file.
        if var.get("value") not in (None, ""):
            errors.append(
                f"{label} contains a 'value'. CLYRO.md must never hold secret values. "
                "Remove it (and rotate the secret if it was pushed)."
            )
    return errors


def _validate_findings(parsed: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    findings = parsed.get("compliance_findings")
    if findings is None:
        return []
    if not isinstance(findings, list):
        return ["compliance_findings must be a list."]

    for index, finding in enumerate(findings):
        label = f"compliance_findings[{index}]"
        if not isinstance(finding, dict):
            errors.append(f"{label} is not a mapping.")
            continue
        if not finding.get("id"):
            errors.append(f"{label} has no id.")
        if not isinstance(finding.get("passed"), bool):
            errors.append(f"{label}.passed must be true or false.")
        severity = finding.get("severity")
        if severity not in _SEVERITIES:
            errors.append(f"{label}.severity must be one of {sorted(_SEVERITIES)}, got {severity!r}.")
    return errors


def to_detection(parsed: dict[str, Any]) -> dict[str, Any]:
    """The contract in the detection shape the rest of the pipeline consumes —
    identical to what RepoRecon used to return, so nothing downstream changes."""
    status = parsed.get("status") or "complete"

    if status != "complete":
        return {
            "status": status,
            "block_reason": parsed.get("block_reason"),
            "block_message": parsed.get("block_message"),
            "detected_resources": None,
            "env_vars": None,
        }

    return {
        "status": "complete",
        "block_reason": None,
        "block_message": None,
        "detected_resources": {key: parsed.get(key) for key in _DETECTION_KEYS},
        "env_vars": _normalize_env_vars(parsed.get("env_vars") or []),
    }


def _normalize_env_vars(env_vars: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop unknown fields and coerce to exactly the keys ``_save_env_var_keys``
    persists. Validation has already run, so this only shapes the data."""
    from .classify import effective_classification

    normalized = []
    for var in env_vars:
        key = var.get("key")
        context = var.get("context")
        declared = var.get("classification")
        normalized.append({
            "key": key,
            "source": var.get("source"),
            "context": context,
            "classification": effective_classification(key, context, declared),
            "production_default": var.get("production_default"),
            "hint": var.get("hint"),
            "acquire_url": var.get("acquire_url"),
        })
    return normalized


def metadata(parsed: dict[str, Any]) -> dict[str, Any]:
    """Provenance shown in the Step 1 results header and used for the staleness
    check."""
    return {
        "agent": parsed.get("agent"),
        "generated_at": parsed.get("generated_at"),
        "commit_sha": parsed.get("commit_sha"),
        "scan_mode": parsed.get("scan_mode"),
        "confidence": parsed.get("confidence"),
        "schema_version": parsed.get("schema_version"),
    }


def is_detection_relevant(path: str) -> bool:
    """Whether a changed file could invalidate the contract's detection.

    Used to decide staleness: the skill commits CLYRO.md itself, so the branch
    head is normally one commit ahead of the ``commit_sha`` inside the file. That
    offset is expected and must not be reported as drift — only a change to
    something detection actually reads is.
    """
    path = path or ""
    name = path.rsplit("/", 1)[-1]
    if name in ("requirements.txt", "package.json", "Dockerfile", "urls.py"):
        return True
    if "/migrations/" in path or path.startswith("migrations/"):
        return True
    # "settings" anywhere in the path, not just the filename — the conventional
    # Django layout puts it in the directory (config/settings/base.py), which a
    # filename-only test would miss entirely.
    return name.endswith(".py") and "settings" in path.lower()
