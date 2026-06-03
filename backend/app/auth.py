import time

import jwt
import requests
from django.conf import settings
from jwt.algorithms import RSAAlgorithm
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from core.models import User

_jwks_cache: dict = {}
_jwks_cache_time: float = 0
_JWKS_TTL = 3600


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_time
    now = time.time()
    if not _jwks_cache or (now - _jwks_cache_time) > _JWKS_TTL:
        url = (
            f'https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com'
            f'/{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json'
        )
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        keys = resp.json()['keys']
        _jwks_cache = {k['kid']: RSAAlgorithm.from_jwk(k) for k in keys}
        _jwks_cache_time = now
    return _jwks_cache


def _extract_profile(payload: dict) -> tuple[str, str, str]:
    """Pull (cognito_sub, email, display_name) from a decoded Cognito ID token."""
    cognito_sub = payload['sub']
    email = payload.get('email', '')

    # Cognito can surface the name several ways depending on which attributes
    # are configured in the User Pool.
    name = (
        payload.get('name')
        or f"{payload.get('given_name', '')} {payload.get('family_name', '')}".strip()
        or payload.get('cognito:username', '')
        or email.split('@')[0]
    )
    return cognito_sub, email, name


class CognitoAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None

        token = header[7:]
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header['kid']
            keys = _get_jwks()
            if kid not in keys:
                raise AuthenticationFailed('Unknown key ID')
            public_key = keys[kid]
            payload = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                options={'verify_aud': False},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed(str(exc))

        cognito_sub, email, name = _extract_profile(payload)

        user, created = User.objects.get_or_create(
            cognito_sub=cognito_sub,
            defaults={'email': email, 'name': name},
        )

        if not created:
            # Keep local profile in sync with latest Cognito claims.
            dirty: list[str] = []
            if email and user.email != email:
                user.email = email
                dirty.append('email')
            if name and user.name != name:
                user.name = name
                dirty.append('name')
            if dirty:
                dirty.append('updated_at')
                user.save(update_fields=dirty)

        return (user, token)
