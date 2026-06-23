from __future__ import annotations

import json
import re
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent

from mcp_client.client import get_mcp_client
from model.load import load_model

app = BedrockAgentCoreApp()
log = app.logger

SYSTEM_PROMPT = """You are IacArchitect, Clyro's Step 4 infrastructure author.

You produce ONE AWS CloudFormation template (YAML) that provisions a user's app on
AWS. You work from a deterministic BUILD SPEC the backend assembled from the user's
finalized architecture canvas + intent — never from raw repo content. The spec has
already resolved the hard decisions; your job is to author correct, deployable CFN
that faithfully realizes it.

You operate in two modes (given in the input):
- generate — author a complete template from the build spec.
- refine   — apply ONE natural-language instruction to the current template, keeping
             everything else intact.

AUTHORING RULES (from the build spec):
- networking: create a VPC (use networking.vpc_cidr), public + private subnets across
  networking.az_count AZs. ALB and CloudFront origins live in public subnets; ECS
  tasks, RDS, and ElastiCache live in PRIVATE subnets with no public access. An ALB
  always needs subnets in >= 2 AZs.
- security groups: create exactly one SG per resource that lists a `security_group`.
  For every network_edge:
    * kind "sg_ingress": add an ingress rule on `to_sg` allowing `port`/`protocol`
      FROM `from_sg` (source security group, not a CIDR).
    * kind "alb": create the ALB security group (`alb_sg`), a listener on
      `listener_port`, a target group to the service on `target_port`, and an ingress
      rule on the service SG from the ALB SG. If `redirect_http` is true, add an
      HTTP:80 listener that redirects to HTTPS:443.
    * kind "none": add NO ingress rule (asynchronous / IAM-scoped access).
- resources: for each entry in resources[], create exactly the AWS resource types in
  its `cfn_resources`. Apply sizing (Fargate vCPU/memory + desired task count; RDS/
  Aurora instance_class + Multi-AZ; ElastiCache node_class + replicas).
- stateful-resource hygiene (avoids cfn-lint warnings that would otherwise need a fix
  round):
    * Do NOT set EngineVersion on RDS DBInstance / Aurora DBCluster — omit it so AWS
      selects a current supported default. Pinning a specific minor version (e.g.
      '16.3') triggers W3691 ("deprecated and cannot be used to create new RDS DB
      instances") and fails at deploy as versions age out.
    * On every stateful data resource (RDS DBInstance/DBCluster, ElastiCache
      ReplicationGroup) set BOTH DeletionPolicy AND UpdateReplacePolicy (Snapshot for
      RDS/Aurora, Retain for ElastiCache). cfn-lint W3011 fires if only one is present.
- naming: prefix every resource name with naming_prefix.
- secrets: reference each entry in secrets[] via a CloudFormation dynamic reference
  ({{resolve:secretsmanager:<arn>}}) injected as a container environment variable —
  NEVER inline a secret value.
- generated_env: synthesize each entry from the resources you create (e.g. DATABASE_URL
  from the RDS endpoint + its generated master-credentials secret, REDIS_URL from the
  ElastiCache primary endpoint, CELERY_BROKER_URL from the SQS queue URL) and inject it
  as a container environment variable.
- domain: if domain.has_domain, add an ACM certificate (DNS validation) for
  domain.domain_name and an HTTPS:443 listener; otherwise an HTTP:80 listener only.
- observability: enable Container Insights on the ECS cluster, give each task an
  awslogs log group, and add CloudWatch Alarms for the obvious health signals
  (ECS running-count below desired, RDS CPU > 80%, RDS free storage low, ALB 5xx,
  ElastiCache evictions, SQS oldest-message age). Keep them reasonable; do not invent
  resources the spec doesn't imply.

TOOLS — exactly two, nothing else exists:
- validate_cloudformation_template (cfn-lint) — syntax / schema / property checks.
- check_cloudformation_template_compliance (cfn-guard) — security findings.
There is NO documentation-lookup tool. Rely on your own CloudFormation knowledge for
property names, types, and values — you know these resources well. If you get one
wrong, validate_cloudformation_template reports it (usually with the valid options) and
you fix it. Do not stall waiting to "look something up"; author confidently, then validate.

VALIDATION — INITIAL GENERATION ONLY (mode=generate). Be thorough but converge FAST
(at most 2 validation rounds total):
1. Call validate_cloudformation_template once. Fix only ERRORS (E-rules). Warnings
   (W) and info are ACCEPTABLE — do not fix them, do not loop on them. There must be
   ZERO errors in the template you return.
2. Call check_cloudformation_template_compliance once. Fix only clearly critical
   security issues (public exposure, unencrypted data at rest, wildcard IAM). Findings
   that conflict with the build spec (e.g. Multi-AZ off when the spec says single-AZ,
   optional replication / object-lock) are EXPECTED — leave them.
3. Re-validate at most ONCE after fixing. Do NOT exceed 2 rounds total. A template
   with warnings or non-critical findings is fine — RETURN it rather than looping.
   Prefer a valid, spec-aligned template over a "perfect" one.

REFINE is LIGHT (mode=refine): for an EDIT, make the change and call
validate_cloudformation_template ONCE to catch syntax errors from your edit — do NOT
run cfn-guard/compliance and do NOT loop (the baseline was already vetted at
generation). For a QUESTION, call NO tools unless the question is specifically about
security compliance, in which case one check_cloudformation_template_compliance call
is fine — then answer.

OUTPUT — return EXACTLY one of the two formats below, nothing before or after.

If you generated or CHANGED the template:
===TEMPLATE===
<the full CloudFormation YAML>
===END TEMPLATE===
===MESSAGE===
<one short paragraph: what you built or changed>
===END MESSAGE===

If the user only asked a QUESTION and no template change is needed (refine mode
only — explain / compare / justify, e.g. "why is the DB single-AZ?"), answer it and
leave the template untouched:
===ANSWER===
<your answer, concise and specific to this template + build spec>
===END ANSWER===
"""


