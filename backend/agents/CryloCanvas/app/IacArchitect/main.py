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

VALIDATION (required before you answer):
- Call validate_cloudformation_template with your template_content. If it reports
  errors, FIX them and validate again. Repeat until there are no errors (at most a few
  rounds). Use the AWS docs tools if you are unsure of a property name or type.

OUTPUT — return EXACTLY this format, nothing before or after:
===TEMPLATE===
<the full CloudFormation YAML>
===END TEMPLATE===
===MESSAGE===
<one short paragraph: what you built, or for refine what you changed>
===END MESSAGE===
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
    """Parse the delimited model output into ``{template, message}``. Falls back to a
    fenced code block, then to treating the whole reply as the template."""
    text = text.strip()
    template = _extract_section(text, "TEMPLATE")
    message = _extract_section(text, "MESSAGE")
    if not template:
        fence = re.search(r"```(?:ya?ml|json)?\s*(.*?)```", text, re.DOTALL)
        template = fence.group(1).strip() if fence else text
    if not message:
        message = "Template ready."
    return {"template": template, "message": message}


mcp_client = get_mcp_client()
_tools: list[Any] = []
if mcp_client:
    _tools.append(mcp_client)

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = load_model()
    return _model


def build_agent() -> Agent:
    # Fresh agent per call — the runtime may stay warm across unrelated projects, so a
    # reused Agent would leak template/history between requests.
    return Agent(model=_get_model(), system_prompt=SYSTEM_PROMPT, tools=_tools)


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
            "Refine the current CloudFormation template per the instruction below. "
            "Change only what the instruction asks; keep everything else intact, then "
            "validate.\n\n"
            f"Build spec (JSON):\n{json.dumps(spec)}\n\n"
            f"Current template (YAML):\n{payload.get('template', '')}\n\n"
            f"Instruction: {payload.get('instruction', '')}\n\n"
            "Output the full updated template in the required format."
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

    agent = build_agent()
    user_message = _build_user_message(payload)

    full_text = ""
    async for event in agent.stream_async(user_message):
        if "data" in event and isinstance(event["data"], str):
            full_text += event["data"]

    result = _parse_output(full_text)
    yield json.dumps(result)


if __name__ == "__main__":
    app.run()
