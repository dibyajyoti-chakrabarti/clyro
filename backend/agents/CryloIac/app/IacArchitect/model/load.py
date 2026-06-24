from strands.models.bedrock import BedrockModel

# Curated, user-selectable models (key -> Bedrock model id / cross-region profile).
# Strands' BedrockModel is provider-agnostic (Converse API), so each is just an id.
# NOTE: every model must be enabled in Bedrock "Model access" for ap-south-1 before
# use, and must support Converse tool use (generate calls validate/compliance) plus
# the delimited output contract — weaker models may need a smoke test first.
MODELS = {
    "sonnet-4-5": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "haiku-4-5": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "nova-pro": "apac.amazon.nova-pro-v1:0",
    "nova-lite": "apac.amazon.nova-lite-v1:0",
    "qwen-coder": "qwen.qwen3-coder-30b-a3b-v1:0",
}

# Defaults by mode when the caller doesn't pick a model (backward-compatible):
# Sonnet authors the initial template, Haiku handles cheap chat/refine.
DEFAULT_GENERATE = "sonnet-4-5"
DEFAULT_REFINE = "haiku-4-5"


def resolve_model_id(key: str | None, default_key: str) -> str:
    """Map a user-supplied model key to a Bedrock id, falling back to the mode
    default for unknown/missing keys — never trust an arbitrary id off the wire."""
    return MODELS.get(key or "", MODELS[default_key])


def load_model(model_id: str) -> BedrockModel:
    """Bedrock model client (IAM credentials) for a resolved model id."""
    return BedrockModel(model_id=model_id)
