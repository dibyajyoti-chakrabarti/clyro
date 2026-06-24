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
