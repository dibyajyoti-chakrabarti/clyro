"""The build step: gets the customer's actual application code into the
infrastructure `deploy.py`/`iac.py` just provisioned. Mirrors `deploy.py`'s
shape (`start_build`/`poll_build`/`_poll_build_to_terminal`/`build_with_feedback`)
deliberately, so this reads like a natural extension of the existing
provisioning flow rather than a bolted-on side system.

v1 scope, on purpose: this build runs exactly once, triggered the first time
CFN reaches CREATE_COMPLETE (see `deploy.provision_with_feedback`). There is
no webhook for subsequent `git push` events, no rebuild-on-canvas-change, and
no build caching beyond whatever CodeBuild does natively. Retrying a failed
build re-downloads the same ref and re-runs StartBuild — it does not
re-provision infrastructure. Continuous deployment is a separate, later
feature, not part of this.

The GitHub App installation token (minted on demand via `github_utils`, never
persisted — see that module) is used ONLY for the tarball download in
`_download_repo_archive`. It is never passed into the customer's CodeBuild
environment — CodeBuild's build source is a plain S3 object Clyro's backend
uploads itself, refreshed per build via `sourceLocationOverride`, so no GitHub
credential of any kind ever enters a customer-account log stream.
"""

from __future__ import annotations

import io
import logging
import tarfile
import time
import zipfile
from typing import Any

import requests
from botocore.exceptions import ClientError
from django.utils import timezone

from core.models import Deployment, DeploymentStackOutput, Project, ProvisioningLogEntry
from app import github_utils

from . import aws_client, codebuild_spec, iac, runtime_probe
from .deploy import (
    DeployError, _active_deployment, _assume, _serialize_log, run_migrations,
    scale_services_to_spec,
)

log = logging.getLogger(__name__)

_POLL_INTERVAL_SECONDS = 10
# CodeBuild's own build itself typically finishes in 2-5 min for a small image;
# 15 min covers a slow npm/docker layer pull on a cold cache without risking
# run_build_task's own soft_time_limit.
_POLL_TIMEOUT_SECONDS = 900
_TERMINAL_BUILD_STATUSES = ("SUCCEEDED", "FAILED", "FAULT", "STOPPED", "TIMED_OUT")


