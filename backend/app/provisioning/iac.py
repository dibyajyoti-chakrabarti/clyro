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
import string
from typing import Any

from cfnlint import api as cfnlint_api
from cfnlint.config import ManualArgs
from cfnlint.decode import cfn_yaml

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

from . import codebuild_spec
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
        fixed_findings = _collect_findings(fixed, spec)
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

_DB_INSTANCE_BLOCK_RE = re.compile(
    r"^(  \w+:\n    Type: AWS::RDS::DBInstance\b.*?)(?=^  \w+:\n    Type:|\Z)",
    re.M | re.S,
)
_SNAPSHOT_POLICY_RE = re.compile(r"^(    UpdateReplacePolicy: |    DeletionPolicy: )Snapshot$", re.M)

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


_LOG_GROUP_NAME_RE = re.compile(r"(LogGroupName:.*?)\$\{NamingPrefix\}")


def enforce_log_group_naming(template: str) -> str:
    """Deterministically force CloudWatch Log Group names onto iam_scoped_prefix,
    rather than trust the authoring rule alone — found live (jan-saathi account
    test): the agent used naming_prefix for LogGroupName (`/ecs/${NamingPrefix}-
    backend`) despite the explicit rule that Log Groups are one of the four
    resource types required to use iam_scoped_prefix. bootstrap.yaml's IAM policy
    scopes logs:* actions to `*clyro-*` named log groups specifically so it doesn't
    need `Resource: "*"` — a log group named without that prefix has no matching
    grant at all, and CreateLogGroup/DeleteLogGroup (and therefore rollback) fails
    with AccessDenied at deploy time. This is the third naming-rule regression this
    session (after ECS network placement and ElastiCache DeletionPolicy) despite an
    already-correct prompt rule — prompt strength alone isn't enough here either."""
    if not template:
        return template
    return _LOG_GROUP_NAME_RE.sub(lambda m: f"{m.group(1)}${{IamScopedPrefix}}", template)


# AWS's real allowed charset for EC2 SecurityGroup Group/Ingress/Egress
# descriptions (from the live "Invalid rule description" error message):
# a-zA-Z0-9. _-:/()#,@[]+=&;{}!$*  — notably NO apostrophe, em-dash, or other
# "smart" punctuation, which is exactly what English prose (and this codebase's
# own comments) casually uses.
_SG_DESCRIPTION_RE = re.compile(r"^(\s*(?:Group)?Description:\s*)(.*)$", re.M)
_SG_DESC_DISALLOWED_RE = re.compile(r"[^a-zA-Z0-9. _\-:/()#,@\[\]+=&;{}!$*]")


def enforce_sg_description_charset(template: str) -> str:
    """Strip characters AWS's EC2 SecurityGroup Description/GroupDescription
    fields don't allow — found live: "Egress to nowhere (database doesn't need
    outbound)" failed at real deploy time with "Invalid rule description" because
    of the apostrophe in "doesn't". cfn-lint doesn't check this (it's a runtime
    EC2 API validation, not a CFN schema rule), so it only surfaces at the actual
    CreateSecurityGroup/AuthorizeSecurityGroupIngress call. Applies broadly to any
    `Description:`/`GroupDescription:` line (a no-op on ones that are already
    clean, e.g. Output/Parameter descriptions have no such restriction but
    stripping is harmless there too)."""
    if not template:
        return template

    def _clean(match: "re.Match") -> str:
        prefix, value = match.group(1), match.group(2)
        return f"{prefix}{_SG_DESC_DISALLOWED_RE.sub('', value)}"

    return _SG_DESCRIPTION_RE.sub(_clean, template)


# ── Security-group rules, generated from spec["network_edges"] ────────────────
#
# Found live: the template authored the ALB's *egress* to the backend on 8000 but
# omitted the reciprocal *ingress* on the backend's SG, which default-denies inbound
# — so the ALB health check never reached the task, the target stayed
# Target.Timeout, and ECS cycled the service until CFN gave up ~3h later. cfn-lint
# and cfn-guard both pass such a template: it is schema-valid CFN whose only defect
# is a missing edge in the connection graph.
#
# The connection graph is not something the LLM should be re-deriving: build_spec
# already emits it as spec["network_edges"], fully resolved (ports, protocols,
# source/target SGs). So author the rules from the edges instead of trusting the
# LLM to notice each one, the same enforce_* philosophy as the CodeBuild pipeline.
#
# Only *missing* rules are added, as standalone AWS::EC2::SecurityGroup{Ingress,
# Egress} resources. Rules the LLM already authored — inline on the SG or
# standalone — are detected and left alone, so this is idempotent and does not
# duplicate. (AWS advises against mixing inline and standalone rules of the same
# direction on one group; in practice we only ever add a direction the group is
# missing entirely, which is the case that matters.)
_SG_TYPE = "AWS::EC2::SecurityGroup"
_INGRESS_TYPE = "AWS::EC2::SecurityGroupIngress"
_EGRESS_TYPE = "AWS::EC2::SecurityGroupEgress"
_INTERNET_CIDR = "0.0.0.0/0"
_SUB_VAR_RE = re.compile(r"\$\{([^}]+)\}")
_NON_ALNUM_RE = re.compile(r"[^a-zA-Z0-9]")


def _resolve_sub(value: Any, spec: dict) -> str | None:
    """Resolve a GroupName to a literal, expanding the prefix pseudo-parameters the
    agent uses (`!Sub ${NamingPrefix}-alb-sg`). Returns None if it isn't a plain
    string or a resolvable !Sub."""
    if isinstance(value, str):
        raw = value
    elif isinstance(value, dict) and "Fn::Sub" in value:
        raw = value["Fn::Sub"]
        if isinstance(raw, list):
            raw = raw[0] if raw else ""
    else:
        return None
    if not isinstance(raw, str):
        return None
    subs = {
        "NamingPrefix": spec.get("naming_prefix") or "",
        "IamScopedPrefix": spec.get("iam_scoped_prefix") or "",
        "ShortPrefix": spec.get("short_prefix") or "",
    }
    return _SUB_VAR_RE.sub(lambda m: subs.get(m.group(1), m.group(0)), raw)


def _sg_stem(logical_id: str) -> str:
    """`BackendSecurityGroup` -> `backend` (the fallback key when GroupName is absent)."""
    stem = logical_id
    for suffix in ("SecurityGroup", "SecGroup", "Group", "SG", "Sg"):
        if stem.endswith(suffix) and len(stem) > len(suffix):
            stem = stem[: -len(suffix)]
            break
    return _NON_ALNUM_RE.sub("", stem).lower()


def _stem_pascal(logical_id: str) -> str:
    stem = logical_id
    for suffix in ("SecurityGroup", "SecGroup", "Group", "SG", "Sg"):
        if stem.endswith(suffix) and len(stem) > len(suffix):
            stem = stem[: -len(suffix)]
            break
    return _NON_ALNUM_RE.sub("", stem) or logical_id


def _ref_id(value: Any) -> str | None:
    """Logical id referenced by `!Ref X` / `!GetAtt X.GroupId`."""
    if isinstance(value, dict):
        if "Ref" in value:
            ref = value["Ref"]
            return ref if isinstance(ref, str) else None
        att = value.get("Fn::GetAtt")
        if isinstance(att, str):
            return att.split(".")[0]
        if isinstance(att, list) and att:
            return att[0] if isinstance(att[0], str) else None
    return None


