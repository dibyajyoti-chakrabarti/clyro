import logging
import os

from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

logger = logging.getLogger(__name__)


def get_mcp_client():
    url = os.environ.get("AGENTCORE_GATEWAY_CRYLOCANVASGW_URL")
    if not url:
        logger.warning(
            "AGENTCORE_GATEWAY_CRYLOCANVASGW_URL not set — MCP tools unavailable (local dev mode)"
        )
        return None
    return MCPClient(lambda: streamablehttp_client(url))
