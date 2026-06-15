"""Step 4 IaC service layer — generate / refine / validate the CloudFormation
template.

The template is *authored* by the deployed IacArchitect runtime (generate +
refine modes) from the deterministic build spec; it is *validated* here with
cfn-lint in-process (no LLM) so the editor always gets one consistent diagnostic
shape and the validate gate is deterministic. The working template is the system
of record on ``Deployment.cloudformation_template``.
"""

from __future__ import annotations

from typing import Any

from cfnlint import api as cfnlint_api
from cfnlint.config import ManualArgs

from canvas_core import canvas_ops
from core.models import (
    AWSAccountConnection,
    CanvasVersion,
    Deployment,
    EnvVarKey,
    IntentRecord,
    Project,
)

from app import agentcore

from .build_spec import build_spec

# cfn-lint severity → the level strings the frontend maps to Monaco MarkerSeverity.
_LEVEL = {"error": "error", "warning": "warning", "informational": "info"}


class IacError(Exception):
    """A precondition for IaC generation is missing (no finalized canvas, no
    connected AWS account, etc.). Carries a user-facing message."""


# ── Preconditions + spec assembly ──────────────────────────────────────────────

def _intent_for_spec(intent: IntentRecord | None) -> dict[str, Any]:
    if not intent:
        return {}
    return {
        "scale": intent.scale,
        "criticality": intent.criticality,
        "environment": intent.environment,
        "domain_has": intent.domain_has,
        "domain_name": intent.domain_name,
    }


def _env_vars_for_spec(project: Project) -> list[dict[str, Any]]:
    return [
        {
            "key_name": v.key_name,
            "classification": v.classification,
            "secrets_manager_arn": v.secrets_manager_arn,
            "production_default": v.production_default,
            "context_block": v.context_block,
        }
        for v in EnvVarKey.objects.filter(project=project, is_active=True)
    ]


def ensure_deployment(project: Project) -> Deployment:
    """Get-or-create the in-flight ``Deployment`` for the finalized canvas. Raises
    ``IacError`` when a precondition is missing."""
    canvas_version = (
        CanvasVersion.objects.filter(project=project, status=CanvasVersion.Status.FINALIZED)
        .order_by("-version_number")
        .first()
    )
    if canvas_version is None:
        raise IacError("Finalize your architecture in Step 3 before generating infrastructure.")

    intent = IntentRecord.objects.filter(project=project).order_by("-created_at").first()
    if intent is None:
        raise IacError("This project has no intent record.")

    connection = (
        AWSAccountConnection.objects.filter(project=project, connected_at__isnull=False)
        .order_by("-connected_at")
        .first()
    )
    if connection is None:
        raise IacError("Connect your AWS account before generating infrastructure.")

    deployment = (
        Deployment.objects.filter(project=project, canvas_version=canvas_version)
        .exclude(status__in=[
            Deployment.Status.SUBMITTING,
            Deployment.Status.IN_PROGRESS,
            Deployment.Status.COMPLETE,
        ])
        .order_by("-created_at")
        .first()
    )
    if deployment is None:
        environment = intent.environment or Deployment.Environment.PRODUCTION
        deployment = Deployment.objects.create(
            project=project,
            canvas_version=canvas_version,
            intent_record=intent,
            aws_connection=connection,
            environment=environment,
            status=Deployment.Status.PENDING,
        )
    return deployment


def _spec_for(deployment: Deployment) -> dict[str, Any]:
    canvas = canvas_ops.parse_canvas(deployment.canvas_version.canvas_yaml)
    intent = _intent_for_spec(deployment.intent_record)
    env_vars = _env_vars_for_spec(deployment.project)
    region = deployment.aws_connection.aws_region or "us-east-1"
    return build_spec(canvas, intent, env_vars, region=region)


# ── Validation (deterministic, cfn-lint in-process) ────────────────────────────

