from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('app.urls')),
    # Outside /api/ on purpose: these are OIDC endpoints consumed by Cognito,
    # not application API routes, and the issuer identifier is the URL prefix
    # itself. Moving it would change the issuer and invalidate every token.
    path('oidc/github/', include('app.oidc.urls')),
]
