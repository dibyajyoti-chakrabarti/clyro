import logging
import os

from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

logger = logging.getLogger(__name__)


def get_mcp_client():
    # IacArchitect connects to its OWN gateway (CryloIacGw), which exposes
    # validate_cloudformation_template (cfn-lint) and search_documentation/
    # read_documentation (AWS docs, for the narrow class of fact — CloudFront policy
    # IDs, current RDS engine versions — that's a specific current VALUE rather than a
    # schema question; see _AUTHORING_RULES/TOOLS in main.py). The Step 3 Reasoning
    # gateway (CryloCanvasGw) deliberately exposes only validate, so the docs tool is
    # scoped to this agent.
    url = os.environ.get("AGENTCORE_GATEWAY_CRYLOIACGW_URL")
    if not url:
        logger.warning(
            "AGENTCORE_GATEWAY_CRYLOIACGW_URL not set — MCP tools unavailable (local dev mode)"
        )
        return None
    return MCPClient(lambda: streamablehttp_client(url))
