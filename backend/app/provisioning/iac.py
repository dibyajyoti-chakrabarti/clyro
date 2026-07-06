"""Step 4 IaC service layer — generate / refine / validate the CloudFormation
template.

The template is *authored* by the deployed IacArchitect runtime (generate +
refine modes) from the deterministic build spec; it is *validated* here with
cfn-lint in-process (no LLM) so the editor always gets one consistent diagnostic
shape and the validate gate is deterministic. The working template is the system
of record on ``Deployment.cloudformation_template``.
"""

from __future__ import annotations

import logging
import re
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

log = logging.getLogger(__name__)

# cfn-lint severity → the level strings the frontend maps to Monaco MarkerSeverity.
_LEVEL = {"error": "error", "warning": "warning", "informational": "info"}


class IacError(Exception):
    """A precondition for IaC generation is missing (no finalized canvas, no
    connected AWS account, etc.). Carries a user-facing message."""


class _EditApplyError(Exception):
    """A search/replace edit block could not be applied cleanly (no match or an
    ambiguous match) — refine falls back to a full-template rewrite."""


def _apply_edits(template: str, edits: list[dict[str, str]]) -> str:
    """Apply the agent's search/replace blocks to the template deterministically.
    Each SEARCH must match EXACTLY ONCE; otherwise we raise and let the caller fall
    back to a full rewrite (a wrong/ambiguous patch is worse than re-authoring)."""
    result = template
    for edit in edits:
        search = edit.get("search", "")
        replace = edit.get("replace", "")
        if not search:
            raise _EditApplyError("empty SEARCH block")
        count = result.count(search)
        if count != 1:
            raise _EditApplyError(
                f"SEARCH block matched {count} times (need exactly 1): {search[:80]!r}"
            )
        result = result.replace(search, replace, 1)
    return result


def _lint_fix_instruction(validation: dict[str, Any]) -> str:
    """A terse instruction listing the cfn-lint ERRORS the current template has, for one
    bounded corrective round. cfn-lint usually names the valid options in the message,
    which is exactly what the agent needs to correct a wrong property name/type."""
    errs = [d for d in validation.get("diagnostics", []) if d.get("level") == "error"][:8]
    listed = "\n".join(f"- L{d.get('line')} {d.get('rule')}: {d.get('message')}" for d in errs)
    return ("The current template has these cfn-lint ERRORS. Fix ONLY these, changing "
            f"nothing else:\n{listed}")


def _lint_fix_loop(template: str, validation: dict[str, Any], *, spec: dict, project: Project,
                   model: str | None, region: str, history: list | None = None,
                   max_rounds: int = 2) -> tuple[str, dict[str, Any], str | None]:
    """Bounded server-side corrective loop: ask the agent (refine mode) to fix the
    cfn-lint ERRORS in ``template``, re-lint, and repeat until the template is clean or
    ``max_rounds`` is hit. This is the real enforcement on top of the agent's own
    in-prompt validation — it does not trust the model to police itself.

    ``max_rounds`` was 3; trimmed to 2 (Phase 4 latency pass) after real X-Ray
    baseline data showed each round costs ~25s and ~41K input tokens on average
    (a full CFN template as context every time) — cfn-lint errors are usually
    single-round fixable (the tool names the valid options directly in its
    message), and the loop's own monotonic stop condition already cuts a
    non-converging model off early regardless of the ceiling.

    The loop is condition-based (stops the moment ``errors == 0``) and strictly
    monotonic: a round is only accepted if it *reduces* the error count, so a model that
    keeps guessing wrong (e.g. hallucinated property names) stops the loop instead of
    spinning. Returns ``(template, validation, message_or_None)``.
    """
    message = None
    rounds = 0
    while validation["errors"] and rounds < max_rounds:
        rounds += 1
        fix_resp = _invoke_iac({
            "mode": "refine", "template": template,
            "instruction": _lint_fix_instruction(validation),
            "build_spec": spec, "history": history or [], "model": model,
        }, project)
        if (fix_resp or {}).get("error"):
            log.warning("lint-fix round %d failed: %s", rounds, fix_resp["error"])
            break
        fixed = None
        fix_edits = (fix_resp or {}).get("edits") or []
        if fix_edits:
            try:
                fixed = _apply_edits(template, fix_edits)
            except _EditApplyError:
                fixed = None
        elif (fix_resp or {}).get("template"):
            fixed = fix_resp["template"]
        if not fixed:
            break  # agent returned nothing usable — stop rather than loop emptily
        fixed_validation = lint_template(fixed, region)
        if fixed_validation["errors"] >= validation["errors"]:
            break  # no improvement (or worse) — keep the prior template, stop looping
        template, validation = fixed, fixed_validation
        message = (fix_resp or {}).get("message") or message
    return template, validation, message


