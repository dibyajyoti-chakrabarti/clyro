"""Routes for the GitHub OIDC shim.

Mounted at /oidc/github/, which makes the issuer https://api.<domain>/oidc/github
and puts discovery at the .well-known path OIDC requires, relative to it.
"""

from django.urls import path

from . import views

urlpatterns = [
    path('.well-known/openid-configuration', views.discovery),
    path('jwks', views.jwks),
    path('authorize', views.authorize),
    path('callback', views.callback),
    path('token', views.token),
    path('userinfo', views.userinfo),
]