def _value_text(value: Any) -> str:
    """Flatten a property value to the text a human would read, so an intrinsic like
    !Sub/!GetAtt can be pattern-matched (e.g. a raw ARN hiding inside a !Sub)."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if "Fn::Sub" in value:
            sub = value["Fn::Sub"]
            if isinstance(sub, list):
                sub = sub[0] if sub else ""
            return sub if isinstance(sub, str) else ""
        att = value.get("Fn::GetAtt")
        if isinstance(att, list):
            return "${%s}" % ".".join(str(a) for a in att)
        if isinstance(att, str):
            return "${%s}" % att
    return ""


def _index_security_groups(resources: dict, spec: dict) -> tuple[dict, dict]:
    by_name: dict[str, str] = {}
    by_stem: dict[str, str] = {}
    for logical_id, res in resources.items():
        if not isinstance(res, dict) or res.get("Type") != _SG_TYPE:
            continue
        props = res.get("Properties") or {}
        name = _resolve_sub(props.get("GroupName"), spec)
        if name:
            by_name.setdefault(name, logical_id)
        by_stem.setdefault(_sg_stem(logical_id), logical_id)
    return by_name, by_stem


def _find_sg(sg_name: str, by_name: dict, by_stem: dict) -> str | None:
    """Map a spec `security_group` name onto the template's LLM-chosen logical id.
    Prefers the authored GroupName; falls back to the logical-id stem.

    The spec names a group after its node (`db-sg`) while the template authors it
    with the stack's naming prefix (`${NamingPrefix}-db-sg` -> `taskboard-prod-db-sg`),
    so an equality test on GroupName never fires and everything silently fell through
    to the stem. Found live: one generation named it `DBSecurityGroup` (stem `db`, a
    match) and the next `DatabaseSecurityGroup` (stem `database`, no match), so the
    ingress rules for the database went unenforced purely on model variance. Match the
    GroupName on its suffix, and only accept an unambiguous hit."""
    if not sg_name:
        return None
    if sg_name in by_name:
        return by_name[sg_name]
    suffixed = [lid for name, lid in by_name.items() if name.endswith(f"-{sg_name}")]
    if len(suffixed) == 1:
        return suffixed[0]
    base = sg_name[:-3] if sg_name.endswith("-sg") else sg_name
    for candidate in (base.replace("-", ""), base.split("-")[-1]):
        if candidate in by_stem:
            return by_stem[candidate]
    return None


def _covers_port(rule: dict, port: int, protocol: str) -> bool:
    proto = str(rule.get("IpProtocol", "")).lower()
    if proto in ("-1", "all"):
        return True
    if proto != (protocol or "tcp").lower():
        return False
    try:
        low, high = int(rule["FromPort"]), int(rule["ToPort"])
    except (KeyError, TypeError, ValueError):
        return False
    return low <= port <= high


def _rule_matches(rule: dict, port: int, protocol: str, peer_key: str,
                  peer_lid: str | None, cidr: str | None) -> bool:
    if not isinstance(rule, dict) or not _covers_port(rule, port, protocol):
        return False
    if peer_lid is not None:
        return _ref_id(rule.get(peer_key)) == peer_lid
    return rule.get("CidrIp") == cidr


def _has_rule(resources: dict, ingress: bool, group_lid: str, port: int, protocol: str,
              peer_lid: str | None = None, cidr: str | None = None) -> bool:
    inline_key = "SecurityGroupIngress" if ingress else "SecurityGroupEgress"
    peer_key = "SourceSecurityGroupId" if ingress else "DestinationSecurityGroupId"
    standalone_type = _INGRESS_TYPE if ingress else _EGRESS_TYPE

    props = (resources.get(group_lid) or {}).get("Properties") or {}
    for rule in props.get(inline_key) or []:
        if _rule_matches(rule, port, protocol, peer_key, peer_lid, cidr):
            return True
    for res in resources.values():
        if not isinstance(res, dict) or res.get("Type") != standalone_type:
            continue
        rule = res.get("Properties") or {}
        if _ref_id(rule.get("GroupId")) != group_lid:
            continue
        if _rule_matches(rule, port, protocol, peer_key, peer_lid, cidr):
            return True
    return False


def _rule_block(logical_id: str, ingress: bool, group_lid: str, port: int, protocol: str,
                peer_lid: str | None, cidr: str | None, description: str) -> str:
    peer_key = "SourceSecurityGroupId" if ingress else "DestinationSecurityGroupId"
    peer = (f"      {peer_key}: !Ref {peer_lid}\n" if peer_lid
            else f"      CidrIp: {cidr}\n")
    return (
        f"  {logical_id}:\n"
        f"    Type: {_INGRESS_TYPE if ingress else _EGRESS_TYPE}\n"
        f"    Properties:\n"
        f"      GroupId: !Ref {group_lid}\n"
        f"{peer}"
        f"      IpProtocol: {protocol}\n"
        f"      FromPort: {port}\n"
        f"      ToPort: {port}\n"
        f"      Description: {description}\n"
    )


def enforce_security_group_rules(template: str, spec: dict) -> str:
    """Add any security-group rule declared by spec["network_edges"] that the
    template doesn't already have. See the block comment above for why."""
    if not template or "Resources:" not in template:
        return template
    edges = (spec or {}).get("network_edges") or []
    if not edges:
        return template
    try:
        doc = cfn_yaml.loads(template)
    except Exception as exc:  # unparseable YAML — cfn-lint reports it far better
        log.warning("enforce_security_group_rules: could not parse template (%s)", exc)
        return template
    resources = (doc or {}).get("Resources")
    if not isinstance(resources, dict):
        return template

    by_name, by_stem = _index_security_groups(resources, spec)
    taken = set(resources)
    blocks: list[str] = []

    def _ensure(ingress: bool, group_lid: str, port: int, protocol: str,
                peer_lid: str | None, cidr: str | None, description: str) -> None:
        if not group_lid or not port:
            return
        if _has_rule(resources, ingress, group_lid, port, protocol, peer_lid, cidr):
            return
        peer_token = _stem_pascal(peer_lid) if peer_lid else "Internet"
        direction = "Ingress" if ingress else "Egress"
        logical_id = f"Clyro{_stem_pascal(group_lid)}{direction}{peer_token}{port}"
        if logical_id in taken:
            return
        taken.add(logical_id)
        blocks.append(_rule_block(logical_id, ingress, group_lid, port, protocol,
                                  peer_lid, cidr, description))

    for edge in edges:
        kind = edge.get("kind")
        if kind == "sg_ingress":
            source = _find_sg(edge.get("from_sg"), by_name, by_stem)
            target = _find_sg(edge.get("to_sg"), by_name, by_stem)
            port, protocol = edge.get("port"), edge.get("protocol") or "tcp"
            if not source or not target:
                log.warning("enforce_security_group_rules: unresolved SG for edge %s",
                            edge.get("description"))
                continue
            _ensure(True, target, port, protocol, source, None,
                    f"Clyro enforced {_stem_pascal(source)} to "
                    f"{_stem_pascal(target)} on port {port}")
        elif kind == "alb":
            alb = _find_sg(edge.get("alb_sg"), by_name, by_stem)
            target = _find_sg(edge.get("target_sg"), by_name, by_stem)
            listener_port, target_port = edge.get("listener_port"), edge.get("target_port")
            if not alb or not target:
                log.warning("enforce_security_group_rules: unresolved SG for edge %s",
                            edge.get("description"))
                continue
            # Internet reaches the listener; an HTTPS listener that redirects HTTP
            # also has to accept :80 for the redirect to be reachable at all.
            _ensure(True, alb, listener_port, "tcp", None, _INTERNET_CIDR,
                    f"Clyro enforced internet to ALB on port {listener_port}")
            if edge.get("redirect_http") and listener_port != 80:
                _ensure(True, alb, 80, "tcp", None, _INTERNET_CIDR,
                        "Clyro enforced internet to ALB on port 80 for HTTPS redirect")
            _ensure(False, alb, target_port, "tcp", target, None,
                    f"Clyro enforced ALB to {_stem_pascal(target)} on port {target_port}")
            # The rule the LLM omitted: the target's SG default-denies inbound, so the
            # ALB's egress alone gets the health check nowhere.
            _ensure(True, target, target_port, "tcp", alb, None,
                    f"Clyro enforced ALB to {_stem_pascal(target)} on port {target_port}")

    if not blocks:
        return template

    fragment = "".join(blocks)
    out_match = _OUTPUTS_SECTION_RE.search(template)
    if out_match:
        insert_at = out_match.start()
        return template[:insert_at] + fragment + "\n" + template[insert_at:]
    return template.rstrip("\n") + "\n" + fragment