def _security_fix_instruction(blockers: list[dict[str, str]]) -> str:
    listed = "\n".join(f"- {f['message']}" for f in blockers)
    return ("The current template has these deployment-blocking issues. Fix ONLY these, "
            f"changing nothing else:\n{listed}")


def _security_fix_loop(template: str, findings: list[dict[str, str]], *, spec: dict,
                        project: Project, model: str | None, region: str,
                        history: list | None = None, max_rounds: int = 2
                        ) -> tuple[str, list[dict[str, str]], str | None]:
    """Bounded corrective loop for `blocker`-severity findings (currently just
    ``check_ecs_network_reachability``) — the same regression (WorkerService left in a
    private subnet with no NAT path) has now recurred twice despite a strengthened
    authoring rule, so don't just surface it and wait on the user to type a manual fix;
    give the agent one or two bounded rounds to self-correct first, exactly like
    ``_lint_fix_loop`` does for cfn-lint errors. Only `blocker` findings drive this loop —
    `warning`/`critical` findings are left for the user to review, not auto-edited."""
    message = None
    rounds = 0
    blockers = [f for f in findings if f["severity"] == "blocker"]
    while blockers and rounds < max_rounds:
        rounds += 1
        fix_resp = _invoke_iac({
            "mode": "refine", "template": template,
            "instruction": _security_fix_instruction(blockers),
            "build_spec": spec, "history": history or [], "model": model,
        }, project)
        if (fix_resp or {}).get("error"):
            log.warning("security-fix round %d failed: %s", rounds, fix_resp["error"])
            break
        fixed = None
        fix_edits = (fix_resp or {}).get("edits") or []
        if fix_edits:
            try:
                fixed = _apply_edits(template, fix_edits)
            except _EditApplyError:
                fixed = None
        elif (fix_resp or {}).get("template"):
            fixed = fix_resp["template"]
        if not fixed:
            break
        fixed_findings = security_scan(fixed) + check_ecs_network_reachability(fixed, spec) + check_secret_interpolation(fixed, spec)
        fixed_blockers = [f for f in fixed_findings if f["severity"] == "blocker"]
        if len(fixed_blockers) >= len(blockers):
            break  # no improvement — keep the prior template, stop looping
        template, findings, blockers = fixed, fixed_findings, fixed_blockers
        message = (fix_resp or {}).get("message") or message
    return template, findings, message


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
        "aws_account_type": intent.aws_account_type,
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
        from django.utils import timezone
        intent = IntentRecord.objects.create(
            project=project,
            scale=IntentRecord.Scale.SMALL,
            criticality=IntentRecord.Criticality.MEDIUM,
            environment=IntentRecord.Environment.PRODUCTION,
            domain_has=IntentRecord.DomainHas.NO,
            aws_account_type=IntentRecord.AwsAccountType.PAID,
            completed_at=timezone.now(),
        )

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


# ── Deterministic static security scan (independent of cfn-lint/cfn-guard) ─────
#
# cfn-lint only checks schema/property correctness; cfn-guard is only reachable via
# the agent's own MCP tool call mid-generation (it runs in a Lambda pinned to
# Python 3.12 — see mcp/cfn/handler.py — and isn't invoked again once the agent
# returns). Neither deterministically re-checks the specific failure modes below on
# every template this backend persists, regardless of which model authored it or
# whether the agent's own self-correction loop actually ran. This pass is Python-only,
# cheap, and always runs — the audit's category A/B/C/D checks made permanent instead
# of a one-off manual pass.

