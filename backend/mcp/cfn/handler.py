"""AWS Lambda handler exposing the awslabs AWS IaC MCP server as an AgentCore
Gateway Lambda target.

The gateway invokes this Lambda once per tool call. It passes the tool
arguments as the event payload and the fully-qualified tool name as
``context.client_context.custom['bedrockAgentCoreToolName']`` in the form
``<targetName>___<toolName>``. We strip the target prefix, dispatch to the
bundled FastMCP instance, and return a JSON-serializable result that the
gateway wraps back into MCP tool content.

We expose only the read-only ``validate_cloudformation_template`` tool (cfn-lint
syntax/schema/property validation, fully offline). For Step 3 the Reasoning
agent uses it to confirm a proposed architecture node maps to a real AWS
resource type with valid properties; in Step 4 the same tool validates
generated CloudFormation templates before deploy. The package's other tools
(compliance/cfn-guard, deployment troubleshooting, CDK/doc search) are
deliberately NOT exposed here — nothing this target can do mutates AWS
infrastructure.
"""

import asyncio
import json

from awslabs.aws_iac_mcp_server.server import mcp

# Step-3 curated subset for this target (read-only; see tools.json).
ALLOWED_TOOLS = {"validate_cloudformation_template"}


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
      * a ``CallToolResult`` (tools that build their own result object, as the
        IaC server does),
      * a ``(unstructured_content, structured_dict)`` tuple (tool declares an
        output schema), or
      * a list of content blocks (e.g. ``TextContent``) otherwise.
    Prefer structured output; otherwise unwrap text blocks (parsing JSON text
    when possible).
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