# ── Generated env values, derived from the provisioned resources ──────────────
#
# Found live: CELERY_BROKER_URL was authored as `!Sub ${TaskQueue.Arn}` — an SQS ARN
# is never a valid broker URL, so kombu fell through to pyamqp and the worker
# crash-looped on `UnicodeError: encoding with 'idna' codec failed`. spec's
# `generated_env` ships only `{key_name, hint}` with no value, so the LLM invents one
# and nothing checks that it is semantically usable.
#
# These values are fully determined by the resources the template provisions, so
# derive them here rather than hope. Note this also reads each resource's *configuration*,
# not just its endpoint: a transit-encrypted ElastiCache group is TLS-only, so
# `redis://` cannot connect to it and the scheme must be `rediss://`. That defect was
# latent in every template we generated — it never surfaced because the backend never
# got past the ALB health check to open a cache connection.
_BROKER_KEY_RE = re.compile(r"BROKER", re.I)
_REDIS_SCHEME_RE = re.compile(r"\bredis://")
_ENV_VALUE_RE_TMPL = r"^(?P<ind>[ ]*)- Name: {key}\n(?P=ind)[ ]{{2}}Value: (?P<val>.*)$"


def _cache_endpoint(resources: dict) -> dict | None:
    """Locate the Redis node and how to address it. `Port` defaults to 6379; the
    GetAtt attribute differs between a ReplicationGroup and a single CacheCluster."""
    for logical_id, res in resources.items():
        if not isinstance(res, dict):
            continue
        props = res.get("Properties") or {}
        if res.get("Type") == "AWS::ElastiCache::ReplicationGroup":
            attr = ("ConfigurationEndPoint.Address"
                    if props.get("ClusterMode") == "enabled" or props.get("NumNodeGroups")
                    else "PrimaryEndPoint.Address")
        elif res.get("Type") == "AWS::ElastiCache::CacheCluster":
            attr = "RedisEndpoint.Address"
        else:
            continue
        return {
            "logical_id": logical_id,
            "attr": attr,
            "tls": bool(props.get("TransitEncryptionEnabled")),
            "port": props.get("Port") or 6379,
        }
    return None


def _redis_url(cache: dict, *, for_kombu: bool) -> str:
    scheme = "rediss" if cache["tls"] else "redis"
    url = f"{scheme}://${{{cache['logical_id']}.{cache['attr']}}}:{cache['port']}/0"
    # kombu defaults a rediss:// connection to CERT_NONE (encrypted but unverified);
    # ask for real verification. redis-py (django-redis) already defaults to required.
    if cache["tls"] and for_kombu:
        url += "?ssl_cert_reqs=required"
    return f"!Sub '{url}'"


def _yaml_scalar(value: str) -> str:
    """Quote a literal env value for YAML. Not cosmetic: an unquoted `*` is an alias
    indicator and makes the template unparseable."""
    return "'" + str(value).replace("'", "''") + "'"


def _replace_env_value(template: str, key: str, new_value: str) -> str:
    """Rewrite the `Value:` line of every `- Name: <key>` container env entry.
    Anchored on the key name, so CloudWatch alarm `Dimensions` (which are also
    Name/Value pairs) are never touched — no generated_env key collides with one."""
    pattern = re.compile(_ENV_VALUE_RE_TMPL.format(key=re.escape(key)), re.M)

    def _sub(match: "re.Match") -> str:
        if match.group("val").strip() == new_value:
            return match.group(0)
        return f"{match.group('ind')}- Name: {key}\n{match.group('ind')}  Value: {new_value}"

    return pattern.sub(_sub, template)


def enforce_env_values(template: str, spec: dict) -> str:
    """Render the generated_env values the spec fully determines. Idempotent: the
    desired value is a pure function of the template's own resources."""
    generated = (spec or {}).get("generated_env") or []
    if not template or not generated:
        return template
    try:
        doc = cfn_yaml.loads(template)
    except Exception as exc:
        log.warning("enforce_env_values: could not parse template (%s)", exc)
        return template
    resources = (doc or {}).get("Resources")
    if not isinstance(resources, dict):
        return template

    cache = _cache_endpoint(resources)
    broker = (spec or {}).get("broker") or {}

    for entry in generated:
        key = entry.get("key_name") or ""
        if not key:
            continue
        literal = entry.get("value")
        if literal is not None:
            # build_spec already knows the exact production value — no resource to
            # resolve against, so nothing here to derive.
            template = _replace_env_value(template, key, _yaml_scalar(literal))
        elif _BROKER_KEY_RE.search(key):
            if broker.get("transport") == "redis" and cache:
                template = _replace_env_value(template, key, _redis_url(cache, for_kombu=True))
            elif broker.get("transport") == "sqs":
                # kombu's IAM-auth SQS transport form. The queue it actually binds to
                # comes from the app's Celery config, not from this URL — see
                # build_spec._broker_for and the spec-conformance check.
                template = _replace_env_value(template, key, "sqs://")
        elif cache and cache["tls"]:
            # A plaintext redis:// URL cannot connect to a transit-encrypted group.
            pattern = re.compile(_ENV_VALUE_RE_TMPL.format(key=re.escape(key)), re.M)
            match = pattern.search(template)
            if match and _REDIS_SCHEME_RE.search(match.group("val")):
                fixed = _REDIS_SCHEME_RE.sub("rediss://", match.group("val"))
                template = _replace_env_value(template, key, fixed)

    return template


# ── Cold-start: author ECS services stopped, scale them up after the build ────
#
# Found live: a first deploy can never reach CREATE_COMPLETE. The services are
# authored DesiredCount: 1 against an ECR repository that stays empty until the
# CodeBuild step runs — and that step only runs *after* CFN reports CREATE_COMPLETE.
# So ECS retries CannotPullContainerError, the service never stabilizes, CFN waits
# ~3h and times out, and the build is never triggered. A deadlock, every cold start.
#
# Breaking it deterministically: author every service at DesiredCount: 0. A service
# with no desired tasks stabilizes instantly, so CFN completes, the build pushes a
# real image, and deploy.scale_services_to_spec() then scales each service to the
# count the spec asks for. The target count is read from the spec, never hardcoded.
_DESIRED_COUNT_RE = re.compile(r"^(\s+)DesiredCount:\s*\d+\s*$", re.M)