_PLACEHOLDER_IMAGES = (
    "nginx:latest", "nginx:alpine", "httpd:latest", "hello-world",
    "alpine:latest", "busybox:latest",
)
_IMAGE_RE = re.compile(r"Image:\s*['\"]?([^\s'\"\n]+)")
_EMPTY_CRED_RE = re.compile(r"://[^:@/\s]+:@|://:@")
_WILDCARD_PRINCIPAL_RE = re.compile(
    r"Principal:\s*(?:['\"]?\*['\"]?|\{\s*['\"]?AWS['\"]?:\s*['\"]?\*['\"]?\s*\})"
)
_SENSITIVE_IAM_ACTIONS = ("secretsmanager:", "s3:", "sqs:", "sns:")


_BACKUP_RETENTION_RE = re.compile(r"BackupRetentionPeriod:\s*(\d+)")
_FREE_TIER_MAX_BACKUP_RETENTION = 1

_ECS_SERVICE_BLOCK_RE = re.compile(
    r"^  (\w+):\n    Type: AWS::ECS::Service\b(.*?)(?=^  \w+:\n    Type:|\Z)", re.M | re.S
)

_CACHE_REPL_GROUP_BLOCK_RE = re.compile(
    r"^(  \w+:\n    Type: AWS::ElastiCache::ReplicationGroup\b.*?)(?=^  \w+:\n    Type:|\Z)",
    re.M | re.S,
)
_RETAIN_POLICY_RE = re.compile(r"^(    UpdateReplacePolicy: |    DeletionPolicy: )Retain$", re.M)

_VERIFIED_CF_POLICY_IDS = {
    "658327ea-f89d-4fab-a63d-7e88639e58f6",  # CachingOptimized
    "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",  # CachingDisabled
    "b689b0a8-53d0-40ab-baf2-68738e2966ac",  # AllViewerExceptHostHeader (origin request)
}

# A literal 12-digit account number in an IAM Resource/Principal ARN — scoped to
# these two keys specifically (not any ARN anywhere) so it doesn't fire on a
# pre-existing secret's real ARN used for value resolution ({{resolve:secretsmanager:
# <arn>...}} / ECS Secrets[].ValueFrom), which legitimately must keep its exact literal
# ARN (including the random name suffix AWS assigns) — those aren't Resource/Principal
# grants and can't be reconstructed from pseudo-params anyway. An IAM grant's
# Resource/Principal, by contrast, is always describing "this same deploying
# account" and should use ${AWS::AccountId}/${AWS::Region} instead of a literal.
_HARDCODED_ARN_RE = re.compile(
    r"^\s*(?:-\s*)?(?:Resource|Principal):\s*['\"]?(arn:aws:[a-zA-Z0-9-]+:[a-z0-9-]*:(\d{12}):[^\s'\"\n]*)",
    re.M,
)

# A connection-string credential segment that's a bare `${LogicalId}` Sub/Ref directly
# before '@' — the correct form nests the ref inside a `{{resolve:secretsmanager:...}}`
# dynamic reference, which always has `:SecretString:<key>}}` between the ref and the
# next character, never `@` immediately after `${...}`.
_BROKEN_CRED_REF_RE = re.compile(
    r"(?:postgres(?:ql)?|mysql|redis|mongodb)(?:\+\w+)?://[^:@/\s]*:\$\{\w+\}@"
)

_PLACEHOLDER_TOKEN_RE = re.compile(r"<[^>]*>|PLACEHOLDER|REPLACE_ME|YOUR_IMAGE|TODO|CHANGE_?ME", re.I)
_CF_POLICY_ID_RE = re.compile(
    r"(CachePolicyId|OriginRequestPolicyId):\s*['\"]?([0-9a-f-]{36})['\"]?"
)


