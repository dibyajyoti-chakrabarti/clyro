"""Step 3 canvas chat persistence via AgentCore Memory.

The canvas conversation is ephemeral working state — it only needs to survive a
browser refresh while editing, and is flushed when the canvas is finalized. We
store it as raw conversation events in AgentCore Memory (no long-term strategy),
keyed by the project id, using the same boto3 ``bedrock-agentcore`` data-plane
client the backend already uses for ``invoke_agent_runtime``.

Every call degrades to a no-op when ``AGENTCORE_MEMORY_ID`` is unset (local dev /
pre-provision), so the UI keeps working without persistence, and a memory API
failure never breaks the canvas request.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import boto3
from django.conf import settings

logger = logging.getLogger(__name__)


def _enabled() -> bool:
    return bool(getattr(settings, "AGENTCORE_MEMORY_ID", ""))


def _client():
    return boto3.client("bedrock-agentcore", region_name=settings.AWS_REGION)


def _keys(project) -> tuple[str, str]:
    # The conversation is project-scoped; project id (a 36-char UUID) is a valid
    # actor/session key. Returns (actor_id, session_id).
    pid = str(project.id)
    return pid, pid


def save_exchange(project, *, user_text: str | None = None, agent_payload: dict | None = None) -> None:
    """Persist one chat exchange. The user prompt is stored as plain text; the
    agent reply is stored as the JSON-encoded ``{outcome, message, operation?,
    cost_*}`` so the displayed message *and* the pending Apply/Deny state can be
    restored on refresh. (We use the event text, not metadata — AgentCore event
    metadata only allows ``[a-zA-Z0-9 ._:/=+@-]``, which can't hold JSON.)"""
    if not _enabled():
        return
    payload: list[dict] = []
    if user_text:
        payload.append({"conversational": {"content": {"text": user_text}, "role": "USER"}})
    if agent_payload is not None:
        payload.append({"conversational": {"content": {"text": json.dumps(agent_payload)}, "role": "ASSISTANT"}})
    if not payload:
        return
    actor, session = _keys(project)
    try:
        _client().create_event(
            memoryId=settings.AGENTCORE_MEMORY_ID,
            actorId=actor,
            sessionId=session,
            eventTimestamp=datetime.now(timezone.utc),
            payload=payload,
        )
    except Exception:  # never break the request on a memory failure
        logger.exception("canvas chat save_exchange failed")


def _parse_events(events: list[dict]) -> dict[str, Any]:
    """Turn raw ListEvents output into the frontend shape (pure — unit-testable).
    User turns are plain text; agent turns are JSON-encoded payloads, so we parse
    them to recover the display message and the latest pending proposal."""
    ordered = sorted(events, key=lambda e: e.get("eventTimestamp"))
    messages: list[dict] = []
    last_data: dict | None = None
    for ev in ordered:
        for item in ev.get("payload", []):
            conv = item.get("conversational")
            if not conv:
                continue
            raw = (conv.get("content") or {}).get("text", "")
            if conv.get("role") == "USER":
                if raw:
                    messages.append({"role": "user", "text": raw})
            else:  # ASSISTANT — a JSON payload
                try:
                    data = json.loads(raw)
                except (ValueError, TypeError):
                    data = {"message": raw}
                if data.get("message"):
                    messages.append({"role": "agent", "text": data["message"]})
                last_data = data
    pending = last_data.get("operation") if last_data and last_data.get("outcome") == "proposal" else None
    return {"messages": messages, "pending_operation": pending}


def load_chat(project) -> dict[str, Any]:
    """Return ``{"messages": [{role, text}], "pending_operation": {...}|None}`` for
    restoring the chat on mount."""
    if not _enabled():
        return {"messages": [], "pending_operation": None}
    actor, session = _keys(project)
    try:
        resp = _client().list_events(
            memoryId=settings.AGENTCORE_MEMORY_ID,
            actorId=actor,
            sessionId=session,
            includePayloads=True,
            maxResults=100,
        )
    except Exception:
        logger.exception("canvas chat load_chat failed")
        return {"messages": [], "pending_operation": None}
    return _parse_events(resp.get("events", []))


def flush(project) -> None:
    """Delete the project's canvas conversation — the "Clear conversation" button
    and the post-finalize cleanup."""
    if not _enabled():
        return
    actor, session = _keys(project)
    client = _client()
    try:
        resp = client.list_events(
            memoryId=settings.AGENTCORE_MEMORY_ID,
            actorId=actor,
            sessionId=session,
            includePayloads=False,
            maxResults=100,
        )
    except Exception:
        logger.exception("canvas chat flush list failed")
        return
    for ev in resp.get("events", []):
        try:
            client.delete_event(
                memoryId=settings.AGENTCORE_MEMORY_ID,
                actorId=actor,
                sessionId=session,
                eventId=ev["eventId"],
            )
        except Exception:
            logger.exception("canvas chat flush delete failed for %s", ev.get("eventId"))