# Secrets Manager generates the RDS master password, and the template interpolates it
# raw into `postgres://user:${password}@host:5432/db`. Anything outside RFC 3986's
# "unreserved" set can therefore change how that URL parses. Found live: two identical
# deployments, one worked and one died at boot with
# `dj_database_url.ParseError: This string is not a valid url` — the only difference was
# which 16 characters Secrets Manager happened to draw. The template's own
# `ExcludeCharacters: '"@/\'` covers only what RDS itself rejects, not what a URL parser
# does. Keep A-Za-z0-9 and `-._~`; exclude every other punctuation character and space.
_SECRET_EXCLUDE_CHARACTERS = "".join(sorted(set(string.punctuation + " ") - set("-._~")))

_RESOURCE_KEY_RE = re.compile(r"^  (?P<lid>[A-Za-z0-9_]+):[ ]*$")
_ENV_LIST_RE = re.compile(r"^(?P<ind>[ ]+)Environment:[ ]*$")
_ENV_ITEM_RE = re.compile(r"^[ ]*- Name:[ ]*(?P<key>\S+)[ ]*$")
_TASK_DEFINITION_TYPE = "AWS::ECS::TaskDefinition"


def _literal_env(spec: dict) -> list[tuple[str, str]]:
    return [(entry["key_name"], entry["value"])
            for entry in (spec or {}).get("generated_env") or []
            if entry.get("key_name") and entry.get("value") is not None]


def enforce_required_env(template: str, spec: dict) -> str:
    """Insert any spec-mandated literal env var the agent left out of a container.
    `enforce_env_values` can only rewrite a `Value:` line that already exists; a key
    the agent never authored needs the whole `- Name:/Value:` pair added.

    Scoped to AWS::ECS::TaskDefinition blocks on purpose. A CodeBuild project has its
    own `Environment:` (a mapping, not a list) and an `EnvironmentVariables:` list
    that also uses `- Name:` — anchoring on the text `Environment:` alone would
    corrupt it. Idempotent: a key already present in a container is left alone.
    """
    required = _literal_env(spec)
    if not template or not required or _TASK_DEFINITION_TYPE not in template:
        return template

    lines = template.splitlines()
    starts = [i for i, line in enumerate(lines) if _RESOURCE_KEY_RE.match(line)]
    insertions: list[tuple[int, list[str]]] = []

    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        for k in range(start + 1, end):
            # A new top-level section (Outputs:, Parameters:) ends the Resources block.
            if lines[k] and not lines[k].startswith(" "):
                end = k
                break
        if not any(line.strip() == f"Type: {_TASK_DEFINITION_TYPE}" for line in lines[start:end]):
            continue

        for k in range(start, end):
            match = _ENV_LIST_RE.match(lines[k])
            if not match:
                continue
            item_indent = match.group("ind") + "  "
            stop = k + 1
            while stop < end and (not lines[stop].strip() or lines[stop].startswith(item_indent)):
                stop += 1
            present = {
                item.group("key")
                for item in (_ENV_ITEM_RE.match(lines[x]) for x in range(k + 1, stop))
                if item
            }
            new_lines = []
            for key, value in required:
                if key in present:
                    continue
                new_lines.append(f"{item_indent}- Name: {key}")
                new_lines.append(f"{item_indent}  Value: {_yaml_scalar(value)}")
            if new_lines:
                insertions.append((k + 1, new_lines))

    for at, new_lines in sorted(insertions, reverse=True):
        lines[at:at] = new_lines

    result = "\n".join(lines)
    return result + "\n" if template.endswith("\n") else result


_TARGET_GROUP_TYPE = "AWS::ElasticLoadBalancingV2::TargetGroup"
_HEALTH_CHECK_PATH_RE = re.compile(r"^(?P<ind>[ ]+)HealthCheckPath:[ ]*.*$")


def enforce_health_check_path(template: str, spec: dict) -> str:
    """Pin every ALB target group's health check to the path the spec promises.

    Found live: the agent chose `/health/` on one generation and `/` on the next.
    The app routes `path("health", ...)` — no trailing slash, and no root route — so
    both return 404 and the target never becomes healthy, which reads to the user as
    "the deploy hangs". scanner/compliance.py already tells the user the check is
    "hardcoded to GET /health" and refuses to pass a repo without such a route;
    this is what makes that true. Idempotent."""
    desired = (spec or {}).get("health_check_path")
    if not template or not desired or _TARGET_GROUP_TYPE not in template:
        return template

    lines = template.splitlines()
    starts = [i for i, line in enumerate(lines) if _RESOURCE_KEY_RE.match(line)]
    insertions: list[tuple[int, list[str]]] = []

    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        for k in range(start + 1, end):
            if lines[k] and not lines[k].startswith(" "):
                end = k
                break
        if not any(line.strip() == f"Type: {_TARGET_GROUP_TYPE}" for line in lines[start:end]):
            continue

        for k in range(start, end):
            match = _HEALTH_CHECK_PATH_RE.match(lines[k])
            if match:
                lines[k] = f"{match.group('ind')}HealthCheckPath: {desired}"
                break
        else:
            for k in range(start, end):
                if lines[k].strip() == "Properties:":
                    insertions.append((k + 1, [f"      HealthCheckPath: {desired}"]))
                    break

    for at, new_lines in sorted(insertions, reverse=True):
        lines[at:at] = new_lines

    result = "\n".join(lines)
    return result + "\n" if template.endswith("\n") else result


_ECS_SERVICE_TYPE = "AWS::ECS::Service"


def _task_security_group_ids(resources: dict) -> list[str]:
    """The logical ids of the security groups ECS attaches to task ENIs."""
    ids: list[str] = []
    for res in resources.values():
        if not isinstance(res, dict) or res.get("Type") != _ECS_SERVICE_TYPE:
            continue
        awsvpc = ((res.get("Properties") or {})
                  .get("NetworkConfiguration") or {}).get("AwsvpcConfiguration") or {}
        for entry in awsvpc.get("SecurityGroups") or []:
            logical_id = _ref_id(entry)
            if logical_id and logical_id not in ids:
                ids.append(logical_id)
    return ids


def _has_internet_egress(resources: dict, sg_logical_id: str) -> bool:
    sg = resources.get(sg_logical_id) or {}
    for rule in (sg.get("Properties") or {}).get("SecurityGroupEgress") or []:
        if isinstance(rule, dict) and rule.get("CidrIp") == _INTERNET_CIDR:
            return True
    for res in resources.values():
        if not isinstance(res, dict) or res.get("Type") != _EGRESS_TYPE:
            continue
        props = res.get("Properties") or {}
        if _ref_id(props.get("GroupId")) == sg_logical_id and props.get("CidrIp") == _INTERNET_CIDR:
            return True
    return False