def check_ecs_network_reachability(template: str, spec: dict) -> list[dict[str, str]]:
    """Found live: build_spec sets task_placement="public" (and creates no NAT gateway)
    for free-tier deploys, and the authoring rule says every ECS::Service must use
    public subnets + AssignPublicIp ENABLED — but the authoring LLM applied it to only
    the primary service and left a worker service in a private subnet with no NAT, so
    the worker had zero network path to ECR and never started
    (ResourceInitializationError pulling registry auth). cfn-lint/cfn-guard don't check
    this at all (it's schema-valid CFN); this is a coarse per-service regex check that
    catches the specific defect deterministically. Only fires when task_placement is
    "public" (i.e. there is no NAT gateway to fall back on)."""
    if not template:
        return []
    networking = (spec or {}).get("networking") or {}
    if networking.get("task_placement") != "public" or networking.get("nat_gateway"):
        return []  # a NAT gateway (or private-tier deploys, which get one) covers this

    findings = []
    for m in _ECS_SERVICE_BLOCK_RE.finditer(template):
        logical_id, body = m.group(1), m.group(2)
        if "AssignPublicIp: ENABLED" not in body:
            findings.append({
                "severity": "blocker",
                "message": f"ECS Service '{logical_id}' isn't placed in public subnets "
                           "with AssignPublicIp ENABLED, but this deployment has no NAT "
                           "gateway (free-tier) — it has no network path to ECR/"
                           "CloudWatch Logs/Secrets Manager and will never start.",
            })
    return findings


_SECRET_JSON_KEY_RE = re.compile(r"\{\{resolve:secretsmanager:.*?:SecretString:(\w+)\}\}")
# The only secret this pipeline creates as JSON is the RDS/Aurora generated
# master-credentials secret (GenerateSecretString with a {"username", "password"}
# template) — its dynamic reference correctly uses :SecretString:username/password.
_JSON_SECRET_FIELDS = {"username", "password"}


def check_secret_interpolation(template: str, spec: dict) -> list[dict[str, str]]:
    """Found live: `secrets[]` entries are written to Secrets Manager as plain raw
    strings (``write_secret()`` in aws_client.py — a bare ``SecretString=value``, not a
    JSON document), but the agent referenced one as
    ``{{resolve:secretsmanager:<arn>:SecretString:SECRET_KEY}}`` — the trailing
    ``:SecretString:<key>`` segment tells AWS to JSON-parse the secret and extract that
    field, which fails at deploy time ("Could not parse SecretString JSON") on a
    plain-string secret. cfn-lint/cfn-guard can't catch this — it's schema-valid CFN
    that only fails at the actual CreateTaskDefinition/CreateService call. Only the
    RDS-generated master-credentials secret is genuinely JSON (username/password);
    flag any other field name used in this form as a blocker."""
    if not template:
        return []
    findings = []
    for match in _SECRET_JSON_KEY_RE.finditer(template):
        field = match.group(1)
        if field in _JSON_SECRET_FIELDS:
            continue  # the RDS master-credentials secret's genuine JSON fields
        findings.append({
            "severity": "blocker",
            "message": f"A dynamic reference extracts a JSON field '{field}' via "
                       f"`:SecretString:{field}` — but secrets[] entries are stored as "
                       "plain strings, not JSON. This fails at deploy time with 'Could "
                       "not parse SecretString JSON'. Use "
                       "`{{resolve:secretsmanager:<arn>}}` or "
                       "`{{resolve:secretsmanager:<arn>:SecretString}}` instead "
                       "(no JSON-key suffix).",
        })
    return findings


def enforce_free_tier_limits(template: str, spec: dict) -> str:
    """Deterministically correct known free-tier-account limits, rather than trust
    the authoring LLM to apply the corresponding _AUTHORING_RULES instruction every
    time — it doesn't (observed live: a free_tier build spec still came back with
    BackupRetentionPeriod: 7, which some free-tier-enrolled AWS accounts reject at
    deploy time with FreeTierRestrictionError). Only touches the template when
    account_type is free_tier and a value exceeds the safe cap; no-op otherwise."""
    if not template or (spec or {}).get("account_type") != "free_tier":
        return template

    def _cap(match: "re.Match") -> str:
        value = int(match.group(1))
        if value > _FREE_TIER_MAX_BACKUP_RETENTION:
            return f"BackupRetentionPeriod: {_FREE_TIER_MAX_BACKUP_RETENTION}"
        return match.group(0)

    return _BACKUP_RETENTION_RE.sub(_cap, template)


