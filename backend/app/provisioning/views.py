import uuid
from django.utils import timezone
from botocore.exceptions import ClientError
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import AWSAccountConnection, EnvVarKey, Project
from app.auth import CognitoAuthentication
from .aws_client import assume_role, get_account_id, write_secret
from .cfn_bootstrap import generate_cfn_console_url
from . import iac
from . import deploy

_AUTH = [CognitoAuthentication]
_PERMS = [IsAuthenticated]


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def aws_connection_init(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    region = request.data.get('region', 'us-east-1')

    # Reuse pending connection if one already exists without a verified role
    existing = AWSAccountConnection.objects.filter(
        project=project, connected_at__isnull=True
    ).order_by('-created_at').first()

    if existing:
        external_id = existing.bootstrap_stack_id
    else:
        external_id = str(uuid.uuid4())
        AWSAccountConnection.objects.create(
            project=project,
            aws_account_id='pending',
            aws_region=region,
            iam_role_arn='pending',
            bootstrap_stack_id=external_id,
        )

    cfn_console_url = generate_cfn_console_url(project.name, external_id, region)
    return Response({'cfn_console_url': cfn_console_url, 'external_id': external_id})


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def aws_connection_verify(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    role_arn = (request.data.get('role_arn') or '').strip()
    region = request.data.get('region', 'us-east-1')

    if not role_arn:
        return Response({'error': 'role_arn is required'}, status=status.HTTP_400_BAD_REQUEST)

    connection = AWSAccountConnection.objects.filter(
        project=project, connected_at__isnull=True
    ).order_by('-created_at').first()

    if not connection:
        return Response(
            {'error': 'No pending AWS connection found. Please start the connection flow again.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    external_id = connection.bootstrap_stack_id
    try:
        credentials = assume_role(role_arn, external_id, session_name=f'Clyro-{project.pk}')
        aws_account_id = get_account_id(credentials, region)
    except ClientError as exc:
        code = exc.response['Error']['Code']
        if code in ('AccessDenied', 'AccessDeniedException'):
            return Response(
                {'error': 'Could not assume role — check the ARN and that the stack created successfully, then try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {'error': f'AWS error: {exc.response["Error"]["Message"]}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    connection.iam_role_arn = role_arn
    connection.aws_account_id = aws_account_id
    connection.aws_region = region
    connection.connected_at = timezone.now()
    connection.last_verified_at = timezone.now()
    connection.save()

    return Response({'connected': True, 'aws_account_id': aws_account_id, 'region': region})


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def env_vars_list(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    qs = EnvVarKey.objects.filter(project=project, is_active=True)

    def serialize(var):
        return {
            'key_name': var.key_name,
            'context_block': var.context_block,
            'production_default': var.production_default,
            'source_file': var.source_file,
            'secrets_manager_arn': var.secrets_manager_arn,
        }

    return Response({
        'user_secret': [serialize(v) for v in qs.filter(classification=EnvVarKey.Classification.USER_SECRET)],
        'generated': [serialize(v) for v in qs.filter(classification=EnvVarKey.Classification.GENERATED)],
        'optional': [serialize(v) for v in qs.filter(classification=EnvVarKey.Classification.OPTIONAL)],
    })


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def env_vars_save(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    connection = AWSAccountConnection.objects.filter(
        project=project, connected_at__isnull=False
    ).order_by('-connected_at').first()

    if not connection:
        return Response(
            {'error': 'AWS account not connected. Complete the AWS connection step first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    values = request.data.get('values', {})
    extra_vars = request.data.get('extra_vars', [])

    try:
        credentials = assume_role(
            connection.iam_role_arn,
            connection.bootstrap_stack_id,
            session_name=f'Clyro-{project.pk}',
        )
    except ClientError as exc:
        return Response(
            {'error': f'Could not access your AWS account: {exc.response["Error"]["Message"]}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    region = connection.aws_region
    project_slug = ''.join(c if c.isalnum() or c == '-' else '-' for c in project.name).lower()
    saved_arns = {}

    for key_name, secret_value in values.items():
        if not secret_value:
            continue
        secret_name = f'clyro/{project_slug}/{key_name}'
        try:
            arn = write_secret(credentials, region, secret_name, secret_value)
        except ClientError as exc:
            return Response(
                {'error': f'Failed to save {key_name}: {exc.response["Error"]["Message"]}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        saved_arns[key_name] = arn
        EnvVarKey.objects.filter(project=project, key_name=key_name).update(
            secrets_manager_arn=arn,
            secrets_manager_key=key_name,
        )

    for row in extra_vars:
        key = (row.get('key') or '').strip()
        value = (row.get('value') or '').strip()
        if not key or not value:
            continue
        secret_name = f'clyro/{project_slug}/{key}'
        try:
            arn = write_secret(credentials, region, secret_name, value)
        except ClientError as exc:
            return Response(
                {'error': f'Failed to save {key}: {exc.response["Error"]["Message"]}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        saved_arns[key] = arn
        EnvVarKey.objects.update_or_create(
            project=project,
            key_name=key,
            defaults={
                'classification': EnvVarKey.Classification.OPTIONAL,
                'secrets_manager_arn': arn,
                'secrets_manager_key': key,
                'is_active': True,
            },
        )

    return Response({'saved': True, 'secret_arns': saved_arns})


# ── Step 4 — IaC generation / refinement / validation ─────────────────────────

def _get_project_or_404(request, pk):
    try:
        return Project.objects.get(pk=pk, user=request.user), None
    except Project.DoesNotExist:
        return None, Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def iac_current(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(iac.get_current(project))
    except iac.IacError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def iac_generate(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(iac.generate(project, model=request.data.get('model')))
    except iac.IacError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def iac_refine(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    instruction = (request.data.get('instruction') or '').strip()
    if not instruction:
        return Response({'error': 'instruction is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response(iac.refine(
            project, instruction,
            history=request.data.get('history') or [],
            template=request.data.get('template'),
            model=request.data.get('model'),
        ))
    except iac.IacError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def iac_validate(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    template = request.data.get('template')
    if template is None:
        return Response({'error': 'template is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response(iac.validate(project, template))
    except iac.IacError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


# ── Step 4.5 — Provisioning (submit template + live feed) ──────────────────────

@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_start(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(deploy.start(project))
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_status(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(deploy.poll(project))
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_pause(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(deploy.pause(project))
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_resume(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(deploy.resume(project))
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_teardown(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        return Response(deploy.teardown(project))
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
