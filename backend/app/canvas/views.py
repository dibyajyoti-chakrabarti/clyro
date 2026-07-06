"""Step 3 canvas endpoints (DRF function views, matching the app convention)."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import AgentJob, CanvasVersion, Project

from app.auth import CognitoAuthentication
from app import tasks

from . import services
from .serializers import serialize_version, serialize_version_summary

_AUTH = [CognitoAuthentication]
_PERMS = [IsAuthenticated]


@api_view(["GET"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_latest(request, pk):
    project = get_object_or_404(Project, pk=pk, user=request.user)
    # Build CanvasVersion v1 from the real Step 1/2 records on first entry.
    version = services.ensure_initial_canvas(project)
    if version is None:
        return Response({"error": "No canvas for this project yet."}, status=status.HTTP_404_NOT_FOUND)
    return Response(serialize_version(version))


@api_view(["POST"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_agent(request, pk):
    project = get_object_or_404(Project, pk=pk, user=request.user)
    prompt = (request.data.get("prompt") or "").strip()
    confirm = bool(request.data.get("confirm", False))
    pending_operation = request.data.get("pending_operation")
    history = request.data.get("history") or []

    if not confirm and not prompt:
        return Response({"error": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)
    if confirm and not pending_operation:
        return Response({"error": "pending_operation is required to confirm"}, status=status.HTTP_400_BAD_REQUEST)

    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.CANVAS_CHAT)
    tasks.run_canvas_agent_task.delay(
        str(job.id), str(project.id), prompt, confirm, pending_operation, history
    )
    return Response({"job_id": str(job.id)}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_chat(request, pk):
    """Restore the persisted chat + pending proposal on mount (survives refresh)."""
    project = get_object_or_404(Project, pk=pk, user=request.user)
    return Response(services.chat_memory.load_chat(project))


@api_view(["POST"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_chat_flush(request, pk):
    """Clear the project's saved canvas conversation."""
    project = get_object_or_404(Project, pk=pk, user=request.user)
    services.chat_memory.flush(project)
    return Response({"ok": True})


@api_view(["POST"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_dismiss(request, pk):
    """Record that the user dismissed the pending proposal."""
    project = get_object_or_404(Project, pk=pk, user=request.user)
    return Response(services.dismiss_proposal(project))


@api_view(["GET"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_versions(request, pk):
    project = get_object_or_404(Project, pk=pk, user=request.user)
    versions = CanvasVersion.objects.filter(project=project).order_by("-version_number")
    return Response([serialize_version_summary(v) for v in versions])


@api_view(["POST"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_revert(request, pk, version_number):
    project = get_object_or_404(Project, pk=pk, user=request.user)
    result = services.revert_to(project, version_number)
    if result is None:
        return Response({"error": f"No version {version_number} to revert to."}, status=status.HTTP_404_NOT_FOUND)
    return Response(result)


@api_view(["POST"])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def canvas_finalize(request, pk):
    project = get_object_or_404(Project, pk=pk, user=request.user)
    result = services.finalize(project)
    if result is None:
        return Response({"error": "No canvas to finalize."}, status=status.HTTP_404_NOT_FOUND)
    return Response(result)