def enforce_elasticache_deletion_policy(template: str) -> str:
    """Found live: an authoring rule previously told the agent to use
    DeletionPolicy/UpdateReplacePolicy: Retain on ElastiCache::ReplicationGroup as a
    data-safety net — but Retain means CloudFormation never deletes the replication
    group, and a retained cluster's ENI keeps its CacheSecurityGroup from being
    released. The very first time any OTHER resource in the same stack failed and CFN
    auto-rolled-back, the rollback got permanently stuck (ROLLBACK_FAILED) trying to
    delete that security group, leaving the cache (and everything downstream of it)
    running and billing with no clean retry path. Deterministically force Snapshot
    instead — same final-snapshot safety net as RDS, but the resource still actually
    deletes. Rewritten by function, not left to the authoring rule alone, because this
    single template-wide setting fully determines whether every future rollback/delete
    can ever complete."""
    if not template:
        return template

    def _fix_block(match: "re.Match") -> str:
        return _RETAIN_POLICY_RE.sub(lambda m: f"{m.group(1)}Snapshot", match.group(1))

    return _CACHE_REPL_GROUP_BLOCK_RE.sub(_fix_block, template)


def security_scan(template: str) -> list[dict[str, str]]:
    """Regex-level scan for the audit checklist's known failure modes. Returns a list
    of ``{severity, message}`` findings (empty if clean). Best-effort on raw YAML/JSON
    text — a coarse net, not a substitute for cfn-lint/cfn-guard, but it catches
    classes of bug those tools don't check at all (placeholder images, empty
    credentials, open resource policies)."""
    findings: list[dict[str, str]] = []
    if not (template or "").strip():
        return findings

    for image in _IMAGE_RE.findall(template):
        lowered = image.lower()
        if any(placeholder in lowered for placeholder in _PLACEHOLDER_IMAGES):
            findings.append({
                "severity": "blocker",
                "message": f"Container image '{image}' looks like a generic placeholder, "
                           "not the project's own ECR image — the stack would deploy "
                           "successfully while never running the real app.",
            })
        elif _PLACEHOLDER_TOKEN_RE.search(image):
            findings.append({
                "severity": "blocker",
                "message": f"Container image '{image}' looks like an unfilled placeholder "
                           "token, not a real image reference — ECS will reject it "
                           "(invalid image reference) or, worse, silently fail to start.",
            })

    if _EMPTY_CRED_RE.search(template):
        findings.append({
            "severity": "critical",
            "message": "Found a connection string with an empty username or password "
                       "(e.g. '://user:@' or '://:@') — a credential failed to interpolate.",
        })

    if _BROKEN_CRED_REF_RE.search(template):
        findings.append({
            "severity": "blocker",
            "message": "A connection string interpolates a bare `${LogicalId}` directly as "
                       "the credential (this resolves to that resource's ARN, not its actual "
                       "value) instead of a `{{resolve:secretsmanager:<arn-or-ref>:"
                       "SecretString:<key>}}` dynamic reference — the app would get the "
                       "literal secret ARN as its password and fail to connect.",
        })

    for match in _HARDCODED_ARN_RE.finditer(template):
        findings.append({
            "severity": "blocker",
            "message": f"An IAM Resource/Principal grant hardcodes a 12-digit AWS account ID "
                       f"('{match.group(1)}') instead of using `${{AWS::AccountId}}`/"
                       "`${AWS::Region}` — this won't resolve correctly if deployed into a "
                       "different account, and silently references whatever account the "
                       "number happens to belong to.",
        })

    for match in _WILDCARD_PRINCIPAL_RE.finditer(template):
        # Only a concern if there's no Condition scoping it — look at the next ~300
        # chars of the same statement for a Condition block.
        window = template[match.end():match.end() + 300]
        if "Condition" not in window:
            findings.append({
                "severity": "critical",
                "message": "A resource policy allows Principal '*' with no Condition "
                           "scoping it (e.g. aws:SourceArn/aws:PrincipalOrgID) — this "
                           "opens the resource to the public internet.",
            })

    for action in _SENSITIVE_IAM_ACTIONS:
        for match in re.finditer(re.escape(action) + r"[A-Za-z*]+", template):
            window = template[match.end():match.end() + 120]
            if "Resource:" in window and re.search(r"Resource:\s*['\"]?\*['\"]?", window):
                findings.append({
                    "severity": "warning",
                    "message": f"IAM action '{match.group(0)}' is granted with "
                               "Resource: \"*\" — should be scoped to the specific ARN "
                               "of the resource this template creates.",
                })

    for prop_name, policy_id in _CF_POLICY_ID_RE.findall(template):
        if policy_id not in _VERIFIED_CF_POLICY_IDS:
            findings.append({
                "severity": "blocker",
                "message": f"CloudFront {prop_name} '{policy_id}' isn't one of the "
                           "verified AWS-managed policy IDs — it's either hallucinated "
                           "or a policy ID that doesn't exist in this account/region, "
                           "and CreateDistribution will fail with 'InvalidRequest: The "
                           "specified origin request policy does not exist.'",
            })

    return findings


