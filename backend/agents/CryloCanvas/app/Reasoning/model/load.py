import os

from strands.models.bedrock import BedrockModel

# Bedrock ids the Canvas reasoning agent may run on. Keyed so the runtime
# variable stays a short, validated name rather than an arbitrary id.
#
# This was hardcoded to Claude Sonnet 4.5. Anthropic ids currently fail on this
# AWS account with AccessDeniedException / INVALID_PAYMENT_INSTRUMENT, which is
# a billing state rather than a missing capability, so Sonnet is kept here and
# becomes selectable again as soon as the payment instrument is valid.
#
# MiniMax is the default because it reasons natively and was verified clean on
# the IaC agent's toolful path, which is the harder of the two workloads.
MODELS = {
    "sonnet-4-5": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "minimax-m2-5": "minimax.minimax-m2.5",
    "kimi-k2-5": "moonshotai.kimi-k2.5",
    "glm-5": "zai.glm-5",
    "deepseek-v3-2": "deepseek.v3.2",
}

DEFAULT_MODEL = os.getenv("CANVAS_MODEL", "minimax-m2-5")

if DEFAULT_MODEL not in MODELS:
    raise ValueError(
        f"CANVAS_MODEL={DEFAULT_MODEL!r} is not a known model key. "
        f"Choose one of: {', '.join(sorted(MODELS))}."
    )


def load_model() -> BedrockModel:
    """Get Bedrock model client using IAM credentials."""
    return BedrockModel(model_id=MODELS[DEFAULT_MODEL])
