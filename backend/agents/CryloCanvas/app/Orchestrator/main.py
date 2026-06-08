from __future__ import annotations

import json
import os

import boto3
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
log = app.logger

REASONING_ARN = os.environ.get("REASONING_AGENT_RUNTIME_ARN", "")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")


def _invoke_agent(arn: str, payload: dict, session_id: str) -> dict:
    client = boto3.client("bedrock-agentcore", region_name=AWS_REGION)
    response = client.invoke_agent_runtime(
        agentRuntimeArn=arn,
        qualifier="DEFAULT",
        runtimeSessionId=session_id,
        payload=json.dumps(payload).encode(),
    )
    body = response["response"].read()
    text = body.decode() if isinstance(body, bytes) else body
    return json.loads(text)


def _normalize_payload(payload):
    """Accept both the raw structured dict the Django backend sends via boto3 and
    the ``agentcore invoke`` CLI shape, which wraps all input as
    ``{"prompt": "<your-input>"}``. A structured payload passed to the CLI then
    arrives as a JSON string under ``prompt``; unwrap it. A natural-language
    prompt (doesn't start with ``{``) is left untouched."""
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


@app.entrypoint
async def invoke(payload, context):
    """Entrypoint for the canvas sub-network.

    - **New prompt** (``confirm`` false): delegate to the Reasoning runtime (the
      only agent that needs an LLM) and return its ``{outcome, message,
      operation?, cost_*}`` result.
    - **Confirmed mutation** (``confirm`` + ``pending_operation``): the change is
      pure deterministic ``canvas_core`` work, so just echo the operation back as
      ``{outcome: "applied", operation}``. The Django backend applies it via
      ``canvas_core`` and persists the new ``CanvasVersion`` (the DB is the system
      of record). No separate Layout runtime is needed for that.

    Payload from Django: ``{prompt, confirm, pending_operation, canvas, intent, session_id?}``.
    """
    log.info("Orchestrator agent invoked")
    payload = _normalize_payload(payload)

    prompt = payload.get("prompt", "")
    confirm = payload.get("confirm", False)
    pending_operation = payload.get("pending_operation")
    canvas = payload.get("canvas", {})
    intent = payload.get("intent", {})
    session_id = payload.get("session_id", "default")

    if confirm and pending_operation:
        yield json.dumps({"outcome": "applied", "operation": pending_operation})
        return

    if not REASONING_ARN:
        yield json.dumps({"outcome": "answer", "message": "Reasoning agent ARN not configured."})
        return
    result = _invoke_agent(
        REASONING_ARN,
        {"prompt": prompt, "canvas": canvas, "intent": intent},
        session_id,
    )
    yield json.dumps(result)


if __name__ == "__main__":
    app.run()
