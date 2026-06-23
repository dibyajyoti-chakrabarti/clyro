from strands.models.bedrock import BedrockModel

# Sonnet 4.5 authors the initial template (mode=generate) — the expensive,
# correctness-critical pass. Haiku 4.5 handles chat Q&A and light refine edits
# (mode=refine), which are scoped single changes: ~3x cheaper input/output and
# much faster, where most of the per-test cost was being spent.
GENERATE_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
CHAT_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"


def load_model(fast: bool = False) -> BedrockModel:
    """Get Bedrock model client using IAM credentials. ``fast=True`` returns
    Haiku for chat/refine; otherwise Sonnet for initial generation."""
    return BedrockModel(model_id=CHAT_MODEL_ID if fast else GENERATE_MODEL_ID)
