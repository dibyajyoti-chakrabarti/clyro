"""
Pre-signup Lambda trigger for Clyro Cognito User Pool.

Problem it solves: when a user signs up via email/password AND later (or
previously) signs in via Google (or GitHub in future), Cognito treats them as
two separate users. This trigger detects that case and links the federated
identity to the existing native user so they share one account.

Flow:
  1. User signs in with Google for the first time.
  2. Cognito fires PreSignUp_ExternalProvider before creating the federated user.
  3. We look up whether a native user with the same email already exists.
  4. If found → raise an exception with a specially formatted message that tells
     Cognito to link the identities instead of creating a new user.
     Format: "LINK:<existing_username>"
  5. If not found → return the event unchanged (Cognito creates the federated user
     normally and auto-verifies email).
"""

import boto3
import os

client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
USER_POOL_ID = os.environ["USER_POOL_ID"]


def handler(event, context):
    trigger_source = event.get("triggerSource", "")
    email = (
        event.get("request", {})
        .get("userAttributes", {})
        .get("email", "")
        .lower()
        .strip()
    )

    # Only intercept federated (Google / GitHub / etc.) sign-ups, not native ones.
    if not trigger_source.startswith("PreSignUp_ExternalProvider"):
        return event

    if not email:
        return event

    # Look up existing native user by email.
    existing = _find_native_user(email)

    if existing is None:
        # First time this email signs in via a social provider —
        # auto-confirm and auto-verify so Cognito doesn't block it.
        event["response"]["autoConfirmUser"] = True
        event["response"]["autoVerifyEmail"] = True
        return event

    # A native user already exists with this email. Link the federated identity.
    # Cognito expects the provider identity in the format "ProviderName_ProviderUserId".
    provider_name = event["userName"].split("_")[0]  # e.g. "Google"
    provider_user_id = "_".join(event["userName"].split("_")[1:])  # rest of it

    try:
        client.admin_link_provider_for_user(
            UserPoolId=USER_POOL_ID,
            DestinationUser={
                "ProviderName": "Cognito",
                "ProviderAttributeValue": existing["Username"],
            },
            SourceUser={
                "ProviderName": provider_name,
                "ProviderAttributeName": "Cognito_Subject",
                "ProviderAttributeValue": provider_user_id,
            },
        )
    except client.exceptions.AliasExistsException:
        # Already linked — safe to ignore.
        pass
    except Exception as e:
        # Log but don't block sign-in.
        print(f"[pre-signup] link failed for {email}: {e}")

    # Auto-confirm so Cognito completes the flow cleanly.
    event["response"]["autoConfirmUser"] = True
    event["response"]["autoVerifyEmail"] = True
    return event


def _find_native_user(email: str):
    """Return the first native (non-federated) user with this email, or None."""
    try:
        resp = client.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email = "{email}"',
            Limit=10,
        )
    except Exception as e:
        print(f"[pre-signup] list_users failed: {e}")
        return None

    for user in resp.get("Users", []):
        # Skip federated users — they have a provider prefix in their username.
        if not any(c == "_" and user["Username"].split("_")[0] in ("Google", "GitHub") for c in user["Username"]):
            return user

    return None
