"""Shared helpers for invoking AgentCore runtimes from Django.

One place for the boto3 ``invoke_agent_runtime`` call + SSE-response parsing,
used by both the Step 3 canvas (Reasoning runtime) and the Step 1 scan
(RepoRecon runtime). Each deployed runtime returns the same ``text/event-stream``
framing, so the parsing is identical.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3
from botocore.config import Config
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

# AgentCore runtime calls are long-running: the agent makes several LLM + tool
# calls (e.g. IacArchitect authors a full CFN template, then loops validate +
# cfn-guard), and the first invoke pays a cold start. boto3's default 60s read
# timeout trips well before that, so give the streaming read a generous window
# and disable retries (these calls aren't idempotent — a retry re-runs the agent).
_RUNTIME_CONFIG = Config(
    connect_timeout=10,
    read_timeout=600,
    retries={"max_attempts": 0},
)


def require_runtime_arn(name: str) -> str:
    """Return the AgentCore runtime ARN named ``name`` from settings, or raise a
    clear, console-logged error when it isn't configured. There is no local
    fallback — the agents run only on their deployed runtimes."""
    arn = getattr(settings, name, "")
    if not arn:
        msg = (
            f"Missing required environment variable {name}. Set it to the deployed "
            f"AgentCore runtime ARN in backend/.env.local "
            f"(e.g. {name}=arn:aws:bedrock-agentcore:<region>:<account>:runtime/<RuntimeId>)."
        )
        logger.error(msg)
        raise ImproperlyConfigured(msg)
    return arn


def parse_runtime_response(raw: bytes | str) -> dict[str, Any]:
    """Parse an AgentCore Runtime reply. A streaming entrypoint returns
    ``text/event-stream`` framing (``data: <chunk>\\n\\n``) and each yielded JSON
    string is itself JSON-encoded by the SSE layer (double-encoded). Each yielded
    value is single-line JSON, so one ``data:`` line is one event: decode each, drop
    keepalive heartbeats (``{"__heartbeat__": true}``, which IacArchitect emits during
    long generations to keep the stream from idle-timing-out), and return the last
    real result. Falls back to the legacy join-all decode for a single value that
    happens to span multiple ``data:`` lines."""
    text = (raw.decode() if isinstance(raw, bytes) else raw).strip()
    data_lines = [
        line[len("data:"):].strip()
        for line in text.splitlines()
        if line.strip().startswith("data:")
    ]

    events: list[Any] | None = []
    try:
        for line in (data_lines or [text]):
            if not line:
                continue
            obj = json.loads(line)
            events.append(json.loads(obj) if isinstance(obj, str) else obj)
    except (ValueError, TypeError):
        events = None  # a value spanned multiple data lines — use the join fallback

    if events:
        real = [e for e in events if not (isinstance(e, dict) and e.get("__heartbeat__"))]
        return (real or events)[-1]

    payload = "".join(data_lines) if data_lines else text
    obj = json.loads(payload)
    if isinstance(obj, str):  # double-encoded: decode once more to the object
        obj = json.loads(obj)
    return obj


# A warm-up ping should return almost instantly (the agent short-circuits
# mode='warmup'); keep its window tight so a slow/cold runtime can't make the
# fire-and-forget call hang.
_WARMUP_CONFIG = Config(connect_timeout=5, read_timeout=45, retries={"max_attempts": 0})


def warm_runtime(name: str, session_id: str) -> None:
    """Best-effort: fire a cheap ``mode='warmup'`` ping so the runtime container is
    hot before the user's real call (cold vs warm is ~17s vs ~3s). Swallows every
    error — warming must NEVER break the flow it's meant to speed up. The agent
    returns immediately for a warmup payload without an LLM/tool round; if the ARN
    isn't configured, this is a no-op."""
    try:
        arn = require_runtime_arn(name)
    except ImproperlyConfigured:
        return
    try:
        client = boto3.client("bedrock-agentcore", region_name=settings.AWS_REGION, config=_WARMUP_CONFIG)
        client.invoke_agent_runtime(
            agentRuntimeArn=arn,
            qualifier="DEFAULT",
            runtimeSessionId=session_id,
            payload=json.dumps({"mode": "warmup"}).encode(),
        )
    except Exception as exc:  # noqa: BLE001 — warming is best-effort
        logger.info("runtime warm-up skipped (%s)", exc)


def invoke_runtime(arn: str, payload: dict, session_id: str) -> dict[str, Any]:
    """Invoke a deployed AgentCore runtime and return the parsed JSON reply.

    ``session_id`` must be at least 33 characters for AgentCore — a project UUID
    (36 chars) satisfies this.
    """
    client = boto3.client("bedrock-agentcore", region_name=settings.AWS_REGION, config=_RUNTIME_CONFIG)
    response = client.invoke_agent_runtime(
        agentRuntimeArn=arn,
        qualifier="DEFAULT",
        runtimeSessionId=session_id,
        payload=json.dumps(payload).encode(),
    )
    return parse_runtime_response(response["response"].read())


def invoke_runtime_streaming(arn: str, payload: dict, session_id: str, on_event) -> dict[str, Any]:
    """Like ``invoke_runtime`` but consume the SSE stream INCREMENTALLY: decode each
    ``data:`` event as it arrives and hand it to ``on_event(event)`` (heartbeats
    dropped), so a long generation can surface partial progress. Returns the last
    real event — the final result — identical to ``invoke_runtime``'s return."""
    client = boto3.client("bedrock-agentcore", region_name=settings.AWS_REGION, config=_RUNTIME_CONFIG)
    response = client.invoke_agent_runtime(
        agentRuntimeArn=arn,
        qualifier="DEFAULT",
        runtimeSessionId=session_id,
        payload=json.dumps(payload).encode(),
    )
    last: Any = None
    buffer = ""

    def _handle_line(line: str) -> None:
        nonlocal last
        line = line.strip()
        if not line.startswith("data:"):
            return
        raw = line[len("data:"):].strip()
        if not raw:
            return
        try:
            obj = json.loads(raw)
            event = json.loads(obj) if isinstance(obj, str) else obj
        except (ValueError, TypeError):
            return  # a value split across chunks that didn't reassemble cleanly — skip
        if isinstance(event, dict) and event.get("__heartbeat__"):
            return
        last = event
        try:
            on_event(event)
        except Exception:  # noqa: BLE001 — a progress-callback error must never kill the stream
            logger.exception("invoke_runtime_streaming on_event callback failed")

    for chunk in response["response"].iter_chunks():
        # A data: line can split across chunk boundaries — buffer and only process
        # complete lines (up to the last newline), keeping the partial tail.
        buffer += chunk.decode() if isinstance(chunk, (bytes, bytearray)) else chunk
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            _handle_line(line)
    if buffer.strip():
        _handle_line(buffer)
    return last if last is not None else {}
