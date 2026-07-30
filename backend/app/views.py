from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import AgentJob, AWSAccountConnection, Deployment, EnvVarKey, GitHubInstallation, IntentRecord, Project, ScanResult, WhitelistedEmail
from core.serializers import (
    GitHubInstallationSerializer, IntentRecordSerializer,
    ProjectSerializer, ScanResultSerializer, UserProfileSerializer,
)
from .auth import CognitoAuthentication
from .provisioning import deploy
from . import github_utils, tasks

_AUTH = [CognitoAuthentication]
_PERMS = [IsAuthenticated]


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def hello(request):
    return Response({'message': 'Hello'})


# ── Projects ──────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def projects_list(request):
    if request.method == 'GET':
        qs = Project.objects.filter(user=request.user).order_by('-created_at')
        return Response(ProjectSerializer(qs, many=True).data)

    if not WhitelistedEmail.allows(request.user.email):
        return Response(
            {
                'error': 'Your email is not authorized to create projects yet. Contact the Clyro team for access.',
                'code': 'not_whitelisted',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)

    project = Project.objects.create(user=request.user, name=name)
    return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def project_detail(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ProjectSerializer(project).data)

    if request.method == 'DELETE':
        # Idempotent: a second click / post-refresh retry re-attaches to the
        # in-flight delete job instead of spawning a competing purge.
        existing = AgentJob.objects.filter(
            project=project, kind=AgentJob.Kind.DELETE,
            status__in=[AgentJob.Status.PENDING, AgentJob.Status.RUNNING],
        ).order_by('-created_at').first()
        if existing:
            return Response({'job_id': str(existing.id)}, status=status.HTTP_202_ACCEPTED)

        # Anything real in the user's AWS account (a submitted stack, secrets
        # Clyro wrote, or the ClyroBootstrap connector stack behind a verified
        # connection) must be purged before the rows disappear — otherwise
        # nothing is left in Clyro that can ever manage it. That purge is
        # CFN-async and slow, so it runs as an AgentJob the client polls; the
        # job (and every other row) is gone on success, so the poll ending in
        # 404 is the completion signal.
        has_aws_resources = (
            Deployment.objects.filter(project=project)
            .exclude(status__in=[Deployment.Status.PENDING, Deployment.Status.DELETED])
            .exists()
            or EnvVarKey.objects.filter(project=project, secrets_manager_arn__isnull=False).exists()
            or AWSAccountConnection.objects.filter(project=project, connected_at__isnull=False).exists()
        )
        if has_aws_resources:
            project.status = Project.Status.DELETING
            project.save(update_fields=['status', 'updated_at'])
            job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.DELETE)
            tasks.run_delete_project_task.delay(str(job.id), str(project.id))
            return Response({'job_id': str(job.id)}, status=status.HTTP_202_ACCEPTED)

        # Nothing in AWS — pure DB delete, synchronous. Deployment.canvas_version/
        # intent_record/aws_connection are PROTECT (so a live Deployment can't have
        # its CanvasVersion/IntentRecord/AWSAccountConnection pulled out from under
        # it) -- but PROTECT still blocks Project.delete()'s cascade to those same
        # rows even though the protecting Deployment is *also* being cascade-deleted
        # here. Delete deployments first so nothing is left protecting them.
        project.deployments.all().delete()
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ProjectSerializer(project, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def connect_repo(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    installation_id = request.data.get('installation_id')
    repo_full_name = request.data.get('repo_full_name', '').strip()
    repo_branch = request.data.get('repo_branch', 'main').strip()

    if not installation_id or not repo_full_name:
        return Response(
            {'error': 'installation_id and repo_full_name are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        installation = GitHubInstallation.objects.get(
            user=request.user,
            installation_id=installation_id,
        )
    except GitHubInstallation.DoesNotExist:
        return Response({'error': 'GitHub installation not found'}, status=status.HTTP_404_NOT_FOUND)

    project.github_installation = installation
    project.repo_full_name = repo_full_name
    project.repo_branch = repo_branch
    project.status = Project.Status.REPO_CONNECTED
    project.save(update_fields=['github_installation', 'repo_full_name', 'repo_branch', 'status', 'updated_at'])

    return Response(ProjectSerializer(project).data)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def trigger_scan(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if not project.repo_full_name or not project.github_installation:
        return Response(
            {'error': 'Repository not connected. Call connect-repo first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if project.status == Project.Status.SCANNING:
        return Response({'error': 'Scan already in progress'}, status=status.HTTP_409_CONFLICT)

    project.status = Project.Status.SCANNING
    project.save(update_fields=['status', 'updated_at'])

    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.SCAN)
    tasks.run_scan_task.delay(str(job.id), str(project.id))
    return Response({'job_id': str(job.id)}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def agent_job_status(request, pk, job_id):
    """Generic poll endpoint for any AgentJob (scan/canvas_chat/iac_generate/
    iac_refine/provision) — same shape for every kind so the frontend can reuse
    one polling helper everywhere, mirroring the CFN deploy-status pattern."""
    try:
        job = AgentJob.objects.get(pk=job_id, project__pk=pk, project__user=request.user)
    except AgentJob.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'job_id': str(job.id),
        'kind': job.kind,
        'status': job.status,
        'result': job.result,
        'progress': job.progress,  # live {phase, partial_template} while running (B2)
        'error': job.error,
    })


# ── User profile ──────────────────────────────────────────────────────────────

@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def me(request):
    if request.method == 'GET':
        return Response(UserProfileSerializer(request.user).data)

    if request.method == 'PATCH':
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    request.user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Wizard state ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def wizard_state(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    # Step 1 used to warm RepoRecon here to hide its ~17s AgentCore cold start.
    # There is no agent to warm any more — Step 1 reads CLYRO.md straight from
    # the repo, so entering the wizard costs nothing.
    scan = project.scan_results.filter(status='complete').order_by('-scan_timestamp').first()
    intent = project.intent_records.order_by('-created_at').first()

    # AWS-connect + secret entry live in Step 4's 'connect AWS' phase (after IaC
    # generation, before provisioning), so the wizard needs to know on load
    # whether the account is already connected — otherwise a refresh mid-connect
    # would re-prompt the role stack instead of resuming at secrets.
    connection = AWSAccountConnection.objects.filter(
        project=project, connected_at__isnull=False
    ).order_by('-connected_at').first()

    return Response({
        'project': ProjectSerializer(project).data,
        'scan': ScanResultSerializer(scan).data if scan else None,
        'intent': IntentRecordSerializer(intent).data if intent else None,
        'connection': {
            'connected': bool(connection),
            'region': connection.aws_region if connection else None,
            'health_status': connection.health_status if connection else None,
        },
    })


# ── Intent ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def save_intent(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = IntentRecordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    from django.utils import timezone
    intent, _ = IntentRecord.objects.update_or_create(
        project=project,
        defaults={**serializer.validated_data, 'completed_at': timezone.now()},
    )

    # The Step 3 canvas (CanvasVersion v1) is built deterministically from the
    # ScanResult detected_resources + this IntentRecord when Step 3 is entered
    # (canvas_core.canvas_builder via canvas.services.ensure_initial_canvas).

    project.status = Project.Status.INTENT_COLLECTED
    project.save(update_fields=['status', 'updated_at'])

    # Warm the Reasoning runtime now so the canvas step's first chat call is
    # already hot by the time the user gets there.
    if getattr(settings, "IAC_WARMUP_ENABLED", False):
        tasks.run_warmup_task.delay(str(project.id), "REASONING_RUNTIME_ARN")

    return Response(IntentRecordSerializer(intent).data, status=status.HTTP_201_CREATED)


# ── GitHub ────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def github_installations(request):
    if request.method == 'GET':
        qs = GitHubInstallation.objects.filter(user=request.user).order_by('-created_at')
        return Response(GitHubInstallationSerializer(qs, many=True).data)

    installation_id = request.data.get('installation_id')
    if not installation_id:
        return Response({'error': 'installation_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    installation_id = int(installation_id)

    # installation_id is a GitHub-assigned identifier, not a secret bound to
    # the requesting user — without this check, any authenticated user who
    # learns another org's installation_id (e.g. from a shared URL) could
    # silently reassign that installation's ownership to themselves and gain
    # access to every repo it covers via Clyro's own GitHub App credentials.
    existing = GitHubInstallation.objects.filter(installation_id=installation_id).first()
    if existing and existing.user_id != request.user.id:
        return Response(
            {
                'error': (
                    'This GitHub installation is already connected to a different '
                    'account. If you own this GitHub organization, reinstall the '
                    'Clyro GitHub App from that organization to reconnect it here.'
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        info = github_utils.get_installation_info(installation_id)
    except Exception as exc:
        return Response({'error': f'GitHub API error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

    account = info.get('account', {})
    installation, _ = GitHubInstallation.objects.update_or_create(
        installation_id=installation_id,
        defaults={
            'user': request.user,
            'account_login': account.get('login', ''),
            'account_type': account.get('type', 'User'),
            'account_avatar_url': account.get('avatar_url', ''),
            'app_id': info.get('app_id', 0),
        },
    )
    return Response(GitHubInstallationSerializer(installation).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def github_repos(request):
    installation_id = request.query_params.get('installation_id')
    if not installation_id:
        return Response({'error': 'installation_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not GitHubInstallation.objects.filter(user=request.user, installation_id=installation_id).exists():
        return Response({'error': 'Installation not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        repos = github_utils.list_installation_repos(int(installation_id))
    except Exception as exc:
        return Response({'error': f'GitHub API error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response([
        {
            'full_name': r['full_name'],
            'name': r['name'],
            'private': r['private'],
            'default_branch': r['default_branch'],
        }
        for r in repos
    ])


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def github_branches(request):
    installation_id = request.query_params.get('installation_id')
    repo_full_name = request.query_params.get('repo')

    if not installation_id or not repo_full_name:
        return Response(
            {'error': 'installation_id and repo are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not GitHubInstallation.objects.filter(user=request.user, installation_id=installation_id).exists():
        return Response({'error': 'Installation not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        branches = github_utils.list_repo_branches(int(installation_id), repo_full_name)
    except Exception as exc:
        return Response({'error': f'GitHub API error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response([{'name': b['name']} for b in branches])
