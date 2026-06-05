import json
import re

from core.models import EnvVarKey, Project, ScanResult
from app.github_utils import get_installation_access_token
from . import agent as scanner_agent


def _extract_json(raw: str) -> dict:
    """Pull the first JSON object out of the agent's response string."""
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise ValueError("Agent returned no JSON object")
    return json.loads(match.group())


def run_scan_for_project(project: Project) -> ScanResult:
    scan = ScanResult.objects.create(
        project=project,
        status=ScanResult.Status.RUNNING,
    )

    try:
        token = get_installation_access_token(project.github_installation.installation_id)
        raw = scanner_agent.run_scan(token, project.repo_full_name, project.repo_branch)
        result = _extract_json(raw)

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
        scan.save(update_fields=["status", "detected_resources", "env_vars", "draft_canvas_yaml"])

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