# ── Agent-backed generate / refine ─────────────────────────────────────────────

def _invoke_iac(payload: dict, project: Project) -> dict[str, Any]:
    arn = agentcore.require_runtime_arn("IAC_RUNTIME_ARN")
    return agentcore.invoke_runtime(arn, payload, str(project.id))


def generate(project: Project, model: str | None = None) -> dict[str, Any]:
    """Author a fresh template from the build spec, persist it, and return it with
    backend cfn-lint diagnostics. ``model`` is the user-selected generate model key
    (the agent falls back to its default when omitted)."""
    deployment = ensure_deployment(project)
    spec = _spec_for(deployment)
    resp = _invoke_iac({"mode": "generate", "build_spec": spec, "model": model}, project)
    if (resp or {}).get("error"):
        raise IacError((resp or {})["error"])
    template = (resp or {}).get("template", "") or ""
    message = (resp or {}).get("message") or "Generated your CloudFormation template."
    template = enforce_free_tier_limits(template, spec)
    template = enforce_elasticache_deletion_policy(template)

    region = deployment.aws_connection.aws_region or "us-east-1"
    validation = lint_template(template, region)
    # Server-side enforcement: if the agent returned a template with cfn-lint ERRORS
    # despite its own validation rounds, drive them to zero with a bounded fix loop.
    if validation["errors"]:
        template, validation, fix_msg = _lint_fix_loop(
            template, validation, spec=spec, project=project, model=model, region=region)
        if fix_msg:
            message = fix_msg
        template = enforce_free_tier_limits(template, spec)
        template = enforce_elasticache_deletion_policy(template)

    findings = security_scan(template) + check_ecs_network_reachability(template, spec) + check_secret_interpolation(template, spec)
    if any(f["severity"] == "blocker" for f in findings):
        template, findings, fix_msg = _security_fix_loop(
            template, findings, spec=spec, project=project, model=model, region=region)
        if fix_msg:
            message = fix_msg
        template = enforce_free_tier_limits(template, spec)
        template = enforce_elasticache_deletion_policy(template)
        validation = lint_template(template, region)

    deployment.cloudformation_template = template
    deployment.status = Deployment.Status.GENERATING_IAC
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"template": template, "message": message, "validation": validation,
            "status": deployment.status, "security_findings": findings}


