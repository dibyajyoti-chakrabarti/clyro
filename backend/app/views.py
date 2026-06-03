from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import GitHubInstallation, Project
from core.serializers import GitHubInstallationSerializer, ProjectSerializer
from .auth import CognitoAuthentication
from . import github_utils

_AUTH = [CognitoAuthentication]
_PERMS = [IsAuthenticated]


@api_view(['GET'])
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

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)

    project = Project.objects.create(user=request.user, name=name)
    return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def project_detail(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ProjectSerializer(project).data)

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

    try:
        info = github_utils.get_installation_info(int(installation_id))
    except Exception as exc:
        return Response({'error': f'GitHub API error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

    account = info.get('account', {})
    installation, _ = GitHubInstallation.objects.update_or_create(
        installation_id=int(installation_id),
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
