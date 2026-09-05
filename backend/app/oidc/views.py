"""An OIDC facade over GitHub's OAuth, so Cognito can federate GitHub sign-in.

Why this exists
---------------
Cognito federates identity providers that speak OIDC. GitHub does not. It
speaks OAuth2 only: no discovery document, no ID token, no JWKS. There is no
configuration that bridges that gap, so something has to sit in the middle and
present the endpoints Cognito expects while talking OAuth to GitHub.

That something is these six views. Cognito believes it is talking to a
conventional OIDC provider; GitHub believes it is talking to a conventional
OAuth client.

    Cognito  --/authorize-->  us  --/login/oauth/authorize-->  GitHub
    GitHub   --/callback--->  us  --redirect with our code-->  Cognito
    Cognito  --/token----->   us  (we mint and sign an ID token)
    Cognito  --/jwks----->    us  (Cognito verifies our signature)

Where it runs
-------------
In the Django app rather than a separate service. The isolation a separate
container would appear to give is illusory on a single box: both would run on
the same host, under the same instance profile, with the same access to the
same SSM parameters. It would look like a security boundary without being one,
at the cost of another image, another deploy path and another nginx block.

Trust boundaries that are real, and are enforced
------------------------------------------------
* Cognito authenticates to us at /token with a client id and secret that exist
  only for this purpose. They are not GitHub's credentials.
* We authenticate to GitHub with the OAuth App's credentials, which never leave
  the server.
* The ID token is signed with an RSA key held in SSM, never in Terraform state.
* Authorization codes are single use and expire in two minutes.
"""

import base64
import json
import logging
import secrets
import time

import requests
from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt

import jwt

logger = logging.getLogger(__name__)

GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN = 'https://github.com/login/oauth/access_token'
GITHUB_API = 'https://api.github.com'

# Long enough for a human to complete GitHub's login and consent screens.
_STATE_TTL = 600
# Cognito redeems its code immediately; this only has to survive one redirect.
_CODE_TTL = 120
_TOKEN_TTL = 300

_ISSUER = lambda: settings.OIDC_ISSUER.rstrip('/')  # noqa: E731


# ── Short-lived state ────────────────────────────────────────────────────────
#
# Redis rather than the database. Every value here is dead within minutes, and
# writing per-login rows into Postgres to delete them seconds later is the kind
# of thing that quietly becomes a vacuum problem. Redis is already on the box
# for Celery, and losing this store on a restart costs at worst one retried
# login.

_redis = None


def _store():
    global _redis
    if _redis is None:
        import redis

        _redis = redis.Redis.from_url(settings.CELERY_BROKER_URL)
    return _redis


def _put(key: str, value: dict, ttl: int) -> None:
    _store().setex(key, ttl, json.dumps(value))


def _take(key: str) -> dict | None:
    """Read and delete in one round trip.

    Deleting on read is what makes an authorization code single use. Reading
    and then deleting separately leaves a window where two requests both see a
    valid code, which is the classic replay against this kind of endpoint.
    """
    pipe = _store().pipeline()
    pipe.get(key)
    pipe.delete(key)
    raw, _ = pipe.execute()
    return json.loads(raw) if raw else None


# ── Signing ──────────────────────────────────────────────────────────────────

