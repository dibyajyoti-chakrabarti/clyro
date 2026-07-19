"""Admin panel API: HS256-JWT login for AdminUser rows plus the endpoints the
panel consumes (overview stats, whitelist management). Kept apart from the
Cognito user flow on purpose — admin tokens are signed with SECRET_KEY (HS256)
and carry a 'clyro-admin' scope, so a Cognito RS256 token can never
authenticate here and vice versa."""

import logging
from datetime import datetime, timedelta, timezone as dt_timezone

import jwt
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.models import AdminUser, Project, User, WhitelistedEmail

logger = logging.getLogger(__name__)

_ADMIN_SCOPE = 'clyro-admin'
_TOKEN_TTL = timedelta(hours=12)


def _issue_token(admin: AdminUser) -> str:
    now = datetime.now(dt_timezone.utc)
    return jwt.encode(
        {
            'sub': str(admin.id),
            'username': admin.username,
            'scope': _ADMIN_SCOPE,
            'iat': now,
            'exp': now + _TOKEN_TTL,
        },
        settings.SECRET_KEY,
        algorithm='HS256',
    )


class AdminAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return 'Bearer realm="clyro-admin"'

    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None

        token = header[7:]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed(str(exc))

        if payload.get('scope') != _ADMIN_SCOPE:
            raise AuthenticationFailed('Not an admin token')

        try:
            admin = AdminUser.objects.get(pk=payload['sub'], is_active=True)
        except (AdminUser.DoesNotExist, KeyError):
            raise AuthenticationFailed('Admin account not found or disabled')

        return (admin, token)


_AUTH = [AdminAuthentication]
_PERMS = [IsAuthenticated]


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_login(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if not username or not password:
        return Response({'error': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    admin = AdminUser.objects.filter(username=username, is_active=True).first()
    if admin is None or not admin.check_password(password):
        logger.warning('Failed admin login for username=%s', username)
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    admin.last_login_at = timezone.now()
    admin.save(update_fields=['last_login_at', 'updated_at'])
    return Response({
        'token': _issue_token(admin),
        'username': admin.username,
        'expires_in': int(_TOKEN_TTL.total_seconds()),
    })


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def admin_me(request):
    return Response({'username': request.user.username})


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def admin_overview(request):
    return Response({
        'total_users': User.objects.count(),
        'total_projects': Project.objects.count(),
        'live_projects': Project.objects.filter(status=Project.Status.LIVE).count(),
        'whitelisted_emails': WhitelistedEmail.objects.count(),
    })


def _serialize_entry(entry: WhitelistedEmail) -> dict:
    return {
        'id': str(entry.id),
        'email': entry.email,
        'note': entry.note,
        'added_by': entry.added_by.username if entry.added_by else None,
        'created_at': entry.created_at.isoformat(),
    }


@api_view(['GET', 'POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def admin_whitelist(request):
    if request.method == 'GET':
        entries = WhitelistedEmail.objects.select_related('added_by').order_by('-created_at')
        return Response([_serialize_entry(e) for e in entries])

    email = (request.data.get('email') or '').strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return Response({'error': 'Invalid email address'}, status=status.HTTP_400_BAD_REQUEST)

    if WhitelistedEmail.objects.filter(email=email).exists():
        return Response({'error': 'Email is already whitelisted'}, status=status.HTTP_400_BAD_REQUEST)

    entry = WhitelistedEmail.objects.create(
        email=email,
        note=(request.data.get('note') or '').strip() or None,
        added_by=request.user,
    )
    return Response(_serialize_entry(entry), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def admin_whitelist_detail(request, pk):
    try:
        entry = WhitelistedEmail.objects.get(pk=pk)
    except WhitelistedEmail.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    entry.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