def lint_template(template: str, region: str = "us-east-1") -> dict[str, Any]:
    """Run cfn-lint on a template string. Returns a Monaco-friendly shape::

        {"is_valid": bool, "errors": int, "warnings": int,
         "diagnostics": [{level, line, column, end_line, end_column, message, rule}]}
    """
    if not (template or "").strip():
        return {"is_valid": False, "errors": 1, "warnings": 0, "diagnostics": [
            {"level": "error", "line": 1, "column": 1, "end_line": 1, "end_column": 1,
             "message": "Template is empty.", "rule": "E0000"}
        ]}
    try:
        matches = cfnlint_api.lint(template, config=ManualArgs(regions=[region]))
    except Exception as exc:  # cfn-lint normally reports parse errors as matches; guard anyway
        return {"is_valid": False, "errors": 1, "warnings": 0, "diagnostics": [
            {"level": "error", "line": 1, "column": 1, "end_line": 1, "end_column": 1,
             "message": f"Could not parse template: {exc}", "rule": "E0000"}
        ]}

    diagnostics = []
    errors = warnings = 0
    for m in matches:
        level = _LEVEL.get(m.rule.severity, "info")
        if level == "error":
            errors += 1
        elif level == "warning":
            warnings += 1
        diagnostics.append({
            "level": level,
            "line": m.linenumber,
            "column": m.columnnumber,
            "end_line": m.linenumberend,
            "end_column": m.columnnumberend,
            "message": m.message,
            "rule": m.rule.id,
        })
    return {"is_valid": errors == 0, "errors": errors, "warnings": warnings, "diagnostics": diagnostics}


# ── Agent-backed generate / refine ─────────────────────────────────────────────

def _invoke_iac(payload: dict, project: Project) -> dict[str, Any]:
    arn = agentcore.require_runtime_arn("IAC_RUNTIME_ARN")
    return agentcore.invoke_runtime(arn, payload, str(project.id))


def generate(project: Project) -> dict[str, Any]:
    """Author a fresh template from the build spec, persist it, and return it with
    backend cfn-lint diagnostics."""
    deployment = ensure_deployment(project)
    spec = _spec_for(deployment)
    resp = _invoke_iac({"mode": "generate", "build_spec": spec}, project)
    template = (resp or {}).get("template", "") or ""
    message = (resp or {}).get("message") or "Generated your CloudFormation template."

    validation = lint_template(template, deployment.aws_connection.aws_region or "us-east-1")
    deployment.cloudformation_template = template
    deployment.status = Deployment.Status.GENERATING_IAC
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"template": template, "message": message, "validation": validation,
            "status": deployment.status}


def refine(project: Project, instruction: str, history: list | None = None) -> dict[str, Any]:
    """Apply a natural-language edit to the current template via the agent."""
    deployment = ensure_deployment(project)
    current = deployment.cloudformation_template or ""
    if not current:
        return generate(project)

    spec = _spec_for(deployment)
    resp = _invoke_iac({
        "mode": "refine",
        "template": current,
        "instruction": instruction,
        "build_spec": spec,
        "history": history or [],
    }, project)
    template = (resp or {}).get("template", "") or current
    message = (resp or {}).get("message") or "Updated the template."

    validation = lint_template(template, deployment.aws_connection.aws_region or "us-east-1")
    deployment.cloudformation_template = template
    deployment.status = Deployment.Status.GENERATING_IAC
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"template": template, "message": message, "validation": validation,
            "status": deployment.status}


def validate(project: Project, template: str) -> dict[str, Any]:
    """Persist the (possibly manually edited) template and lint it. On a clean
    template the deployment moves to IAC_READY (validated, ready to provision)."""
    deployment = ensure_deployment(project)
    region = deployment.aws_connection.aws_region or "us-east-1"
    validation = lint_template(template, region)

    deployment.cloudformation_template = template
    deployment.status = (
        Deployment.Status.IAC_READY if validation["is_valid"]
        else Deployment.Status.GENERATING_IAC
    )
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"validation": validation, "status": deployment.status}


def get_current(project: Project) -> dict[str, Any]:
    """Return the current template + status + fresh diagnostics for reload."""
    deployment = ensure_deployment(project)
    template = deployment.cloudformation_template or ""
    validation = lint_template(template, deployment.aws_connection.aws_region or "us-east-1") if template else None
    return {"template": template, "status": deployment.status, "validation": validation}