def _private_key():
    pem = settings.OIDC_SIGNING_KEY
    if not pem:
        raise RuntimeError('OIDC_SIGNING_KEY is not configured')
    return serialization.load_pem_private_key(pem.encode(), password=None)


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _kid(public_numbers) -> str:
    """A stable key id derived from the key itself.

    Deriving it means the JWKS and the token header can never disagree, which
    they would if the id were configured separately and someone rotated one of
    the two.
    """
    n = public_numbers.n.to_bytes((public_numbers.n.bit_length() + 7) // 8, 'big')
    import hashlib

    return _b64u(hashlib.sha256(n).digest()[:16])


# ── Endpoints ────────────────────────────────────────────────────────────────

def discovery(_request):
    """The document Cognito fetches to learn where everything else lives."""
    issuer = _ISSUER()
    return JsonResponse(
        {
            'issuer': issuer,
            'authorization_endpoint': f'{issuer}/authorize',
            'token_endpoint': f'{issuer}/token',
            'userinfo_endpoint': f'{issuer}/userinfo',
            'jwks_uri': f'{issuer}/jwks',
            'response_types_supported': ['code'],
            'subject_types_supported': ['public'],
            'id_token_signing_alg_values_supported': ['RS256'],
            'scopes_supported': ['openid', 'email', 'profile'],
            'token_endpoint_auth_methods_supported': [
                'client_secret_basic',
                'client_secret_post',
            ],
            'claims_supported': [
                'sub', 'email', 'email_verified', 'name',
                'preferred_username', 'picture',
            ],
        }
    )


def jwks(_request):
    pub = _private_key().public_key().public_numbers()
    n = pub.n.to_bytes((pub.n.bit_length() + 7) // 8, 'big')
    e = pub.e.to_bytes((pub.e.bit_length() + 7) // 8, 'big')
    return JsonResponse(
        {
            'keys': [
                {
                    'kty': 'RSA',
                    'use': 'sig',
                    'alg': 'RS256',
                    'kid': _kid(pub),
                    'n': _b64u(n),
                    'e': _b64u(e),
                }
            ]
        }
    )


def authorize(request):
    """Cognito starts here. We hand off to GitHub and remember how to get back."""
    if request.GET.get('client_id') != settings.OIDC_CLIENT_ID:
        return JsonResponse({'error': 'unauthorized_client'}, status=401)

    redirect_uri = request.GET.get('redirect_uri')
    if not redirect_uri:
        return JsonResponse({'error': 'invalid_request'}, status=400)

    handle = secrets.token_urlsafe(32)
    _put(
        f'oidc:state:{handle}',
        {
            'redirect_uri': redirect_uri,
            'state': request.GET.get('state', ''),
            'nonce': request.GET.get('nonce', ''),
        },
        _STATE_TTL,
    )

    # GitHub gets our own opaque handle as its state, never Cognito's. Cognito's
    # state is a CSRF token for the Cognito leg of the flow and has no business
    # travelling through a third party.
    #
    # The scopes matter and are OAuth App scopes, not GitHub App permissions:
    # a GitHub App would ignore this parameter entirely and grant whatever its
    # configured permissions allow.
    params = {
        'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
        'redirect_uri': f'{_ISSUER()}/callback',
        'scope': 'read:user user:email',
        'state': handle,
    }
    query = '&'.join(f'{k}={requests.utils.quote(v, safe="")}' for k, v in params.items())
    return HttpResponseRedirect(f'{GITHUB_AUTHORIZE}?{query}')


def callback(request):
    """GitHub returns here. We turn its answer into a code Cognito can redeem."""
    handle = request.GET.get('state', '')
    code = request.GET.get('code', '')
    if not handle or not code:
        return HttpResponse('missing code or state', status=400)

    pending = _take(f'oidc:state:{handle}')
    if not pending:
        # Expired, replayed, or forged. All three are the same to us.
        return HttpResponse('unknown or expired state', status=400)

    token_resp = requests.post(
        GITHUB_TOKEN,
        headers={'Accept': 'application/json'},
        data={
            'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
            'client_secret': settings.GITHUB_OAUTH_CLIENT_SECRET,
            'code': code,
            'redirect_uri': f'{_ISSUER()}/callback',
        },
        timeout=15,
    )
    token_resp.raise_for_status()
    gh_token = token_resp.json().get('access_token')
    if not gh_token:
        logger.warning('github token exchange returned no access_token')
        return HttpResponse('github rejected the authorization code', status=400)

    headers = {
        'Authorization': f'Bearer {gh_token}',
        'Accept': 'application/vnd.github+json',
    }
    user = requests.get(f'{GITHUB_API}/user', headers=headers, timeout=15).json()

    # /user.email is null whenever the account keeps its address private, which
    # is the default. The dedicated endpoint is the only reliable source, and it
    # is why the user:email scope is requested above.
    email, verified = None, False
    emails = requests.get(f'{GITHUB_API}/user/emails', headers=headers, timeout=15)
    if emails.ok:
        for entry in emails.json():
            if entry.get('primary'):
                email, verified = entry.get('email'), bool(entry.get('verified'))
                break
    if not email:
        email, verified = user.get('email'), False

    if not email:
        # Cognito keys users on email and the pre-signup trigger links accounts
        # by it. Continuing without one creates an orphan that can never be
        # merged, so failing here is kinder than succeeding.
        return HttpResponse(
            'GitHub did not release an email address for this account. '
            'Add a verified email to your GitHub account and try again.',
            status=400,
        )

    claims = {
        'sub': f'github:{user["id"]}',
        'email': email,
        'email_verified': verified,
        'name': user.get('name') or user.get('login'),
        'preferred_username': user.get('login'),
        'picture': user.get('avatar_url'),
        'nonce': pending['nonce'],
    }

    our_code = secrets.token_urlsafe(32)
    _put(f'oidc:code:{our_code}', claims, _CODE_TTL)

    sep = '&' if '?' in pending['redirect_uri'] else '?'
    back = f'{pending["redirect_uri"]}{sep}code={our_code}'
    if pending['state']:
        back += f'&state={requests.utils.quote(pending["state"], safe="")}'
    return HttpResponseRedirect(back)


def _client_authenticated(request) -> bool:
    """Accept either of the two methods advertised in the discovery document."""
    header = request.META.get('HTTP_AUTHORIZATION', '')
    if header.startswith('Basic '):
        try:
            raw = base64.b64decode(header[6:]).decode()
            client_id, _, client_secret = raw.partition(':')
        except Exception:
            return False
    else:
        client_id = request.POST.get('client_id', '')
        client_secret = request.POST.get('client_secret', '')

    # Constant time, so a wrong secret cannot be discovered a character at a
    # time by measuring how long the comparison takes.
    return secrets.compare_digest(
        client_id, settings.OIDC_CLIENT_ID
    ) and secrets.compare_digest(client_secret, settings.OIDC_CLIENT_SECRET)


@csrf_exempt
def token(request):
    """Cognito redeems its code here and gets a signed ID token back."""
    if request.method != 'POST':
        return JsonResponse({'error': 'invalid_request'}, status=405)
    if not _client_authenticated(request):
        return JsonResponse({'error': 'invalid_client'}, status=401)
    if request.POST.get('grant_type') != 'authorization_code':
        return JsonResponse({'error': 'unsupported_grant_type'}, status=400)

    claims = _take(f'oidc:code:{request.POST.get("code", "")}')
    if not claims:
        return JsonResponse({'error': 'invalid_grant'}, status=400)

    now = int(time.time())
    pub = _private_key().public_key().public_numbers()
    payload = {
        'iss': _ISSUER(),
        'aud': settings.OIDC_CLIENT_ID,
        'iat': now,
        'exp': now + _TOKEN_TTL,
        'auth_time': now,
        **{k: v for k, v in claims.items() if k != 'nonce' or v},
    }
    id_token = jwt.encode(
        payload,
        _private_key().private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ),
        algorithm='RS256',
        headers={'kid': _kid(pub)},
    )

    # An opaque access token, good only for our own /userinfo. Cognito may or
    # may not call it depending on how the provider is configured, so it has to
    # work either way.
    access_token = secrets.token_urlsafe(32)
    _put(f'oidc:at:{access_token}', claims, _TOKEN_TTL)

    return JsonResponse(
        {
            'access_token': access_token,
            'id_token': id_token,
            'token_type': 'Bearer',
            'expires_in': _TOKEN_TTL,
        }
    )


def userinfo(request):
    header = request.META.get('HTTP_AUTHORIZATION', '')
    if not header.startswith('Bearer '):
        return JsonResponse({'error': 'invalid_token'}, status=401)

    # Not consumed on read: Cognito is entitled to ask more than once inside the
    # token's lifetime, and a single-use rule here would break that.
    raw = _store().get(f'oidc:at:{header[7:]}')
    if not raw:
        return JsonResponse({'error': 'invalid_token'}, status=401)

    claims = {k: v for k, v in json.loads(raw).items() if k != 'nonce'}
    return JsonResponse(claims)
