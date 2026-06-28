from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent

from mcp_client.client import get_mcp_client
from model.load import DEFAULT_GENERATE, DEFAULT_REFINE, load_model, resolve_model_id

app = BedrockAgentCoreApp()
log = app.logger

_AUTHORING_RULES = """
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
  resources the spec doesn't imply."""

_REFINE_RULES = """
REFINE (mode=refine): the backend runs cfn-lint on the result and, if your edit
introduced errors, sends them back for you to fix. So:
- QUESTION (explain / compare / justify): answer it, leave the template unchanged.
- CHANGE: express it as the SMALLEST set of search/replace edits (see ===EDITS===).
  Change ONLY what's asked; leave everything else byte-for-byte.
  Escape hatch: if the change is so sweeping that targeted edits are impractical, or
  the payload sets prefer_full, return the FULL template via ===TEMPLATE=== instead."""

_OUTPUT_FORMAT = """
OUTPUT — return EXACTLY one of the formats below, nothing before or after.

(refine CHANGE — preferred) one or more search/replace edits. Each SEARCH block must be
copied EXACTLY from the current template (indentation included) with enough surrounding
lines to match EXACTLY ONCE; REPLACE is the new text (leave it empty to delete):
===EDITS===
@@SEARCH@@
<exact existing lines>
@@REPLACE@@
<new lines>
@@END@@
===END EDITS===
===MESSAGE===
<one short paragraph: what you changed>
===END MESSAGE===

(generate, or a refine CHANGE needing a full rewrite / prefer_full) the whole YAML:
===TEMPLATE===
<the full CloudFormation YAML>
===END TEMPLATE===
===MESSAGE===
<one short paragraph: what you built or changed>
===END MESSAGE===

(refine QUESTION only — explain / compare / justify, e.g. "why is the DB single-AZ?")
answer it and leave the template untouched:
===ANSWER===
<your answer, concise and specific to this template + build spec>
===END ANSWER==="""

# Full prompt for Claude models — includes MCP validation tools (cfn-lint + cfn-guard).
SYSTEM_PROMPT = f"""You are IacArchitect, Clyro's Step 4 infrastructure author.

You produce ONE AWS CloudFormation template (YAML) that provisions a user's app on
AWS. You work from a deterministic BUILD SPEC the backend assembled from the user's
finalized architecture canvas + intent — never from raw repo content. The spec has
already resolved the hard decisions; your job is to author correct, deployable CFN
that faithfully realizes it.

You operate in two modes (given in the input):
- generate — author a complete template from the build spec.
- refine   — apply ONE natural-language instruction to the current template, keeping
             everything else intact.
{_AUTHORING_RULES}

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
{_REFINE_RULES}
{_OUTPUT_FORMAT}
"""

