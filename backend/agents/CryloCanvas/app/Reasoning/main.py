from __future__ import annotations

import json
import re
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent, tool

from canvas_core import canvas_ops, constraints, cost_engine
from mcp_client.client import get_mcp_client
from model.load import load_model

app = BedrockAgentCoreApp()
log = app.logger

SYSTEM_PROMPT = """You are the Reasoning agent for Clyro's interactive architecture canvas.

You receive a user's natural-language prompt about their AWS architecture, plus the current canvas (nodes + connections as JSON) and intent (scale, environment, and the target AWS account type — paid vs free_tier). A free_tier target means the user wants to stay within free/low-cost limits, so favor the smallest, cheapest resources and call out cost in every proposal.

Your job: produce EXACTLY ONE of two outcomes — a proposal or an answer. Never both.

**Proposal** — when the user wants to change something on the canvas:
- Call check_constraint first to verify the change is allowed.
- If allowed, call estimate_cost_delta to compute the cost impact.
- If a constraint blocks it, return outcome="answer" explaining why.

**Answer** — when the user wants information, comparison, or explanation (no mutation).

Use the MCP tools (pricing, docs, cfn validation) when you need live AWS data.

Output ONLY a raw JSON object. No markdown fences, no preamble, no trailing text.

Answer format:
  {"outcome": "answer", "message": "..."}

Proposal format:
  {"outcome": "proposal", "message": "...", "operation": {...}, "cost_before": N, "cost_after": N, "cost_delta": N}

Operation shapes:
  UPDATE_NODE:       {"op": "UPDATE_NODE", "target_node": "<id>", "params": {"aws_service": "<value>"}}
  REMOVE_NODE:       {"op": "REMOVE_NODE", "target_node": "<id>"}
  ADD_NODE:          {"op": "ADD_NODE", "params": {"node": {"id": ..., "label": ..., "type": ..., "aws_service": ...}}}
  ADD_CONNECTION:    {"op": "ADD_CONNECTION", "params": {"from": "<id>", "to": "<id>", "label": "..."}}
  REMOVE_CONNECTION: {"op": "REMOVE_CONNECTION", "params": {"from": "<id>", "to": "<id>"}}

Hard constraints (never violate):
- Cannot remove the backend node.
- Cannot remove a node with "locked": true — these map to services detected in the user's codebase, so the app depends on them. Never propose REMOVE_NODE for a locked node; explain the dependency and offer to change its service type instead.
- Cannot add networking nodes (ALB, VPC, subnets, security groups) — those are Step 4 concerns.
- Cannot change image: ecr on service/worker nodes.
- Node types: service, static, database, cache, worker, queue, storage only.
- aws_service must be from the allowed enum for the node type.

Keep messages concise and specific to the user's canvas and intent. Every proposal must state the cost impact.
"""


@tool
def estimate_cost_delta(canvas_json: str, operation_json: str, intent_json: str) -> str:
    """Compute the monthly cost delta for a proposed canvas operation.

    Args:
        canvas_json: Current canvas as a JSON string.
        operation_json: The proposed operation as a JSON string.
        intent_json: The project intent (scale, environment, aws_account_type) as a JSON string.

    Returns:
        JSON string: {"before": int, "after": int, "delta": int}
    """
    try:
        canvas = json.loads(canvas_json)
        operation = json.loads(operation_json)
        intent = json.loads(intent_json)
        after_canvas, _ = canvas_ops.apply_operation(canvas, operation)
        delta = cost_engine.cost_delta(canvas, after_canvas, intent)
        return json.dumps(delta)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def check_constraint(canvas_json: str, operation_json: str) -> str:
    """Check whether a canvas operation is permitted by the hard constraints.

    Args:
        canvas_json: Current canvas as a JSON string.
        operation_json: The operation to validate as a JSON string.

    Returns:
        JSON string: {"ok": bool, "reason": str|null, "alternative": str|null}
    """
    try:
        canvas = json.loads(canvas_json)
        operation = json.loads(operation_json)
        result = constraints.check_operation(canvas, operation)
        return json.dumps(
            {
                "ok": result.ok,
                "reason": result.reason,
                "alternative": result.alternative,
            }
        )
    except Exception as exc:
        return json.dumps({"ok": False, "reason": str(exc), "alternative": None})


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {"outcome": "answer", "message": text or "I couldn't process that request."}


def _normalize_payload(payload: Any) -> dict[str, Any]:
    """Accept both invocation shapes:

    - the raw structured dict the Django backend sends via boto3
      (``{"prompt": "<NL>", "canvas": {...}, "intent": {...}}``), and
    - the ``agentcore invoke`` CLI shape, which wraps all input as
      ``{"prompt": "<your-input>"}`` — so a structured payload arrives as a
      JSON *string* nested under ``prompt``.

    A natural-language prompt (doesn't start with ``{``) is left untouched.
    """
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


mcp_client = get_mcp_client()

_tools: list[Any] = [estimate_cost_delta, check_constraint]
if mcp_client:
    _tools.append(mcp_client)

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = load_model()
    return _model


def build_agent():
    # Fresh agent per call. The runtime may keep this module warm across
    # invocations (and across projects), so reusing one Agent would leak its
    # accumulated message history between unrelated requests. Building a new one
    # keeps each call clean — the only conversation context is what we inject
    # below from the caller-supplied history.
    return Agent(model=_get_model(), system_prompt=SYSTEM_PROMPT, tools=_tools)


def _format_history(history: list) -> str:
    lines = []
    for turn in history[-8:]:
        if not isinstance(turn, dict):
            continue
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        role = "User" if turn.get("role") == "user" else "Assistant"
        lines.append(f"{role}: {text}")
    return "Conversation so far:\n" + "\n".join(lines) + "\n\n" if lines else ""


@app.entrypoint
async def invoke(payload, context):
    log.info("Reasoning agent invoked")
    payload = _normalize_payload(payload)
    agent = build_agent()

    canvas = payload.get("canvas", {})
    intent = payload.get("intent", {})
    prompt = payload.get("prompt", "")
    history = payload.get("history") or []

    user_message = (
        f"{_format_history(history)}"
        f"Current canvas (JSON): {json.dumps(canvas)}\n"
        f"Intent (JSON): {json.dumps(intent)}\n"
        f"User prompt: {prompt}\n\n"
        "Output a single JSON object only."
    )

    full_text = ""
    async for event in agent.stream_async(user_message):
        if "data" in event and isinstance(event["data"], str):
            full_text += event["data"]

    result = _extract_json(full_text)
    yield json.dumps(result)


if __name__ == "__main__":
    app.run()