def enforce_task_egress(template: str, spec: dict) -> str:
    """Guarantee ECS tasks can reach the internet.

    Found live: the agent authored an inline `SecurityGroupEgress` on the task's
    security group reading `Description: Allow HTTPS for ECR and Secrets Manager,
    FromPort 443, DestinationSecurityGroupId: !Ref AlbSecurityGroup`. Declaring
    *any* inline egress makes CloudFormation drop the default allow-all rule, and
    the replacement pointed at the load balancer's security group rather than the
    internet — so the task could not call ECR's public endpoint and died with
    `ResourceInitializationError ... dial tcp ...:443: i/o timeout` before running
    a single line of the customer's code.

    A task always needs outbound internet: ECR for the image, Secrets Manager for
    its secrets, CloudWatch for its logs, and (on free tier) there is no NAT
    gateway and no VPC endpoints to reach them privately. Only fires when the
    template narrowed egress itself — an untouched security group keeps the
    permissive default and needs nothing. Idempotent."""
    if not template or _ECS_SERVICE_TYPE not in template:
        return template
    try:
        doc = cfn_yaml.loads(template)
    except Exception as exc:
        log.warning("enforce_task_egress: could not parse template (%s)", exc)
        return template
    resources = (doc or {}).get("Resources")
    if not isinstance(resources, dict):
        return template

    blocks = []
    for sg_logical_id in _task_security_group_ids(resources):
        sg = resources.get(sg_logical_id) or {}
        inline = (sg.get("Properties") or {}).get("SecurityGroupEgress")
        if not inline:
            continue  # default allow-all egress is intact
        if _has_internet_egress(resources, sg_logical_id):
            continue
        logical_id = f"Clyro{_stem_pascal(sg_logical_id)}EgressInternet"
        if logical_id in resources:
            continue
        blocks.append(
            f"  {logical_id}:\n"
            f"    Type: {_EGRESS_TYPE}\n"
            f"    Properties:\n"
            f"      GroupId: !Ref {sg_logical_id}\n"
            f"      CidrIp: {_INTERNET_CIDR}\n"
            f"      IpProtocol: -1\n"
            f"      Description: Clyro enforced outbound internet for ECR Secrets Manager and logs\n"
        )

    if not blocks:
        return template
    fragment = "".join(blocks)
    out_match = _OUTPUTS_SECTION_RE.search(template)
    if out_match:
        return template[:out_match.start()] + fragment + "\n" + template[out_match.start():]
    return template.rstrip("\n") + "\n" + fragment


_SECRET_TYPE = "AWS::SecretsManager::Secret"
_GENERATE_SECRET_RE = re.compile(r"^(?P<ind>[ ]+)GenerateSecretString:[ ]*$")
_EXCLUDE_CHARS_RE = re.compile(r"^(?P<ind>[ ]+)ExcludeCharacters:[ ]*.*$")


def enforce_secret_url_safe_charset(template: str) -> str:
    """Force every generated secret to draw from a URL-safe alphabet, so a password
    embedded in a connection string can never change how that string parses.
    Idempotent; spec-independent (the constraint is RFC 3986's, not the canvas's)."""
    if not template or _SECRET_TYPE not in template:
        return template

    desired = _yaml_scalar(_SECRET_EXCLUDE_CHARACTERS)
    lines = template.splitlines()
    starts = [i for i, line in enumerate(lines) if _RESOURCE_KEY_RE.match(line)]
    insertions: list[tuple[int, list[str]]] = []

    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        for k in range(start + 1, end):
            if lines[k] and not lines[k].startswith(" "):
                end = k
                break
        if not any(line.strip() == f"Type: {_SECRET_TYPE}" for line in lines[start:end]):
            continue

        for k in range(start, end):
            match = _GENERATE_SECRET_RE.match(lines[k])
            if not match:
                continue
            child_indent = match.group("ind") + "  "
            stop = k + 1
            while stop < end and (not lines[stop].strip() or lines[stop].startswith(child_indent)):
                stop += 1
            for x in range(k + 1, stop):
                existing = _EXCLUDE_CHARS_RE.match(lines[x])
                if existing and len(existing.group("ind")) == len(child_indent):
                    lines[x] = f"{child_indent}ExcludeCharacters: {desired}"
                    break
            else:
                insertions.append((k + 1, [f"{child_indent}ExcludeCharacters: {desired}"]))

    for at, new_lines in sorted(insertions, reverse=True):
        lines[at:at] = new_lines

    result = "\n".join(lines)
    return result + "\n" if template.endswith("\n") else result


def enforce_ecs_desired_count(template: str, spec: dict) -> str:
    """Force every AWS::ECS::Service to DesiredCount: 0 so CloudFormation can
    complete before an image exists. Idempotent."""
    if not template or "AWS::ECS::Service" not in template:
        return template

    def _zero_block(match: "re.Match") -> str:
        logical_id, body = match.group(1), match.group(2)
        if _DESIRED_COUNT_RE.search(body):
            body = _DESIRED_COUNT_RE.sub(lambda m: f"{m.group(1)}DesiredCount: 0", body)
        else:
            # Not authored at all — insert it, since ECS defaults a service to 1 task.
            body = re.sub(r"^(    Properties:\n)", r"\g<1>      DesiredCount: 0\n", body,
                          count=1, flags=re.M)
        return f"  {logical_id}:\n    Type: AWS::ECS::Service{body}"

    return _ECS_SERVICE_BLOCK_RE.sub(_zero_block, template)


def desired_counts_by_node(spec: dict) -> dict[str, int]:
    """``node_id -> target task count`` for every containerized node. build_spec
    already resolved this (``sizing.tasks``; workers are pinned to 1)."""
    counts: dict[str, int] = {}
    for entry in (spec or {}).get("resources") or []:
        if entry.get("type") not in ("service", "worker"):
            continue
        sizing = entry.get("sizing") or {}
        counts[entry["node_id"]] = int(sizing.get("tasks") or 1)
    return counts


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


def enforce_rds_deletion_policy(template: str) -> str:
    """Found live, repeatedly: DeletionPolicy: Snapshot on RDS::DBInstance requires
    the instance to be in the `available` state to take its final snapshot — but a
    rollback triggered by ANY other resource failing while the DB is still
    `creating`/`backing-up` (the common case: most real deploy failures surface
    within the first few minutes, well before RDS finishes its ~5-10 min creation)
    hits "Cannot create a snapshot because the database instance ... is not
    currently in the available state" and the whole stack gets stuck
    ROLLBACK_FAILED — the exact failure mode the auto-correction retry loop
    (provision_with_feedback) depends on NOT happening, since it can't retry until
    rollback actually completes. Unlike ElastiCache (where Retain was the actual
    problem and Snapshot was the fix), here Snapshot itself is the problem with no
    safe variant that still protects data — so for this free-tier/staging-focused
    pipeline, deterministically force Delete (no final snapshot) instead, trading
    the snapshot safety net for a rollback path that reliably completes."""
    if not template:
        return template

    def _fix_block(match: "re.Match") -> str:
        return _SNAPSHOT_POLICY_RE.sub(lambda m: f"{m.group(1)}Delete", match.group(1))

    return _DB_INSTANCE_BLOCK_RE.sub(_fix_block, template)


_CLOUDFRONT_DIST_RE = re.compile(
    r"^  (\w+):\n    Type: AWS::CloudFront::Distribution\b", re.M
)
_OUTPUTS_SECTION_RE = re.compile(r"^Outputs:", re.M)