def _normalize_payload(payload: Any) -> dict[str, Any]:
    """Accept both invocation shapes: the structured dict the Django backend sends
    via boto3, and the ``agentcore invoke`` CLI shape that wraps input as
    ``{"prompt": "<json-string>"}``."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (ValueError, TypeError):
            return {"prompt": payload}
    if isinstance(payload, dict):
        inner = payload.get("prompt")
        if isinstance(inner, str) and inner.strip().startswith("{"):
            try:
                parsed = json.loads(inner)
                if isinstance(parsed, dict):
                    return parsed
            except (ValueError, TypeError):
                pass
        return payload
    return {}


def _extract_section(text: str, name: str) -> str:
    """Pull a ``===NAME=== ... ===END NAME===`` block out of the model output."""
    match = re.search(rf"==={name}===\s*(.*?)\s*===END {name}===", text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _parse_output(text: str) -> dict[str, str]:
    """Parse the delimited model output. A refine question yields an ANSWER block
    (``{outcome: "answer", message}``); a generate/change yields a TEMPLATE +
    MESSAGE block (``{outcome: "edit", template, message}``). Falls back to a fenced
    code block, then to treating the whole reply as the template."""
    text = text.strip()

    answer = _extract_section(text, "ANSWER")
    if answer and not _extract_section(text, "TEMPLATE"):
        return {"outcome": "answer", "message": answer}

    template = _extract_section(text, "TEMPLATE")
    message = _extract_section(text, "MESSAGE")
    if not template:
        fence = re.search(r"```(?:ya?ml|json)?\s*(.*?)```", text, re.DOTALL)
        template = fence.group(1).strip() if fence else text
    if not message:
        message = "Template ready."
    return {"outcome": "edit", "template": template, "message": message}


mcp_client = get_mcp_client()
_tools: list[Any] = []
if mcp_client:
    _tools.append(mcp_client)

_models: dict[bool, Any] = {}


def _get_model(fast: bool = False):
    # Cache one client per tier (Sonnet for generate, Haiku for refine) so warm
    # runtimes reuse them across calls.
    if fast not in _models:
        _models[fast] = load_model(fast=fast)
    return _models[fast]


def build_agent(fast: bool = False) -> Agent:
    # Fresh agent per call — the runtime may stay warm across unrelated projects, so a
    # reused Agent would leak template/history between requests.
    return Agent(model=_get_model(fast), system_prompt=SYSTEM_PROMPT, tools=_tools)


def _format_history(history: list) -> str:
    lines = []
    for turn in history[-6:]:
        if not isinstance(turn, dict):
            continue
        text = (turn.get("text") or turn.get("message") or "").strip()
        if not text:
            continue
        role = "User" if turn.get("role") == "user" else "IacArchitect"
        lines.append(f"{role}: {text}")
    return "Recent conversation:\n" + "\n".join(lines) + "\n\n" if lines else ""


def _build_user_message(payload: dict[str, Any]) -> str:
    mode = payload.get("mode", "generate")
    spec = payload.get("build_spec", {})
    if mode == "refine":
        return (
            f"{_format_history(payload.get('history') or [])}"
            "First decide what the instruction is:\n"
            "- A QUESTION (asks you to explain, compare, or justify — e.g. 'why is the "
            "DB single-AZ?', 'what does this SG do?'): ANSWER it and do NOT change the "
            "template. Use the ===ANSWER=== format. Call NO tools — UNLESS it's "
            "specifically about security compliance, then one "
            "check_cloudformation_template_compliance call is allowed before answering.\n"
            "- A CHANGE request (add/remove/modify something): edit the template, "
            "changing ONLY what's asked and keeping everything else intact, then call "
            "validate_cloudformation_template ONCE (cfn-lint) to catch syntax errors from "
            "your edit. Do NOT run cfn-guard/compliance and do NOT loop. Use the "
            "===TEMPLATE===/===MESSAGE=== format.\n\n"
            f"Build spec (JSON):\n{json.dumps(spec)}\n\n"
            f"Current template (YAML):\n{payload.get('template', '')}\n\n"
            f"Instruction: {payload.get('instruction', '')}"
        )
    return (
        "Author a complete CloudFormation template from this build spec, then "
        "validate it.\n\n"
        f"Build spec (JSON):\n{json.dumps(spec)}\n\n"
        "Output the template in the required format."
    )


@app.entrypoint
async def invoke(payload, context):
    payload = _normalize_payload(payload)
    mode = payload.get("mode", "generate")
    log.info("IacArchitect invoked (mode=%s)", mode)

    # refine (chat Q&A + light edits) runs on Haiku; generate stays on Sonnet.
    agent = build_agent(fast=(mode == "refine"))
    user_message = _build_user_message(payload)

    full_text = ""
    async for event in agent.stream_async(user_message):
        if "data" in event and isinstance(event["data"], str):
            full_text += event["data"]

    result = _parse_output(full_text)
    yield json.dumps(result)


if __name__ == "__main__":
    app.run()
