import os

from strands.models.bedrock import BedrockModel

# Curated, user-selectable models (key -> Bedrock model id / cross-region profile).
# Strands' BedrockModel is provider-agnostic (Converse API), so each is just an id.
# NOTE: every model must be enabled in Bedrock "Model access" for ap-south-1 before
# use, and must support Converse tool use (generate calls validate/compliance) plus
# the delimited output contract — weaker models may need a smoke test first.
MODELS = {
    # Claude — cross-region inference profiles; enable in Bedrock Model Access.
    "sonnet-4-5": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "haiku-4-5": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    # Agentic, tool-tuned open models — run the FULL toolful path (self-correct via
    # cfn-lint/cfn-guard). In-Region in ap-south-1 (plain ids; verified via
    # `aws bedrock list-foundation-models --region ap-south-1`). Kimi/MiniMax/GLM tested
    # clean (0 errors / 0 warnings); DeepSeek added to test the same. Nova/Qwen were
    # dropped — toolless, they produced invalid templates or hit output-token caps.
    "kimi-k2-5": "moonshotai.kimi-k2.5",
    "minimax-m2-5": "minimax.minimax-m2.5",
    "glm-5": "zai.glm-5",
    "deepseek-v3-2": "deepseek.v3.2",
}

# Defaults by mode when the caller doesn't pick a model.
#
# These were Sonnet for generate and Haiku for refine. Anthropic ids currently
# fail on this account with AccessDeniedException / INVALID_PAYMENT_INSTRUMENT,
# which is a billing state on the AWS account rather than a missing capability,
# so the Anthropic entries above are kept and will work again the moment the
# payment instrument is valid. Only the defaults move.
#
# MiniMax generates because it reasons natively, so the Step-4 "Thinking..."
# UX survives the switch without Anthropic extended thinking (see load_model).
# GLM refines because refine is the short, frequent call. Both are in
# _TOOLFUL_FAMILIES and were verified clean on the full cfn-lint/cfn-guard
# self-correction path.
#
# Overridable by environment so the base model can be changed with a runtime
# variable instead of a code change and redeploy. An unknown key would make
# resolve_model_id fall back to itself and recurse, so validate here at import.
DEFAULT_GENERATE = os.getenv("IAC_DEFAULT_GENERATE_MODEL", "minimax-m2-5")
DEFAULT_REFINE = os.getenv("IAC_DEFAULT_REFINE_MODEL", "glm-5")

for _slot, _key in (("IAC_DEFAULT_GENERATE_MODEL", DEFAULT_GENERATE),
                    ("IAC_DEFAULT_REFINE_MODEL", DEFAULT_REFINE)):
    if _key not in MODELS:
        raise ValueError(
            f"{_slot}={_key!r} is not a known model key. Choose one of: "
            f"{', '.join(sorted(MODELS))}."
        )


def resolve_model_id(key: str | None, default_key: str) -> str:
    """Map a user-supplied model key to a Bedrock id, falling back to the mode
    default for unknown/missing keys — never trust an arbitrary id off the wire."""
    return MODELS.get(key or "", MODELS[default_key])


def load_model(model_id: str, thinking: bool = False) -> BedrockModel:
    """Bedrock model client (IAM credentials) for a resolved model id.

    ``thinking`` turns on Claude extended thinking (Anthropic models only — the field
    is unsupported/ignored elsewhere; MiniMax reasons natively regardless) so the
    reasoning streams for the Step-4 'Thinking…' UX. Extended thinking requires an
    explicit max_tokens greater than the thinking budget; 16k comfortably fits both a
    ~2k-token thinking pass and a large (~50k-char) template."""
    if thinking and "anthropic" in model_id:
        return BedrockModel(
            model_id=model_id,
            max_tokens=16000,
            additional_request_fields={"thinking": {"type": "enabled", "budget_tokens": 2048}},
        )
    return BedrockModel(model_id=model_id)
