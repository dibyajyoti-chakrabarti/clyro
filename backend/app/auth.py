import logging
import time

import jwt
import requests
from django.conf import settings
from django.db import IntegrityError
from jwt.algorithms import RSAAlgorithm
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from core.models import User

logger = logging.getLogger(__name__)

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
        logger.debug('Fetching JWKS from %s', url)
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        keys = resp.json()['keys']
        _jwks_cache = {k['kid']: RSAAlgorithm.from_jwk(k) for k in keys}
        _jwks_cache_time = now
        logger.debug('JWKS loaded, kids: %s', list(_jwks_cache.keys()))
    return _jwks_cache


def _extract_profile(payload: dict) -> tuple[str, str, str, str | None]:
    cognito_sub = payload['sub']
    email = payload.get('email', '')

    name = (
        payload.get('name')
        or f"{payload.get('given_name', '')} {payload.get('family_name', '')}".strip()
        or payload.get('cognito:username', '')
        or email.split('@')[0]
    )

    picture = payload.get('picture') or None

    return cognito_sub, email, name, picture


class CognitoAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        # Returning a non-empty string makes DRF issue 401 instead of 403,
        # so clients see the actual error message.
        return 'Bearer realm="clyro"'

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
                # Stale cache — force a refresh and try once more.
                _jwks_cache.clear()
                keys = _get_jwks()
            if kid not in keys:
                logger.warning('JWT kid %s not in pool JWKS (pool: %s)', kid, settings.COGNITO_USER_POOL_ID)
                raise AuthenticationFailed('Token signing key not recognised')
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
            logger.warning('JWT validation failed: %s', exc)
            raise AuthenticationFailed(str(exc))
        except AuthenticationFailed:
            raise
        except Exception as exc:
            logger.error('Unexpected auth error: %s', exc)
            raise AuthenticationFailed('Authentication error')

        cognito_sub, email, name, picture = _extract_profile(payload)
        logger.debug('Authenticated sub=%s email=%s', cognito_sub, email)

        user = _get_or_link_user(cognito_sub, email, name, picture)
        return (user, token)


def _get_or_link_user(cognito_sub: str, email: str, name: str, picture: str | None) -> User:
    """
    Look up the Django user for this Cognito identity, creating one if needed.

    Handles the case where the email already exists under a different cognito_sub
    (e.g. user signed up with email/password in a previous pool, then signs in via
    Google OAuth which issues a new sub). In that case we update the stored sub so
    future logins are fast.
    """
    try:
        user, created = User.objects.get_or_create(
            cognito_sub=cognito_sub,
            defaults={'email': email, 'name': name, 'avatar_url': picture},
        )
    except IntegrityError:
        # Email collision: an account with this email exists under a different sub.
        # Link by adopting the new sub so the user can log in either way going forward.
        logger.info('Linking existing email %s to new cognito_sub %s', email, cognito_sub)
        user = User.objects.get(email=email)
        dirty = ['cognito_sub']
        user.cognito_sub = cognito_sub
        if name and user.name != name:
            user.name = name
            dirty.append('name')
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            dirty.append('avatar_url')
        dirty.append('updated_at')
        user.save(update_fields=dirty)
        return user

    if not created:
        dirty: list[str] = []
        if email and user.email != email:
            user.email = email
            dirty.append('email')
        if name and user.name != name:
            user.name = name
            dirty.append('name')
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            dirty.append('avatar_url')
        if dirty:
            dirty.append('updated_at')
            user.save(update_fields=dirty)

    return user