# Toolless prompt for models that don't support Converse tool use (e.g. Amazon Nova).
# Validation is handled server-side by cfn-lint after the response is returned.
SYSTEM_PROMPT_NO_TOOLS = f"""You are IacArchitect, Clyro's Step 4 infrastructure author.

You produce ONE AWS CloudFormation template (YAML) that provisions a user's app on
AWS. You work from a deterministic BUILD SPEC the backend assembled from the user's
finalized architecture canvas + intent — never from raw repo content. The spec has
already resolved the hard decisions; your job is to author correct, deployable CFN
that faithfully realizes it.

You operate in two modes (given in the input):
- generate — author a complete template from the build spec.
- refine   — apply ONE natural-language instruction to the current template, keeping
             everything else intact.
{_AUTHORING_RULES}

No validation tools are available. Apply your own CloudFormation knowledge to produce
a correct, deployable template in one pass. Do NOT call any tools. The backend runs
cfn-lint on your output automatically and will surface any errors to the user.
{_REFINE_RULES}
{_OUTPUT_FORMAT}
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


def _parse_edits(text: str) -> list[dict[str, str]]:
    """Parse ``@@SEARCH@@ ... @@REPLACE@@ ... @@END@@`` blocks from an ===EDITS===
    section into ``[{search, replace}]``. The ``@@`` markers can't appear in CFN YAML
    (or its ``# ====`` comment banners), so they won't collide with template content."""
    body = _extract_section(text, "EDITS")
    if not body:
        return []
    edits = []
    for m in re.finditer(r"@@SEARCH@@\n(.*?)\n@@REPLACE@@\n(.*?)\n?@@END@@", body, re.DOTALL):
        edits.append({"search": m.group(1), "replace": m.group(2)})
    return edits


def _parse_output(text: str) -> dict[str, Any]:
    """Parse the delimited model output into one of three outcomes:
    - ``{outcome: "edit", edits: [...], message}``  — refine change as search/replace
    - ``{outcome: "answer", message}``              — refine question
    - ``{outcome: "edit", template, message}``      — generate / full-rewrite fallback
    Falls back to a fenced code block, then the whole reply, as the template."""
    text = text.strip()

    edits = _parse_edits(text)
    if edits:
        return {"outcome": "edit", "edits": edits,
                "message": _extract_section(text, "MESSAGE") or "Updated the template."}

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

_models: dict[str, Any] = {}


def _get_model(model_id: str):
    # Cache one client per resolved model id so warm runtimes reuse them across calls.
    if model_id not in _models:
        _models[model_id] = load_model(model_id)
    return _models[model_id]


# Model families that handle the Converse tool-call sequence strands emits, so they run
# the FULL toolful path (cfn-lint/cfn-guard self-correction). Anthropic + the agentic open
# models (Kimi / MiniMax / GLM) are verified to survive ConverseStream + tools and
# self-correct to clean templates; DeepSeek is enabled here to test the same. (Amazon Nova
# and Qwen raised modelStreamErrorException on streamed tools and produced invalid output —
# they've been dropped.) If a model here errors on streamed tools, drop it from this list.
_TOOLFUL_FAMILIES = ("anthropic", "moonshotai", "kimi", "minimax", "glm", "zai", "deepseek")


def _supports_tool_use(model_id: str) -> bool:
    mid = (model_id or "").lower()
    return any(fam in mid for fam in _TOOLFUL_FAMILIES)


def build_agent(model_id: str) -> Agent:
    # Fresh agent per call — the runtime may stay warm across unrelated projects, so a
    # reused Agent would leak template/history between requests.
    if _supports_tool_use(model_id):
        return Agent(model=_get_model(model_id), system_prompt=SYSTEM_PROMPT, tools=_tools)
    # Nova and other non-Claude models: no MCP tools, simplified system prompt.
    # cfn-lint still runs server-side on every response.
    return Agent(model=_get_model(model_id), system_prompt=SYSTEM_PROMPT_NO_TOOLS, tools=[])


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
        prefer_full = bool(payload.get("prefer_full"))
        change_fmt = (
            "return the FULL revised template via ===TEMPLATE===/===MESSAGE==="
            if prefer_full else
            "return the SMALLEST set of @@SEARCH@@/@@REPLACE@@/@@END@@ edits via "
            "===EDITS===/===MESSAGE=== — copy each SEARCH block EXACTLY from the current "
            "template (indentation included) with enough context to match exactly once, "
            "and change ONLY what's asked"
        )
        return (
            f"{_format_history(payload.get('history') or [])}"
            "First decide what the instruction is:\n"
            "- A QUESTION (explain / compare / justify — e.g. 'why is the DB single-AZ?', "
            "'what does this SG do?'): ANSWER it, leave the template unchanged, use the "
            "===ANSWER=== format.\n"
            f"- A CHANGE (add/remove/modify something): {change_fmt}.\n"
            "Call NO tools either way — the backend runs cfn-lint and will send any "
            "errors back for you to fix.\n\n"
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
    # The caller picks the model per slot (generate / chat) and sends its key;
    # fall back to the mode default if absent or unknown.
    default_key = DEFAULT_REFINE if mode == "refine" else DEFAULT_GENERATE
    model_id = resolve_model_id(payload.get("model"), default_key)
    log.info("IacArchitect invoked (mode=%s, model=%s)", mode, model_id)

    try:
        agent = build_agent(model_id)
        user_message = _build_user_message(payload)

        # Stream the model, only emitting the parsed result at the end. A generate can
        # run for minutes; if the HTTP response stays byte-silent the runtime's load
        # balancer idle-times-out and resets the connection, so we emit a heartbeat
        # whenever the model is quiet for 15s.
        #
        # The whole stream is consumed inside ONE task (`_pump`) that feeds a queue, and
        # only the queue read is raced against the heartbeat timeout. Racing each `anext`
        # in its own task (the previous approach) copied the asyncio context per step, so
        # strands' `current_context` ContextVar — set/reset around every MCP tool call —
        # was reset in a different context than it was set in, raising
        # "ValueError: <Token ...> was created in a different Context" on every tool call.
        # Keeping the stream on a single context fixes that.
        full_text = ""
        queue: asyncio.Queue = asyncio.Queue()
        _DONE = object()

        async def _pump():
            try:
                async for ev in agent.stream_async(user_message):
                    await queue.put(("event", ev))
            except Exception as exc:  # noqa: BLE001 — forward to the consumer below
                await queue.put(("error", exc))
            finally:
                await queue.put(("done", _DONE))

        pump = asyncio.ensure_future(_pump())
        getter = None
        try:
            while True:
                if getter is None:
                    getter = asyncio.ensure_future(queue.get())
                done, _ = await asyncio.wait({getter}, timeout=15)
                if not done:
                    yield json.dumps({"__heartbeat__": True})
                    continue
                kind, item = getter.result()
                getter = None
                if kind == "done":
                    break
                if kind == "error":
                    # AccessDenied (model not enabled), Throttling, tool-call failures →
                    # surface a structured error so the frontend shows a useful message.
                    log.error("IacArchitect stream error (model=%s): %s", model_id, item)
                    yield json.dumps({"error": str(item), "template": ""})
                    return
                if "data" in item and isinstance(item["data"], str):
                    full_text += item["data"]
        finally:
            for _t in (pump, getter):
                if _t is not None and not _t.done():
                    _t.cancel()

        if not full_text.strip():
            # The model produced heartbeats but no text — most likely the model isn't
            # enabled in Bedrock Model Access, or doesn't support this call format.
            err = (
                f"Model '{model_id}' returned no output. "
                "Ensure it is enabled in Bedrock Model Access and supports Converse tool use."
            )
            log.error("IacArchitect: %s", err)
            yield json.dumps({"error": err, "template": ""})
            return

        result = _parse_output(full_text)
        yield json.dumps(result)

    except Exception as exc:
        log.exception("IacArchitect invoke failed (model=%s): %s", model_id, exc)
        yield json.dumps({"error": str(exc), "template": ""})


if __name__ == "__main__":
    app.run()
