from django.urls import path

from .views import (
    hello,
    connect_repo,
    github_branches,
    github_installations,
    github_repos,
    project_detail,
    projects_list,
)

urlpatterns = [
    path('hello', hello),
    path('projects/', projects_list),
    path('projects/<uuid:pk>/', project_detail),
    path('projects/<uuid:pk>/connect-repo/', connect_repo),
    path('github/installations/', github_installations),
    path('github/repos/', github_repos),
    path('github/branches/', github_branches),
]