def _cloudfront_origin_bucket(template: str) -> str | None:
    """Logical ID of the S3 bucket CloudFront serves — i.e. the bucket the frontend
    build must publish to. Its *name* is LLM-chosen and cannot be reconstructed from
    the spec (found live: `${IamScopedPrefix}-${AWS::AccountId}`, with no node-id
    segment), so identify it structurally: it is the distribution's origin."""
    try:
        doc = cfn_yaml.loads(template)
    except Exception as exc:
        log.warning("_cloudfront_origin_bucket: could not parse template (%s)", exc)
        return None
    resources = (doc or {}).get("Resources")
    if not isinstance(resources, dict):
        return None
    buckets = {lid for lid, res in resources.items()
               if isinstance(res, dict) and res.get("Type") == "AWS::S3::Bucket"}
    for res in resources.values():
        if not isinstance(res, dict) or res.get("Type") != "AWS::CloudFront::Distribution":
            continue
        config = (res.get("Properties") or {}).get("DistributionConfig") or {}
        for origin in config.get("Origins") or []:
            domain = (origin or {}).get("DomainName")
            direct = _ref_id(domain)
            if direct in buckets:
                return direct
            for match in _SUB_VAR_RE.finditer(_value_text(domain)):
                token = match.group(1).split(".")[0]
                if token in buckets:
                    return token
    return None


def enforce_codebuild_projects(template: str, spec: dict) -> str:
    """Splice in a CodeBuild::Project (+ IAM role) per buildable node — found
    live: infrastructure was provisioning cleanly (CREATE_COMPLETE, a real
    CloudFront distribution in the outputs) but was completely unusable, because
    nothing anywhere ever builds the customer's code and gets it into the ECR
    repos / S3 bucket IacArchitect creates. ECS retries CannotPullContainerError
    forever, and the CloudFront URL 403s on an empty bucket. See
    codebuild_spec.py's module docstring for the full design rationale — this is
    deterministically generated, not LLM-authored, following the same enforce_*
    philosophy as every other corrector in this file. Must run after the LLM's
    own ECS/ECR/S3/CloudFront resources exist, since the frontend project needs
    the CloudFront distribution's actual logical ID (the one genuinely
    unpredictable piece — everything else is derived from ${NamingPrefix}/
    ${IamScopedPrefix} deterministically, matching IacArchitect's own rules)."""
    if not template:
        return template
    if "BuildArchiveBucket:" in template:
        # Idempotency guard: refine() re-runs this corrector on a template that
        # already went through generate() once — without this check, every
        # refine() call would duplicate the CodeBuild resources (this function
        # has no way to know they're already there otherwise, since it only
        # ever inserts, never diffs against what's already present).
        return template

    cf_match = _CLOUDFRONT_DIST_RE.search(template)
    cloudfront_logical_id = cf_match.group(1) if cf_match else None
    bucket_logical_id = _cloudfront_origin_bucket(template)

    fragment = codebuild_spec.generate_codebuild_resources(
        spec, cloudfront_logical_id, bucket_logical_id)
    if not fragment:
        return template

    out_match = _OUTPUTS_SECTION_RE.search(template)
    if out_match:
        insert_at = out_match.start()
        return template[:insert_at] + fragment + "\n" + template[insert_at:]
    return template.rstrip("\n") + "\n" + fragment


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


# ── Deterministic correctors + blocker gate, as single call sites ──────────────
#
# generate() and refine() each re-run the full corrector set after every LLM-facing
# fix loop (the LLM can undo a correction while fixing something else), and both
# they and validate() compute the same blocker findings. Keeping those two lists in
# one place each means a new corrector or check is added once, not at the five and
# three call sites that previously spelled them out — which had already drifted:
# refine()'s post-lint-loop block omitted enforce_free_tier_limits.
#
# Order matters: enforce_sg_description_charset runs last so it also normalizes the
# Description text emitted by enforce_security_group_rules. enforce_codebuild_projects
# is deliberately NOT here — see its call site in generate().

def _apply_enforcers(template: str, spec: dict) -> str:
    template = enforce_free_tier_limits(template, spec)
    template = enforce_elasticache_deletion_policy(template)
    template = enforce_rds_deletion_policy(template)
    template = enforce_log_group_naming(template)
    template = enforce_security_group_rules(template, spec)
    template = enforce_task_egress(template, spec)
    template = enforce_health_check_path(template, spec)
    template = enforce_secret_url_safe_charset(template)
    template = enforce_required_env(template, spec)
    template = enforce_env_values(template, spec)
    template = enforce_ecs_desired_count(template, spec)
    template = enforce_sg_description_charset(template)
    return template


def _collect_findings(template: str, spec: dict) -> list[dict[str, str]]:
    return (security_scan(template)
            + check_ecs_network_reachability(template, spec)
            + check_secret_interpolation(template, spec)
            + check_spec_conformance(template, spec))


# ── Layer 2: does the template actually realize the build spec? ───────────────
#
# cfn-lint and cfn-guard answer "is this well-formed infrastructure?". Neither
# answers "does this match what the user asked for, and will the app run on it?".
# Every defect that survived a clean generate — the missing ALB ingress, the ARN as a
# broker URL, a frontend build syncing to a bucket that doesn't exist — is schema-valid
# CFN. Each costs a real deploy to discover: an ECS service that can't stabilize burns
# ~3h before CloudFormation times out. These predicates cost milliseconds and are all
# derivable from the spec, so run them before provisioning ever starts.
#
# The enforce_* passes run first and should make most of these unsatisfiable, so a
# blocker here usually means a hand-edit in the Monaco editor (validate()) undid one.
_ECR_IMAGE_RE = re.compile(r"\.dkr\.ecr\.[^/]+/([^:\s'\"]+)")
_ARN_VALUE_RE = re.compile(r"arn:aws:|\$\{[\w:]+\.Arn\}")
_URL_KEY_RE = re.compile(r"(_URL$|BROKER)", re.I)


def _container_envs(resources: dict) -> list[tuple[str, str, Any]]:
    """(task-def logical id, env key, env value) for every ECS container env entry."""
    out = []
    for logical_id, res in resources.items():
        if not isinstance(res, dict) or res.get("Type") != "AWS::ECS::TaskDefinition":
            continue
        for container in (res.get("Properties") or {}).get("ContainerDefinitions") or []:
            for env in container.get("Environment") or []:
                if isinstance(env, dict) and env.get("Name"):
                    out.append((logical_id, env["Name"], env.get("Value")))
    return out