def refine(project: Project, instruction: str, history: list | None = None,
           template: str | None = None, model: str | None = None) -> dict[str, Any]:
    """Refine the current template via the agent. The agent decides whether the
    instruction is a *question* (answer it, leave the template untouched) or a
    *change* (edit the template). ``template`` is the live editor content so the
    agent works on what the user sees (manual edits included), not a stale copy.
    ``model`` is the user-selected model key for this turn (the frontend picks the
    chat model, or the stronger model when its toggle is on)."""
    deployment = ensure_deployment(project)
    current = (template if template is not None else deployment.cloudformation_template) or ""
    if not current:
        return generate(project, model=model)

    # Persist the (possibly manually edited) current template before refining.
    if template is not None and template != deployment.cloudformation_template:
        deployment.cloudformation_template = template
        deployment.save(update_fields=["cloudformation_template", "updated_at"])

    spec = _spec_for(deployment)
    resp = _invoke_iac({
        "mode": "refine",
        "template": current,
        "instruction": instruction,
        "build_spec": spec,
        "history": history or [],
        "model": model,
    }, project)
    if (resp or {}).get("error"):
        raise IacError((resp or {})["error"])

    region = deployment.aws_connection.aws_region or "us-east-1"

    # Question → the agent answered without changing the template; leave it as-is.
    if (resp or {}).get("outcome") == "answer":
        message = (resp or {}).get("message") or ""
        validation = lint_template(current, region) if current else None
        return {"outcome": "answer", "message": message, "template": current,
                "validation": validation, "status": deployment.status,
                "security_findings": security_scan(current) + check_ecs_network_reachability(current, spec) + check_secret_interpolation(current, spec)}

    # Edit → the agent returns either search/replace blocks (preferred, cheap) or a
    # full template (escape hatch / old agent). Apply blocks deterministically; on any
    # apply failure, ask the agent once for the full template instead.
    message = (resp or {}).get("message") or "Updated the template."
    edits = (resp or {}).get("edits") or []
    if edits:
        try:
            new_template = _apply_edits(current, edits)
        except _EditApplyError as exc:
            log.info("refine: search/replace didn't apply (%s); requesting full rewrite", exc)
            resp = _invoke_iac({
                "mode": "refine", "template": current, "instruction": instruction,
                "build_spec": spec, "history": history or [],
                "model": model, "prefer_full": True,
            }, project)
            if (resp or {}).get("error"):
                log.warning("refine fallback rewrite failed: %s", resp["error"])
                new_template = current
            else:
                new_template = (resp or {}).get("template", "") or current
                message = (resp or {}).get("message") or message
    else:
        new_template = (resp or {}).get("template", "") or current

    new_template = enforce_free_tier_limits(new_template, spec)
    new_template = enforce_elasticache_deletion_policy(new_template)
    validation = lint_template(new_template, region)

    # Bounded corrective loop if the edit introduced cfn-lint ERRORS (warnings are
    # acceptable). Each round only sticks if it reduces errors; it stops once clean.
    if validation["errors"]:
        new_template, validation, fix_msg = _lint_fix_loop(
            new_template, validation, spec=spec, project=project, model=model,
            region=region, history=history)
        if fix_msg:
            message = fix_msg
        new_template = enforce_elasticache_deletion_policy(new_template)

    findings = security_scan(new_template) + check_ecs_network_reachability(new_template, spec) + check_secret_interpolation(new_template, spec)
    if any(f["severity"] == "blocker" for f in findings):
        new_template, findings, fix_msg = _security_fix_loop(
            new_template, findings, spec=spec, project=project, model=model,
            region=region, history=history)
        if fix_msg:
            message = fix_msg
        new_template = enforce_free_tier_limits(new_template, spec)
        new_template = enforce_elasticache_deletion_policy(new_template)
        validation = lint_template(new_template, region)

    deployment.cloudformation_template = new_template
    deployment.status = Deployment.Status.GENERATING_IAC
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"outcome": "edit", "template": new_template, "message": message,
            "validation": validation, "status": deployment.status,
            "security_findings": findings}


def validate(project: Project, template: str) -> dict[str, Any]:
    """Persist the (possibly manually edited) template and lint it. On a clean
    template the deployment moves to IAC_READY (validated, ready to provision)."""
    deployment = ensure_deployment(project)
    region = deployment.aws_connection.aws_region or "us-east-1"
    validation = lint_template(template, region)
    spec = _spec_for(deployment)
    findings = security_scan(template) + check_ecs_network_reachability(template, spec) + check_secret_interpolation(template, spec)
    has_blocker = any(f["severity"] == "blocker" for f in findings)

    deployment.cloudformation_template = template
    deployment.status = (
        Deployment.Status.IAC_READY if validation["is_valid"] and not has_blocker
        else Deployment.Status.GENERATING_IAC
    )
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"validation": validation, "status": deployment.status, "security_findings": findings}


def get_current(project: Project) -> dict[str, Any]:
    """Return the current template + status + fresh diagnostics for reload."""
    deployment = ensure_deployment(project)
    template = deployment.cloudformation_template or ""
    validation = lint_template(template, deployment.aws_connection.aws_region or "us-east-1") if template else None
    findings = []
    if template:
        findings = security_scan(template) + check_ecs_network_reachability(template, _spec_for(deployment)) + check_secret_interpolation(template, _spec_for(deployment))
    return {"template": template, "status": deployment.status, "validation": validation,
            "security_findings": findings}
