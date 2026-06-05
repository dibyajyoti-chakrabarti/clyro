from django.urls import path

from .canvas.views import (
    canvas_agent,
    canvas_finalize,
    canvas_latest,
    canvas_revert,
    canvas_versions,
)
from .views import (
    hello,
    connect_repo,
    github_branches,
    github_installations,
    github_repos,
    me,
    project_detail,
    projects_list,
    save_intent,
    trigger_scan,
    wizard_state,
)

urlpatterns = [
    path('hello', hello),
    path('users/me/', me),
    path('projects/', projects_list),
    path('projects/<uuid:pk>/', project_detail),
    path('projects/<uuid:pk>/connect-repo/', connect_repo),
    path('projects/<uuid:pk>/scan/', trigger_scan),
    path('projects/<uuid:pk>/intent/', save_intent),
    path('projects/<uuid:pk>/wizard-state/', wizard_state),
    path('projects/<uuid:pk>/canvas/latest/', canvas_latest),
    path('projects/<uuid:pk>/canvas/agent/', canvas_agent),
    path('projects/<uuid:pk>/canvas/versions/', canvas_versions),
    path('projects/<uuid:pk>/canvas/versions/<int:version_number>/revert/', canvas_revert),
    path('projects/<uuid:pk>/canvas/finalize/', canvas_finalize),
    path('github/installations/', github_installations),
    path('github/repos/', github_repos),
    path('github/branches/', github_branches),
]