def _tarball_to_zip(raw: bytes) -> bytes:
    """Two independent problems found live, both in this one conversion:

    1. CodeBuild's `Source: {Type: S3}` only auto-extracts `.zip` — a
       `.tar.gz` (what GitHub's tarball API returns) is copied into the build
       environment as a single opaque file, never extracted at all, so every
       `cd <build_path>` failed with "can't cd" even though the archive's own
       contents were completely correct. Re-package as an actual ZIP.
    2. GitHub's tarball API always wraps repo contents in a single top-level
       `{owner}-{repo}-{sha}/` directory whose exact name isn't knowable in
       advance (it includes the commit SHA) — `build_path` (e.g. `./backend`)
       assumes it's already at the repo root, so that one leading path
       segment is stripped from every member while re-packaging."""
    src = tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz")
    out_buf = io.BytesIO()
    with zipfile.ZipFile(out_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as dst:
        for member in src.getmembers():
            if not member.isfile():
                continue  # zip has no directory entries; they're implied by file paths
            parts = member.name.split("/", 1)
            if len(parts) < 2 or not parts[1]:
                continue  # the wrapper directory entry itself
            extracted = src.extractfile(member)
            if extracted is None:
                continue
            dst.writestr(parts[1], extracted.read())
    return out_buf.getvalue()


def _download_repo_archive(installation_id: int, repo_full_name: str, branch: str) -> bytes:
    token = github_utils.get_installation_access_token(installation_id)
    resp = requests.get(
        f"https://api.github.com/repos/{repo_full_name}/tarball/{branch}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
        timeout=60,
    )
    resp.raise_for_status()
    return _tarball_to_zip(resp.content)


def _next_sequence(deployment: Deployment) -> int:
    return ProvisioningLogEntry.objects.filter(deployment=deployment).count()


def _log_build_status(deployment: Deployment, project_name: str, status: str, message: str) -> None:
    """Append-only, same pattern _persist_new_events already uses for CFN
    events — the frontend's ProvisionLog.jsx already reduces a log to "latest
    status per resource_id" via a Map, so a new row per status change (not an
    update-in-place) is exactly what it expects. resource_type is prefixed
    "build:" so the frontend can distinguish build-phase rows from CFN-phase
    rows without a schema change."""
    ProvisioningLogEntry.objects.create(
        deployment=deployment,
        sequence=_next_sequence(deployment),
        resource_type=f"build:{project_name}",
        resource_id=project_name,
        status=status,
        plain_message=message,
        raw_event=None,
        event_timestamp=timezone.now(),
    )


def start_build(project: Project) -> dict[str, Any]:
    """Download the repo archive, stage it in the customer account, and start
    one CodeBuild run per buildable node (backend+worker share one build;
    frontend gets its own — see codebuild_spec.py). Returns
    ``{deployment, spec, credentials, region, project_names, build_ids}`` for
    `_poll_build_to_terminal` to consume."""
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to build.")
    if not project.github_installation_id or not project.repo_full_name:
        raise DeployError("No connected GitHub repository to build from.")
    # project.github_installation_id is Django's FK shortcut — it resolves to
    # GitHubInstallation's own UUID primary key, NOT the numeric GitHub App
    # installation id the GitHub API actually expects. Found live: passing the
    # UUID straight to get_installation_access_token() 404'd against
    # api.github.com. Traverse the FK to get the real field.
    github_installation_id = project.github_installation.installation_id

    spec = iac._spec_for(deployment)
    project_names = codebuild_spec.buildable_node_ids(spec)
    if not project_names:
        # Nothing to build (e.g. a pure-infra canvas with no service/static
        # node) — treat as an immediate success, nothing to wait on.
        return {"deployment": deployment, "spec": spec, "credentials": None, "region": None,
                "project_names": [], "build_ids": []}

    creds, region = _assume(deployment)
    account_id = aws_client.get_account_id(creds, region)
    iam_scoped_prefix = spec["iam_scoped_prefix"]
    archive_bucket = f"{iam_scoped_prefix}-build-archive-{account_id}"
    archive_key = f"source/{deployment.id}-{int(time.time())}.zip"

    archive_bytes = _download_repo_archive(
        github_installation_id, project.repo_full_name, project.repo_branch,
    )
    aws_client.put_object(creds, region, archive_bucket, archive_key, archive_bytes)

    build_ids: list[str] = []
    for node_id in project_names:
        codebuild_project_name = f"{iam_scoped_prefix}-{node_id}-build"
        build_id = aws_client.start_codebuild(
            creds, region, codebuild_project_name, f"{archive_bucket}/{archive_key}",
        )
        build_ids.append(build_id)
        _log_build_status(deployment, codebuild_project_name, "in_progress", f"Building {node_id}…")

    return {
        "deployment": deployment, "spec": spec, "credentials": creds, "region": region,
        "project_names": project_names, "build_ids": build_ids,
    }


def _poll_build_to_terminal(started: dict[str, Any]) -> dict[str, Any]:
    """Poll every build id from `start_build` to a terminal CodeBuild status.
    Returns ``{status, error}`` — status is BUILD_FAILED if any build failed,
    COMPLETE otherwise (BUILDING/COMPLETE/BUILD_FAILED are Deployment.Status
    values, matching poll()'s own return shape in deploy.py)."""
    build_ids = started["build_ids"]
    if not build_ids:
        return {"status": Deployment.Status.COMPLETE, "error": None}

    deployment = started["deployment"]
    creds, region = started["credentials"], started["region"]
    project_names = started["project_names"]
    iam_scoped_prefix = started["spec"]["iam_scoped_prefix"]
    codebuild_names = [f"{iam_scoped_prefix}-{n}-build" for n in project_names]

    last_status: dict[str, str] = {}
    elapsed = 0
    while elapsed < _POLL_TIMEOUT_SECONDS:
        builds = aws_client.batch_get_builds(creds, region, build_ids)
        by_id = {b["id"]: b for b in builds}
        statuses = []
        for build_id, name in zip(build_ids, codebuild_names):
            build = by_id.get(build_id)
            status = (build or {}).get("buildStatus", "IN_PROGRESS")
            statuses.append(status)
            if last_status.get(build_id) != status:
                last_status[build_id] = status
                phase = "done" if status == "SUCCEEDED" else "failed" if status in _TERMINAL_BUILD_STATUSES else "in_progress"
                _log_build_status(deployment, name, phase, f"{name}: {status.replace('_', ' ').title()}")
        if all(s in _TERMINAL_BUILD_STATUSES for s in statuses):
            if all(s == "SUCCEEDED" for s in statuses):
                return {"status": Deployment.Status.COMPLETE, "error": None}
            failed = [n for n, s in zip(codebuild_names, statuses) if s != "SUCCEEDED"]
            error = f"Build failed for: {', '.join(failed)}."
            # Telling a user to "check the CodeBuild logs" makes them go find in the
            # AWS console what Clyro is already holding the credentials to read.
            diagnosis = runtime_probe.build_root_cause(creds, region, build_ids)
            if diagnosis:
                error += f"\n\n{diagnosis}"
            return {"status": Deployment.Status.BUILD_FAILED, "error": error}
        time.sleep(_POLL_INTERVAL_SECONDS)
        elapsed += _POLL_INTERVAL_SECONDS

    return {
        "status": Deployment.Status.BUILD_FAILED,
        "error": "Build timed out. This took longer than expected.",
    }


def _run_migrations_step(project: Project, deployment: Deployment) -> dict[str, Any]:
    """Run database migrations and log the step to the live feed. Returns
    ``{ok, error}``. A skipped migration (no migrate framework) logs nothing —
    only a real run gets a feed row, so a static-only app's feed stays clean."""
    try:
        outcome = run_migrations(project)
    except Exception as exc:  # noqa: BLE001 — surfaced as a deploy failure, not a crash
        log.exception("run_migrations failed for project %s", project.id)
        _log_build_status(deployment, "database-migrations", "failed",
                          f"Database migrations failed: {exc}")
        return {"ok": False, "error": f"Database migrations failed: {exc}"}

    if not outcome.get("ran"):
        return {"ok": True, "error": None}  # nothing to migrate — no feed noise
    if outcome.get("ok"):
        _log_build_status(deployment, "database-migrations", "done",
                          "Database migrations complete.")
        return {"ok": True, "error": None}
    _log_build_status(deployment, "database-migrations", "failed",
                      outcome.get("error") or "Database migrations failed.")
    return {"ok": False, "error": outcome.get("error")}


def build_with_feedback(project: Project) -> dict[str, Any]:
    """Chain: upload archive → start builds → poll to terminal. On failure,
    sets Deployment.Status.BUILD_FAILED and stops — no iac.refine() call and
    no CFN retry; a broken Dockerfile/build command is not a template-
    correction problem, and the CFN stack (already CREATE_COMPLETE) must be
    left alone, not torn down. On success, sets Deployment.Status.COMPLETE and
    Project.Status.LIVE — this is the point poll()'s CFN-live branch used to
    promote to immediately, before a build step existed."""
    deployment = _active_deployment(project)
    if deployment is None:
        raise DeployError("No active deployment to build.")

    def _outputs() -> list[dict]:
        return [
            {"key": o.output_key, "value": o.output_value, "description": o.description}
            for o in DeploymentStackOutput.objects.filter(deployment=deployment)
        ]

    try:
        started = start_build(project)
        result = _poll_build_to_terminal(started)
    except Exception as exc:  # noqa: BLE001 — surfaced as a build failure, not a task crash
        log.exception("build_with_feedback failed for project %s", project.id)
        deployment.status = Deployment.Status.BUILD_FAILED
        deployment.save(update_fields=["status", "updated_at"])
        return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": _outputs(), "error": str(exc)}

    # The database is empty until something runs the app's migrations — the image's
    # CMD is the server only. Do it now, on the freshly-pushed image, BEFORE scaling
    # up, or the service comes up healthy and 500s every query against a schema that
    # was never created. A migration that runs and fails stops the deploy here rather
    # than shipping a broken app. (No-op when the spec has no migrate step.)
    if result["status"] == Deployment.Status.COMPLETE:
        migrate = _run_migrations_step(project, deployment)
        if not migrate["ok"]:
            result = {"status": Deployment.Status.FAILED, "error": migrate["error"]}

    # The services were authored DesiredCount: 0 so CloudFormation could complete
    # without an image to pull (iac.enforce_ecs_desired_count). Now that the build
    # has pushed one, scale them to the spec's task count — until this runs the stack
    # is live but empty. This lives here, not in provision_with_feedback, because the
    # "Retry build" path (tasks.run_build_task) calls this function directly and would
    # otherwise report COMPLETE while every service still ran zero tasks.
    if result["status"] == Deployment.Status.COMPLETE:
        try:
            scale = scale_services_to_spec(project)
        except Exception as exc:  # noqa: BLE001 — a scale failure is a deploy failure
            log.exception("scale_services_to_spec failed for project %s", project.id)
            scale = {"steady": False, "error": str(exc)}
        if not scale["steady"]:
            result = {"status": Deployment.Status.FAILED, "error": scale["error"]}

    deployment.status = result["status"]
    deployment.completed_at = timezone.now()
    deployment.save(update_fields=["status", "completed_at", "updated_at"])

    if result["status"] == Deployment.Status.COMPLETE:
        project.status = Project.Status.LIVE
    else:
        project.status = Project.Status.FAILED
    project.save(update_fields=["status", "updated_at"])

    return {"status": deployment.status, "log": _serialize_log(deployment), "outputs": _outputs(), "error": result.get("error")}
