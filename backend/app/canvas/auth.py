"""Authentication for the Step 3 canvas endpoints.

Reuses the existing Cognito JWT auth, with an optional DEBUG-only dev bypass so
the canvas endpoints can be exercised with curl or the browser without a Cognito
token during local development. The bypass is gated on ``DEBUG`` and the
``DEV_AUTH_BYPASS`` setting, so it is inert in production.
"""

from django.conf import settings

from app.auth import CognitoAuthentication
from core.models import User


class CanvasAuth(CognitoAuthentication):
    def authenticate(self, request):
        if settings.DEBUG and getattr(settings, "DEV_AUTH_BYPASS", False):
            user, _ = User.objects.get_or_create(
                email=settings.DEV_USER_EMAIL,
                defaults={
                    "cognito_sub": f"dev-bypass-{settings.DEV_USER_EMAIL}",
                    "name": "Dev User",
                },
            )
            return (user, None)
        return super().authenticate(request)
