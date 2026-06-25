import logging
import os

from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

logger = logging.getLogger(__name__)


def get_mcp_client():
    # IacArchitect connects to its OWN gateway (CryloIacGw), which exposes the full
    # CloudFormation authoring toolset (validate + cfn-guard compliance + CFN doc
    # search + pre-deploy instructions) plus docs/pricing. The Step 3 Reasoning
    # gateway (CryloCanvasGw) deliberately exposes only validate, so those extra
    # tools are scoped to this agent.
    url = os.environ.get("AGENTCORE_GATEWAY_CRYLOIACGW_URL")
    if not url:
        logger.warning(
            "AGENTCORE_GATEWAY_CRYLOIACGW_URL not set — MCP tools unavailable (local dev mode)"
        )
        return None
    return MCPClient(lambda: streamablehttp_client(url))
