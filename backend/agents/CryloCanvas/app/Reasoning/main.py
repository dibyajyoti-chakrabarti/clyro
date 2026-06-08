from __future__ import annotations

import json
import re
from typing import Any

from strands import Agent, tool
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from model.load import load_model
from mcp_client.client import get_mcp_client

from canvas_core import canvas_ops, constraints, cost_engine

app = BedrockAgentCoreApp()
log = app.logger

SYSTEM_PROMPT = """You are the Reasoning agent for Clyro's interactive architecture canvas.

You receive a user's natural-language prompt about their AWS architecture, plus the current canvas (nodes + connections as JSON) and intent (scale, criticality, environment).

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
        intent_json: The project intent (scale, criticality, environment) as a JSON string.

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
        return json.dumps({
            "ok": result.ok,
            "reason": result.reason,
            "alternative": result.alternative,
        })
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

_agent = None


def get_or_create_agent():
    global _agent
    if _agent is None:
        _agent = Agent(
            model=load_model(),
            system_prompt=SYSTEM_PROMPT,
            tools=_tools,
        )
    return _agent


@app.entrypoint
async def invoke(payload, context):
    log.info("Reasoning agent invoked")
    payload = _normalize_payload(payload)
    agent = get_or_create_agent()

    canvas = payload.get("canvas", {})
    intent = payload.get("intent", {})
    prompt = payload.get("prompt", "")

    user_message = (
        f"Canvas (JSON): {json.dumps(canvas)}\n"
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
