from core.models import EnvVarKey, Project, ScanResult
from app import agentcore
from app.github_utils import get_installation_access_token
from . import compliance, deterministic_detector


def _run_scan_agent(token: str, project: Project) -> dict:
    """Scan the project's repo via the deployed RepoRecon runtime and return the
    parsed detection JSON. Requires ``REPORECON_RUNTIME_ARN`` — there is no
    in-process fallback; a clear error is raised+logged if it isn't set."""
    arn = agentcore.require_runtime_arn("REPORECON_RUNTIME_ARN")
    return agentcore.invoke_runtime(
        arn,
        {
            "installation_token": token,
            "repo_full_name": project.repo_full_name,
            "branch": project.repo_branch,
        },
        str(project.id),
    )


def _scan_repo(token: str, project: Project) -> dict:
    """Deterministic manifest-based detection first (cheap, no AgentCore cold
    start); the LLM agent only runs when that can't confidently classify the
    repo. Mirrors the guardrail pattern already used at Step 3/Step 4-5."""
    det = deterministic_detector.detect(token, project.repo_full_name, project.repo_branch)
    if det and det.get("confidence") == "high":
        det.pop("confidence", None)
        return det
    return _run_scan_agent(token, project)


def run_scan_for_project(project: Project) -> ScanResult:
    scan = ScanResult.objects.create(
        project=project,
        status=ScanResult.Status.RUNNING,
    )

    try:
        token = get_installation_access_token(project.github_installation.installation_id)
        result = _scan_repo(token, project)

        agent_status = result.get("status", "complete")

        if agent_status == "hard_block":
            scan.status = ScanResult.Status.BLOCKED
            scan.block_reason = result.get("block_message") or result.get("block_reason")
            scan.save(update_fields=["status", "block_reason"])
            project.status = Project.Status.FAILED
            project.save(update_fields=["status", "updated_at"])
            return scan

        if agent_status == "soft_block":
            scan.status = ScanResult.Status.BLOCKED
            scan.block_reason = result.get("block_message") or result.get("block_reason")
            scan.detected_resources = result.get("detected_resources")
            scan.env_vars = result.get("env_vars")
            scan.save(update_fields=["status", "block_reason", "detected_resources", "env_vars"])
            return scan

        scan.status = ScanResult.Status.COMPLETE
        scan.detected_resources = result.get("detected_resources")
        scan.env_vars = result.get("env_vars")
        scan.draft_canvas_yaml = result.get("draft_canvas_yaml")

        # Deterministic, static "Cloud Compliance" checks — separate from the
        # RepoRecon agent's own detection above. A failure here (e.g. a bad
        # GitHub API call) must not take down a scan that otherwise succeeded,
        # so it's best-effort and never raises past this point.
        try:
            scan.compliance_findings = compliance.run_compliance_checks(
                token, project.repo_full_name, project.repo_branch,
                scan.detected_resources, scan.env_vars or [],
            )
        except Exception:
            scan.compliance_findings = None

        scan.save(update_fields=[
            "status", "detected_resources", "env_vars", "draft_canvas_yaml", "compliance_findings",
        ])

        _save_env_var_keys(project, scan, result.get("env_vars") or [])

        is_monorepo = (result.get("detected_resources") or {}).get("repository", {}).get("is_monorepo")
        project.is_monorepo = is_monorepo
        project.status = Project.Status.SCAN_COMPLETE
        project.save(update_fields=["status", "is_monorepo", "updated_at"])

    except Exception as exc:
        scan.status = ScanResult.Status.FAILED
        scan.block_reason = str(exc)
        scan.save(update_fields=["status", "block_reason"])
        project.status = Project.Status.FAILED
        project.save(update_fields=["status", "updated_at"])

    return scan


def _save_env_var_keys(project: Project, scan: ScanResult, env_vars: list) -> None:
    for var in env_vars:
        key_name = var.get("key")
        if not key_name:
            continue
        classification = var.get("classification", EnvVarKey.Classification.USER_SECRET)
        EnvVarKey.objects.update_or_create(
            project=project,
            key_name=key_name,
            defaults={
                "scan_result": scan,
                "classification": classification,
                "source_file": var.get("source"),
                "context_block": var.get("context"),
                "production_default": var.get("production_default"),
                "is_active": True,
            },
        )
