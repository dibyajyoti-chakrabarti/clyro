"""AWS Lambda handler exposing the awslabs AWS Documentation MCP server as an
AgentCore Gateway Lambda target.

The gateway invokes this Lambda once per tool call. It passes the tool
arguments as the event payload and the fully-qualified tool name as
``context.client_context.custom['bedrockAgentCoreToolName']`` in the form
``<targetName>___<toolName>``. We strip the target prefix, dispatch to the
bundled FastMCP instance, and return a JSON-serializable result that the
gateway wraps back into MCP tool content.

We import the global-partition (``aws``) server instance directly so no live
MCP session is required. Only the Step-3 curated tools in ``ALLOWED_TOOLS`` are
dispatchable here.
"""

import asyncio
import json
import os
import sys

# We import server_aws directly (below) and therefore skip the package's
# server.py, which is what normally configures loguru from FASTMCP_LOG_LEVEL.
# Configure it here so CloudWatch isn't flooded with DEBUG output.
try:  # best-effort; loguru ships as a transitive dep of the docs server
    from loguru import logger as _loguru_logger

    _loguru_logger.remove()
    _loguru_logger.add(sys.stderr, level=os.getenv("FASTMCP_LOG_LEVEL", "WARNING"))
except Exception:  # pragma: no cover - logging config is non-critical
    pass

# Global ('aws') partition instance — the package's server.py selects this via
# AWS_DOCUMENTATION_PARTITION at runtime; we import it directly for Lambda.
from awslabs.aws_documentation_mcp_server.server_aws import mcp

# Step-3 curated subset for this target (see tools.json).
ALLOWED_TOOLS = {"search_documentation", "read_documentation", "recommend"}


def _extract_tool_name(context):
    """Pull the bare tool name out of the AgentCore Gateway client context.

    The gateway sends ``<targetName>___<toolName>``; we want only the suffix.
    """
    client_context = getattr(context, "client_context", None)
    custom = getattr(client_context, "custom", None) if client_context else None
    if not custom:
        return None
    raw = custom.get("bedrockAgentCoreToolName")
    if not raw:
        return None
    return raw.split("___", 1)[1] if "___" in raw else raw


def _unwrap_blocks(blocks):
    """Flatten a list of MCP content blocks into JSON or text."""
    texts = []
    for block in blocks:
        text = getattr(block, "text", None)
        if text is None:
            dump = getattr(block, "model_dump", None)
            texts.append(dump(mode="json") if dump else str(block))
        else:
            texts.append(text)
    if len(texts) == 1:
        try:
            return json.loads(texts[0])
        except (ValueError, TypeError):
            return texts[0]
    return texts


def _to_jsonable(result):
    """Normalize a FastMCP ``call_tool`` result into a JSON-serializable value.

    ``FastMCP.call_tool`` (convert_result=True) can return any of:
      * a ``CallToolResult`` (tools that build their own result object),
      * a ``(unstructured_content, structured_dict)`` tuple (tool declares an
        output schema), or
      * a list of content blocks (e.g. ``TextContent``) otherwise.
    Prefer the structured output; otherwise unwrap text blocks (parsing JSON
    text when possible).
    """
    structured = getattr(result, "structuredContent", None)
    if structured is not None:
        return structured
    result_content = getattr(result, "content", None)
    if isinstance(result_content, list):
        return _unwrap_blocks(result_content)
    if isinstance(result, tuple) and len(result) == 2:
        return result[1]
    if isinstance(result, list):
        return _unwrap_blocks(result)
    return result


def handler(event, context):
    """Lambda entrypoint dispatched by the AgentCore Gateway."""
    tool_name = _extract_tool_name(context)
    if not tool_name:
        return {"error": "Missing bedrockAgentCoreToolName in client context"}
    if tool_name not in ALLOWED_TOOLS:
        return {"error": f"Tool '{tool_name}' is not exposed by this target"}

    arguments = event if isinstance(event, dict) else {}
    try:
        result = asyncio.run(mcp.call_tool(tool_name, arguments))
    except Exception as exc:  # surface tool errors to the model as readable text
        return {"error": f"Tool '{tool_name}' failed: {exc}"}
    return _to_jsonable(result)
