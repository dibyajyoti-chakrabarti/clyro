import logging
import uuid
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone
from botocore.exceptions import ClientError
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import AgentJob, AWSAccountConnection, EnvVarKey, IntentRecord, Project
from app.auth import CognitoAuthentication
from app import tasks
from .aws_client import assume_role, get_account_id, get_account_plan_type, write_secret
from .cfn_bootstrap import generate_cfn_console_url
from . import iac
from . import deploy
from . import monitoring

_AUTH = [CognitoAuthentication]
_PERMS = [IsAuthenticated]

log = logging.getLogger(__name__)

# freetier:GetAccountPlanState's accountPlanType ('FREE'/'PAID') -> the
# IntentRecord.AwsAccountType choice it corresponds to, so the two can be
# compared directly.
_PLAN_TYPE_TO_ACCOUNT_TYPE = {
    'FREE': IntentRecord.AwsAccountType.FREE_TIER,
    'PAID': IntentRecord.AwsAccountType.PAID,
}


def _write_staged_secrets(project, credentials, region):
    """Write every EnvVarKey the user already staged (Step 1) to Secrets Manager
    now that AWS is connected, instead of waiting for Step 6.

    Found live: Step 5's `iac.generate()` builds the CloudFormation template
    from `EnvVarKey.secrets_manager_arn` — a var with only `staged_value` (no
    arn yet) is silently omitted from the generated template's Secrets/Environment
    arrays (`build_spec.py`). Deferring the real write to Step 6 meant the
    template was already frozen without the secret by the time it was written,
    so the customer's own container crashed with a bare KeyError at migration —
    writing here, right after AWS connects, ensures the arn exists before Step 5
    ever runs."""
    staged = EnvVarKey.objects.filter(
        project=project, is_active=True, staged_value__isnull=False,
    ).exclude(staged_value='').exclude(classification=EnvVarKey.Classification.GENERATED)
    if not staged:
        return
    project_slug = ''.join(c if c.isalnum() or c == '-' else '-' for c in project.name).lower()
    for var in staged:
        secret_name = f'clyro/{project_slug}/{var.key_name}'
        try:
            arn = write_secret(credentials, region, secret_name, var.staged_value)
        except ClientError:
            log.exception('Failed to write staged secret %s for project %s', var.key_name, project.pk)
            continue
        var.secrets_manager_arn = arn
        var.secrets_manager_key = var.key_name
        var.staged_value = None
        var.save(update_fields=['secrets_manager_arn', 'secrets_manager_key', 'staged_value', 'updated_at'])


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

    if project.status != Project.Status.AWS_CONNECT_PENDING:
        project.status = Project.Status.AWS_CONNECT_PENDING
        project.save(update_fields=['status', 'updated_at'])

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
    submitted_account_type = (request.data.get('account_type') or '').strip() or None

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

    # Proactive account-type verification: ask AWS itself (freetier:
    # GetAccountPlanState) rather than trusting only the user's Step-2
    # self-report (IntentRecord.aws_account_type) — an AWS account can be
    # free-tier-restricted regardless of what the user picked there. Best-effort:
    # a failure here (missing permission, API unavailable, etc.) must never fail
    # the connect flow — get_account_plan_type already swallows and logs.
    plan_type = get_account_plan_type(credentials, region)
    verified_account_type = _PLAN_TYPE_TO_ACCOUNT_TYPE.get(plan_type) if plan_type else None

    # Best-effort — a write failure here must never fail the connect flow;
    # Step 6's SecretsWrite is still the fallback for anything left unwritten.
    _write_staged_secrets(project, credentials, region)

    connection.iam_role_arn = role_arn
    connection.aws_account_id = aws_account_id
    connection.aws_region = region
    connection.connected_at = timezone.now()
    connection.last_verified_at = timezone.now()
    connection.verified_account_type = verified_account_type
    # Claim is submitted directly by the Step-2 connect flow now — AWS connects
    # before intent is collected (Step 3), so IntentRecord.aws_account_type is
    # not populated yet at this point (see iac.ensure_deployment's backfill).
    connection.claimed_account_type = submitted_account_type
    connection.save()

    project.status = Project.Status.AWS_CONNECTED
    project.save(update_fields=['status', 'updated_at'])

    # Attach to the in-flight Deployment (created with aws_connection=None during
    # IaC generation, since connecting AWS now happens after — not before).
    iac.attach_aws_connection(project, connection)

    account_type_mismatch = bool(
        verified_account_type and submitted_account_type and verified_account_type != submitted_account_type
    )

    project.status = Project.Status.AWS_MISMATCH if account_type_mismatch else Project.Status.AWS_VERIFIED
    project.save(update_fields=['status', 'updated_at'])

    response_data = {'connected': True, 'aws_account_id': aws_account_id, 'region': region}
    if account_type_mismatch:
        response_data['account_type_mismatch'] = True
    return Response(response_data)


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
            'staged_value': var.staged_value,
        }

    return Response({
        'user_secret': [serialize(v) for v in qs.filter(classification=EnvVarKey.Classification.USER_SECRET)],
        'generated': [serialize(v) for v in qs.filter(classification=EnvVarKey.Classification.GENERATED)],
        'optional': [serialize(v) for v in qs.filter(classification=EnvVarKey.Classification.OPTIONAL)],
    })


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def env_vars_stage(request, pk):
    """Step 2's 'set up your app' secrets entry — upserts EnvVarKey.staged_value
    (and production_default/context_block, when the request includes them)
    WITHOUT requiring an AWSAccountConnection and without ever touching AWS
    (no assume_role/write_secret here). Lets the user fill in secrets before an
    AWS account is connected; env_vars_save later does the real write, falling
    back to whatever was staged here when the frontend doesn't re-submit it."""
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    values = request.data.get('values', {}) or {}
    extra_vars = request.data.get('extra_vars', []) or []
    production_defaults = request.data.get('production_defaults', {}) or {}
    context_blocks = request.data.get('context_blocks', {}) or {}

    staged_keys = []

    for key_name, value in values.items():
        if not value:
            continue
        update_fields = {'staged_value': value}
        if key_name in production_defaults:
            update_fields['production_default'] = production_defaults[key_name]
        if key_name in context_blocks:
            update_fields['context_block'] = context_blocks[key_name]
        updated = EnvVarKey.objects.filter(project=project, key_name=key_name).update(**update_fields)
        if updated:
            staged_keys.append(key_name)

    for row in extra_vars:
        key = (row.get('key') or '').strip()
        value = (row.get('value') or '').strip()
        if not key or not value:
            continue
        EnvVarKey.objects.update_or_create(
            project=project,
            key_name=key,
            defaults={
                'classification': EnvVarKey.Classification.OPTIONAL,
                'staged_value': value,
                'is_active': True,
            },
        )
        staged_keys.append(key)

    if project.status != Project.Status.SECRETS_STAGED:
        project.status = Project.Status.SECRETS_STAGED
        project.save(update_fields=['status', 'updated_at'])

    return Response({'staged': True, 'keys': staged_keys})


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

    # Fall back to whatever env_vars_stage collected earlier (Step 2, before AWS
    # was connected) when the request doesn't explicitly re-submit values —
    # Step 4's "write for real" call can just re-POST with nothing, or override
    # individual keys by including them in `values`/`extra_vars` as usual.
    values = request.data.get('values')
    if values is None:
        values = {
            v.key_name: v.staged_value
            for v in EnvVarKey.objects.filter(
                project=project, is_active=True, staged_value__isnull=False,
            ).exclude(classification=EnvVarKey.Classification.OPTIONAL)
        }

    extra_vars = request.data.get('extra_vars')
    if extra_vars is None:
        extra_vars = [
            {'key': v.key_name, 'value': v.staged_value}
            for v in EnvVarKey.objects.filter(
                project=project, is_active=True, staged_value__isnull=False,
                classification=EnvVarKey.Classification.OPTIONAL, secrets_manager_arn__isnull=True,
            )
        ]

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
            staged_value=None,  # written for real — don't hold plaintext around any longer
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
                'staged_value': None,  # written for real — don't hold plaintext around any longer
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
        if getattr(settings, "IAC_WARMUP_ENABLED", False):
            tasks.run_warmup_task.delay(str(project.id))
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
    # A React StrictMode double-effect (or an impatient double-click) firing
    # this twice in quick succession lets the second call's DB read race the
    # first call's in-flight update — found live as a stale free-tier network
    # config baked into the generated template. Reuse the in-flight job
    # instead of enqueueing a duplicate.
    existing = AgentJob.objects.filter(
        project=project, kind=AgentJob.Kind.IAC_GENERATE,
        status__in=[AgentJob.Status.PENDING, AgentJob.Status.RUNNING],
    ).order_by('-created_at').first()
    if existing:
        return Response({'job_id': str(existing.id)}, status=status.HTTP_202_ACCEPTED)
    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.IAC_GENERATE)
    tasks.run_iac_generate_task.delay(str(job.id), str(project.id), request.data.get('model'))
    return Response({'job_id': str(job.id)}, status=status.HTTP_202_ACCEPTED)


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
    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.IAC_REFINE)
    tasks.run_iac_refine_task.delay(
        str(job.id), str(project.id), instruction,
        request.data.get('history') or [],
        request.data.get('template'),
        request.data.get('model'),
    )
    return Response({'job_id': str(job.id)}, status=status.HTTP_202_ACCEPTED)


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
        start_result = deploy.start(project)
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    # The actual multi-minute wait (poll to terminal + the one-round auto-
    # correction on a real deploy failure) is supervised in the background —
    # deploy_status keeps working exactly as before for the live log feed.
    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.PROVISION)
    tasks.run_provision_task.delay(str(job.id), str(project.id))
    return Response({**start_result, 'job_id': str(job.id)})


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_status(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    try:
        since = request.query_params.get('since')
        try:
            since_seq = int(since) if since not in (None, '') else None
        except (TypeError, ValueError):
            since_seq = None
        data = deploy.poll(project, since=since_seq)
        # Tells the failure screen whether to offer "Rebuild from scratch" — only
        # on a failed, never-been-live deploy (see deploy.can_recreate).
        data['can_recreate'] = deploy.can_recreate(project)
        return Response(data)
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


# Each health snapshot costs an AssumeRole plus several live AWS calls — cache it
# briefly so multiple open tabs (or rapid re-polls) share one snapshot. Ownership
# is enforced per-request before the cache is read, so there's no cross-user leak.
_HEALTH_CACHE_SECONDS = 15


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_health(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    cache_key = f'deploy-health:{pk}'
    data = cache.get(cache_key)
    if data is None:
        try:
            data = deploy.health(project)
        except deploy.DeployError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        cache.set(cache_key, data, _HEALTH_CACHE_SECONDS)
    return Response(data)


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_history(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    return Response(monitoring.history(project))


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_logs(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    service = request.query_params.get('service') or None
    level = 'error' if request.query_params.get('level') == 'error' else 'all'
    log_range = request.query_params.get('range')
    if log_range not in deploy.LOG_RANGES:
        log_range = '1h'
    query = (request.query_params.get('q') or '').strip()[:200] or None
    try:
        return Response(deploy.logs(project, service=service, level=level,
                                    log_range=log_range, query=query))
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_logs_download(request, pk):
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    service = request.query_params.get('service') or None
    level = 'error' if request.query_params.get('level') == 'error' else 'all'
    log_range = request.query_params.get('range')
    if log_range not in deploy.LOG_RANGES:
        log_range = '1h'
    query = (request.query_params.get('q') or '').strip()[:200] or None
    try:
        result = deploy.export_logs(project, service=service, level=level,
                                    log_range=log_range, query=query)
    except deploy.DeployError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    response = HttpResponse(result['text'], content_type='text/plain; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{result["filename"]}"'
    return response


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


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_recreate(request, pk):
    """'Rebuild from scratch' after a failed, never-been-live deploy: tear the
    stack down and reprovision from a clean slate (deploy.recreate). Guarded here
    so the user gets an immediate error; the long teardown+reprovision runs in a
    background task and is watched via deploy_status like a normal provision."""
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    if not deploy.can_recreate(project):
        return Response(
            {'error': "Rebuild-from-scratch isn't available for this project right now."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.PROVISION)
    tasks.run_recreate_task.delay(str(job.id), str(project.id))
    return Response({'status': 'submitting', 'job_id': str(job.id)})


@api_view(['POST'])
@authentication_classes(_AUTH)
@permission_classes(_PERMS)
def deploy_retry_build(request, pk):
    """Retry just the build step after Deployment.Status.BUILD_FAILED —
    deliberately separate from deploy_start: the CFN stack is already
    CREATE_COMPLETE and must not be resubmitted, only the build needs to run
    again. Uses deploy_status (the same polling endpoint) to watch progress."""
    project, err = _get_project_or_404(request, pk)
    if err:
        return err
    job = AgentJob.objects.create(project=project, kind=AgentJob.Kind.BUILD)
    tasks.run_build_task.delay(str(job.id), str(project.id))
    return Response({'job_id': str(job.id)})
