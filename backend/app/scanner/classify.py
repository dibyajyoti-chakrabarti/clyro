"""Environment-variable classification — the one part of Step 1's detection
Clyro keeps owning after the scan moved offline.

``CLYRO.md`` is authored by an agent on the user's machine and is hand-editable,
so its `classification` field is a claim, not a fact. For most keys we take that
claim: only the offline agent can see that `STRIPE_SECRET_KEY` is a third-party
secret. But for the keys Clyro's own infrastructure provisions, the claim is not
the agent's to make — a contract saying `DATABASE_URL: user_secret` would make
the wizard prompt the user to type a connection string that Clyro generates
itself at deploy time, and whatever they typed would be overwritten.

So: Clyro wins on the keys it owns, the contract wins on everything else.

Extracted verbatim from the retired ``deterministic_detector`` so the platform
keeps classifying identically to how it did when it scanned repos itself.
"""

from __future__ import annotations

GENERATED_ENV_KEYS = {
    "DATABASE_URL", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND",
    "AWS_STORAGE_BUCKET_NAME", "DEFAULT_FILE_STORAGE",
}
OPTIONAL_ENV_KEYS = {"DEBUG", "ALLOWED_HOSTS"}

# A key whose usage sits inside a DATABASES/CACHES block is wired to
# infrastructure Clyro provisions, whatever it happens to be named.
_GENERATED_CONTEXT_MARKERS = ("DATABASES", "CACHES")

VALID_CLASSIFICATIONS = {"generated", "optional", "user_secret"}


def classify(key: str, context: str | None = None) -> str:
    """Clyro's own view of a key, ignoring any external claim."""
    if key in GENERATED_ENV_KEYS:
        return "generated"
    if key in OPTIONAL_ENV_KEYS:
        return "optional"
    if any(marker in (context or "").upper() for marker in _GENERATED_CONTEXT_MARKERS):
        return "generated"
    return "user_secret"


def is_clyro_owned(key: str) -> bool:
    """True when Clyro provisions or defaults this key, making the contract's
    classification for it non-authoritative."""
    return key in GENERATED_ENV_KEYS or key in OPTIONAL_ENV_KEYS


def effective_classification(key: str, context: str | None, declared: str | None) -> str:
    """Reconcile a contract's declared classification with Clyro's own.

    Clyro's answer wins for keys it owns; otherwise the contract's declaration
    stands, since it was made with full sight of the user's code. An unusable
    declaration falls back to Clyro's inference rather than failing — validation
    has already reported it, and refusing to ingest over one bad enum would
    block a deploy for no safety gain.
    """
    if is_clyro_owned(key):
        return classify(key, context)
    if declared in VALID_CLASSIFICATIONS:
        return declared
    return classify(key, context)