def check_spec_conformance(template: str, spec: dict) -> list[dict[str, str]]:
    """Assert the template realizes the build spec. Findings use the same
    ``{severity, message}`` shape as ``security_scan`` — ``blocker`` gates IAC_READY
    through ``validate()``."""
    if not template or not spec:
        return []
    try:
        doc = cfn_yaml.loads(template)
    except Exception:
        return []  # cfn-lint reports parse failures far better than we can
    resources = (doc or {}).get("Resources")
    if not isinstance(resources, dict):
        return []

    findings: list[dict[str, str]] = []
    by_name, by_stem = _index_security_groups(resources, spec)

    # 1. Every declared connection has the security-group rule that makes it possible.
    for edge in spec.get("network_edges") or []:
        kind, desc = edge.get("kind"), edge.get("description") or ""
        if kind == "sg_ingress":
            source = _find_sg(edge.get("from_sg"), by_name, by_stem)
            target = _find_sg(edge.get("to_sg"), by_name, by_stem)
            port, protocol = edge.get("port"), edge.get("protocol") or "tcp"
            if not source or not target:
                findings.append({"severity": "blocker", "message": (
                    f"Connection '{desc}' needs security groups "
                    f"'{edge.get('from_sg')}' and '{edge.get('to_sg')}', but the template "
                    "doesn't define both.")})
            elif not _has_rule(resources, True, target, port, protocol, source, None):
                findings.append({"severity": "blocker", "message": (
                    f"Connection '{desc}' has no security-group ingress: {target} does not "
                    f"allow {protocol}/{port} from {source}, so the connection is refused "
                    "at deploy time.")})
        elif kind == "alb":
            alb = _find_sg(edge.get("alb_sg"), by_name, by_stem)
            target = _find_sg(edge.get("target_sg"), by_name, by_stem)
            listener_port, target_port = edge.get("listener_port"), edge.get("target_port")
            if not alb or not target:
                findings.append({"severity": "blocker", "message": (
                    f"Connection '{desc}' needs an ALB security group and a target "
                    "security group, but the template doesn't define both.")})
                continue
            if not _has_rule(resources, True, target, target_port, "tcp", alb, None):
                findings.append({"severity": "blocker", "message": (
                    f"{target} has no ingress rule allowing tcp/{target_port} from the load "
                    f"balancer's security group {alb}. The target group's health check will "
                    "time out (Target.Timeout) and the ECS service will never stabilize.")})
            if not _has_rule(resources, True, alb, listener_port, "tcp", None, _INTERNET_CIDR):
                findings.append({"severity": "blocker", "message": (
                    f"{alb} has no ingress rule allowing tcp/{listener_port} from "
                    f"{_INTERNET_CIDR}, so the load balancer is unreachable from the internet.")})

    # 2. A connection URL is never a raw ARN. (An SQS ARN as CELERY_BROKER_URL made
    #    kombu fall through to pyamqp and crash-loop the worker on an idna error.)
    for task_def, key, value in _container_envs(resources):
        if not _URL_KEY_RE.search(key):
            continue
        text = _value_text(value)
        if text and _ARN_VALUE_RE.search(text):
            findings.append({"severity": "blocker", "message": (
                f"{task_def} sets {key} to an ARN ({text[:60]}), not a connection URL. "
                "Clients parse this value as a URL; an ARN has no scheme and the container "
                "will fail at startup. Use the resource's endpoint with a real scheme.")})

    # 2b. Every spec-mandated literal env var reached at least one container.
    #     enforce_required_env inserts these, but it can only extend an `Environment:`
    #     list that exists — a container authored without one needs the agent to fix it.
    for key, value in _literal_env(spec):
        reached = any(
            container.get("Name") == key
            for res in resources.values()
            if isinstance(res, dict) and res.get("Type") == "AWS::ECS::TaskDefinition"
            for definition in (res.get("Properties") or {}).get("ContainerDefinitions") or []
            for container in definition.get("Environment") or []
        )
        if not reached:
            findings.append({"severity": "blocker", "message": (
                f"No ECS container sets {key}. The spec requires it at the literal value "
                f"'{value}'. Add it to the ContainerDefinitions Environment list of every "
                "application container.")})

    # 2e. A generated secret can't contain a character that changes how the
    #     connection string embedding it parses. Every other enforcer added here has
    #     a matching gate; without this one a hand-edited or stale template could
    #     still provision a password that breaks DATABASE_URL about half the time.
    for logical_id, res in resources.items():
        if not isinstance(res, dict) or res.get("Type") != _SECRET_TYPE:
            continue
        generate = (res.get("Properties") or {}).get("GenerateSecretString")
        if not isinstance(generate, dict):
            continue
        excluded = set(generate.get("ExcludeCharacters") or "")
        missing = sorted(set(_SECRET_EXCLUDE_CHARACTERS) - excluded)
        if missing:
            findings.append({"severity": "blocker", "message": (
                f"{logical_id} can generate a secret containing {''.join(missing)!r}, which is "
                "not URL-safe. The value is interpolated into a connection string, so the app "
                "fails at startup with a URL parse error. Exclude every reserved character.")})

    # 2d. The load balancer health-checks the path the app actually serves.
    desired_path = spec.get("health_check_path")
    if desired_path:
        for logical_id, res in resources.items():
            if not isinstance(res, dict) or res.get("Type") != _TARGET_GROUP_TYPE:
                continue
            actual = (res.get("Properties") or {}).get("HealthCheckPath")
            if actual != desired_path:
                findings.append({"severity": "blocker", "message": (
                    f"{logical_id} health-checks {actual!r}, but the app serves its check at "
                    f"{desired_path!r}. Any other path returns 404 and the target never becomes "
                    "healthy, so the service never stabilizes.")})

    # 2c. Every ECS task can still reach the internet. A task security group that
    #     narrows egress without a 0.0.0.0/0 rule cannot pull its image from ECR.
    for sg_logical_id in _task_security_group_ids(resources):
        sg = resources.get(sg_logical_id) or {}
        if not (sg.get("Properties") or {}).get("SecurityGroupEgress"):
            continue
        if not _has_internet_egress(resources, sg_logical_id):
            findings.append({"severity": "blocker", "message": (
                f"{sg_logical_id} declares egress rules but none to {_INTERNET_CIDR}, which "
                "removes the default allow-all. ECS tasks using it cannot reach ECR, Secrets "
                "Manager or CloudWatch, and will fail with ResourceInitializationError.")})

    # 3. Every ECR image an ECS task pulls is one the build pipeline actually pushes.
    buildable = set(codebuild_spec.buildable_node_ids(spec))
    prefix = spec.get("naming_prefix") or ""
    expected_repos = {f"{prefix}-{node_id}" for node_id in buildable}
    for logical_id, res in resources.items():
        if not isinstance(res, dict) or res.get("Type") != "AWS::ECS::TaskDefinition":
            continue
        for container in (res.get("Properties") or {}).get("ContainerDefinitions") or []:
            image = _resolve_sub(container.get("Image"), spec) or ""
            match = _ECR_IMAGE_RE.search(image)
            if match and match.group(1) not in expected_repos:
                findings.append({"severity": "blocker", "message": (
                    f"{logical_id} pulls the ECR image '{match.group(1)}', but no CodeBuild "
                    f"project builds it (the build pipeline produces: "
                    f"{', '.join(sorted(expected_repos)) or 'nothing'}). ECS will retry "
                    "CannotPullContainerError forever.")})

    # 4. The frontend build syncs to a bucket this template creates. Skipped until
    #    enforce_codebuild_projects has spliced the projects in. The bucket may be
    #    named literally or referenced by logical id (!Ref) — accept either.
    bucket_ids = {lid for lid, res in resources.items()
                  if isinstance(res, dict) and res.get("Type") == "AWS::S3::Bucket"}
    bucket_names = {
        _resolve_sub((res.get("Properties") or {}).get("BucketName"), spec)
        for lid, res in resources.items() if lid in bucket_ids
    }
    for logical_id, res in resources.items():
        if not isinstance(res, dict) or res.get("Type") != "AWS::CodeBuild::Project":
            continue
        env = (res.get("Properties") or {}).get("Environment") or {}
        for var in env.get("EnvironmentVariables") or []:
            if var.get("Name") != "BUCKET_NAME":
                continue
            value = var.get("Value")
            referenced = _ref_id(value)
            if referenced:
                if referenced not in bucket_ids:
                    findings.append({"severity": "blocker", "message": (
                        f"{logical_id} publishes the frontend to '{referenced}', which is not "
                        "an S3 bucket in this template. The build will fail on `aws s3 sync`.")})
                continue
            target = _resolve_sub(value, spec)
            if target and target not in bucket_names:
                findings.append({"severity": "blocker", "message": (
                    f"{logical_id} publishes the frontend to bucket '{target}', which this "
                    "template never creates. The build will fail on `aws s3 sync` and the "
                    "site will never be deployed.")})

    # 5. The chosen broker needs application-side configuration Clyro cannot inject.
    #    Not a blocker: it's a contract with the customer's repo, not a template defect,
    #    so gating IAC_READY on it would wedge the project permanently.
    broker = spec.get("broker") or {}
    if broker.get("requires_app_config") and any(
            _URL_KEY_RE.search(key) and "BROKER" in key.upper()
            for _, key, _ in _container_envs(resources)):
        findings.append({"severity": "critical", "message": (
            f"The task broker resolves to {broker.get('transport')}, which Celery cannot "
            "point at this template's queue from the broker URL alone. The application must "
            "set `broker_transport_options={'predefined_queues': ...}` and "
            "`task_default_queue`; otherwise kombu falls back to a queue named 'celery' that "
            "this stack neither creates nor grants access to, and the worker will crash-loop.")})

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
    template = _apply_enforcers(template, spec)

    region = deployment.aws_connection.aws_region or "us-east-1"
    validation = lint_template(template, region)
    # Server-side enforcement: if the agent returned a template with cfn-lint ERRORS
    # despite its own validation rounds, drive them to zero with a bounded fix loop.
    if validation["errors"]:
        template, validation, fix_msg = _lint_fix_loop(
            template, validation, spec=spec, project=project, model=model, region=region)
        if fix_msg:
            message = fix_msg
        template = _apply_enforcers(template, spec)

    findings = _collect_findings(template, spec)
    if any(f["severity"] == "blocker" for f in findings):
        template, findings, fix_msg = _security_fix_loop(
            template, findings, spec=spec, project=project, model=model, region=region)
        if fix_msg:
            message = fix_msg
        template = _apply_enforcers(template, spec)
        validation = lint_template(template, region)

    # Runs last, once, after every LLM-facing fix loop is done — not before,
    # because feeding this back through _lint_fix_loop/_security_fix_loop would
    # let the LLM "fix" resources it was never told about and doesn't
    # understand, risking corruption of the deterministic build pipeline.
    template = enforce_codebuild_projects(template, spec)
    validation = lint_template(template, region)
    # Re-run against the final template: the build pipeline only exists now, so the
    # frontend-bucket conformance check couldn't have run above.
    findings = _collect_findings(template, spec)

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

    # Found live: when the agent's response is malformed (wrong/missing `outcome`
    # tag alongside prose in the `template` field — e.g. diagnosing an IAM
    # permission issue outside the template's scope, but not tagged as an
    # "answer"), this would otherwise persist that prose as the deployment's
    # template, corrupting it. A real CFN template always has a top-level
    # `Resources:` key; if it's missing, treat this the same as an unusable edit
    # and keep the working template instead of overwriting it with garbage.
    if "Resources:" not in new_template:
        log.warning("refine: agent response didn't look like a CFN template; keeping current")
        new_template = current
        message = "Couldn't apply that change — the response wasn't a valid template edit."

    new_template = _apply_enforcers(new_template, spec)
    validation = lint_template(new_template, region)

    # Bounded corrective loop if the edit introduced cfn-lint ERRORS (warnings are
    # acceptable). Each round only sticks if it reduces errors; it stops once clean.
    if validation["errors"]:
        new_template, validation, fix_msg = _lint_fix_loop(
            new_template, validation, spec=spec, project=project, model=model,
            region=region, history=history)
        if fix_msg:
            message = fix_msg
        new_template = _apply_enforcers(new_template, spec)

    findings = _collect_findings(new_template, spec)
    if any(f["severity"] == "blocker" for f in findings):
        new_template, findings, fix_msg = _security_fix_loop(
            new_template, findings, spec=spec, project=project, model=model,
            region=region, history=history)
        if fix_msg:
            message = fix_msg
        new_template = _apply_enforcers(new_template, spec)
        validation = lint_template(new_template, region)

    new_template = enforce_codebuild_projects(new_template, spec)
    validation = lint_template(new_template, region)
    findings = _collect_findings(new_template, spec)

    deployment.cloudformation_template = new_template
    deployment.status = Deployment.Status.GENERATING_IAC
    deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"outcome": "edit", "template": new_template, "message": message,
            "validation": validation, "status": deployment.status,
            "security_findings": findings}


# Statuses that mean "a CloudFormation stack exists in the user's account right now."
# DELETED/DELETING are excluded: nothing is left to protect.
_STACK_EXISTS_STATUSES = (
    Deployment.Status.SUBMITTING, Deployment.Status.IN_PROGRESS, Deployment.Status.BUILDING,
    Deployment.Status.COMPLETE, Deployment.Status.BUILD_FAILED, Deployment.Status.FAILED,
    Deployment.Status.PAUSED,
)


def validate(project: Project, template: str) -> dict[str, Any]:
    """Persist the (possibly manually edited) template and lint it. On a clean
    template the deployment moves to IAC_READY (validated, ready to provision)."""
    deployment = ensure_deployment(project)
    region = deployment.aws_connection.aws_region or "us-east-1"
    validation = lint_template(template, region)
    spec = _spec_for(deployment)
    findings = _collect_findings(template, spec)
    has_blocker = any(f["severity"] == "blocker" for f in findings)

    deployment.cloudformation_template = template

    # A deployment that already created a stack keeps its status. Found live: after a
    # failed deploy, clicking Validate demoted the deployment to GENERATING_IAC, which
    # makes Step 4 render the IaC editor instead of the provision log — and the only
    # teardown control lives in that log. The stack stayed up, billing, with no way to
    # delete it from the UI. Validating a template says nothing about a stack that
    # already exists; Clyro has no update path, so it must be torn down first.
    if deployment.cloudformation_stack_name and deployment.status in _STACK_EXISTS_STATUSES:
        deployment.save(update_fields=["cloudformation_template", "updated_at"])
    else:
        deployment.status = (
            Deployment.Status.IAC_READY if validation["is_valid"] and not has_blocker
            else Deployment.Status.GENERATING_IAC
        )
        deployment.save(update_fields=["cloudformation_template", "status", "updated_at"])

    return {"validation": validation, "status": deployment.status, "security_findings": findings}


def get_current(project: Project) -> dict[str, Any]:
    """Return the current template + status + fresh diagnostics for reload.

    Read-only on purpose — unlike ensure_deployment() (used by generate/
    validate/refine), this must NOT exclude a SUBMITTING/IN_PROGRESS/COMPLETE
    deployment and spawn a fresh empty row in its place. Found live: every
    page load during real provisioning did exactly that, so StepFour's
    resume-into-provisioning-screen hydration always saw an empty template
    and fell back to the IaC editor instead of the live log.
    """
    deployment = Deployment.objects.filter(project=project).order_by("-created_at").first()
    if deployment is None:
        raise IacError("Generate a CloudFormation template before reviewing it.")
    template = deployment.cloudformation_template or ""
    validation = lint_template(template, deployment.aws_connection.aws_region or "us-east-1") if template else None
    findings = []
    if template:
        findings = _collect_findings(template, _spec_for(deployment))
    return {"template": template, "status": deployment.status, "validation": validation,
            "security_findings": findings}
