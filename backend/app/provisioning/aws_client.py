import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings

log = logging.getLogger(__name__)


def _get_clyro_session():
    # In production (DEBUG=False) the compute's attached IAM role provides
    # credentials automatically via the metadata endpoint — no profile needed.
    # Named profiles are only used in local development.
    if getattr(settings, 'DEBUG', False):
        profile = getattr(settings, 'AWS_PROFILE', 'default')
        return boto3.Session(profile_name=profile)
    return boto3.Session()


def assume_role(role_arn: str, external_id: str, session_name: str = 'ClyroSession') -> dict:
    """
    Assume a cross-account role using Clyro's own credentials.
    Returns the temporary credentials dict on success, raises on failure.
    """
    session = _get_clyro_session()
    sts = session.client('sts', region_name=getattr(settings, 'AWS_REGION', 'us-east-1'))
    response = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=session_name,
        ExternalId=external_id,
        DurationSeconds=3600,
    )
    return response['Credentials']


def get_account_id(credentials: dict, region: str = 'us-east-1') -> str:
    """
    Call sts:GetCallerIdentity using temporary credentials to retrieve aws account ID.
    """
    sts = boto3.client(
        'sts',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )
    identity = sts.get_caller_identity()
    return identity['Account']


def get_account_plan_type(credentials: dict, region: str = 'us-east-1') -> str | None:
    """Proactively ask AWS itself (freetier:GetAccountPlanState) whether the
    connected account is FREE or PAID, using the just-assumed role's credentials.
    Returns the raw ``accountPlanType`` string, or None if the call fails for any
    reason (missing permission, API not available in this partition/region, etc.)
    — this is a best-effort enrichment, never a reason to fail the connect flow."""
    try:
        client = boto3.client(
            'freetier',
            region_name=region,
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
        )
        response = client.get_account_plan_state()
        return response.get('accountPlanType')
    except (ClientError, BotoCoreError) as exc:
        log.info("get_account_plan_type: could not determine account plan type: %s", exc)
        return None


def write_secret(credentials: dict, region: str, secret_name: str, secret_value: str) -> str:
    """
    Write a single secret to AWS Secrets Manager in the user's account using assumed-role credentials.
    Creates the secret if it doesn't exist; updates it if it does.
    Returns the secret ARN.
    """
    sm = boto3.client(
        'secretsmanager',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )
    try:
        response = sm.create_secret(
            Name=secret_name,
            SecretString=secret_value,
            Tags=[{'Key': 'ManagedBy', 'Value': 'Clyro'}],
        )
        return response['ARN']
    except ClientError as exc:
        if exc.response['Error']['Code'] == 'ResourceExistsException':
            response = sm.put_secret_value(SecretId=secret_name, SecretString=secret_value)
            return response['ARN']
        raise


# ── CloudFormation (Step 4.5 provisioning) ─────────────────────────────────────

def _cfn_client(credentials: dict, region: str):
    return boto3.client(
        'cloudformation',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def create_stack(
    credentials: dict, region: str, stack_name: str, template_body: str,
    parameters: dict[str, str] | None = None,
) -> str:
    """Submit a CloudFormation stack to the user's account. Returns the stack id.
    CAPABILITY_NAMED_IAM is required because the template creates named IAM roles
    (ECS task/execution roles, etc.). create_stack returns immediately — CFN
    provisions asynchronously; progress is read via describe_stack_events."""
    cfn = _cfn_client(credentials, region)
    kwargs = {}
    if parameters:
        kwargs['Parameters'] = [{'ParameterKey': k, 'ParameterValue': v} for k, v in parameters.items()]
    response = cfn.create_stack(
        StackName=stack_name,
        TemplateBody=template_body,
        Capabilities=['CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
        Tags=[{'Key': 'ManagedBy', 'Value': 'Clyro'}],
        OnFailure='ROLLBACK',
        **kwargs,
    )
    return response['StackId']


def find_hosted_zone_id(credentials: dict, region: str, zone_name: str) -> str | None:
    """Paginate route53:ListHostedZones and return the zone id (without the
    '/hostedzone/' prefix) whose name matches ``zone_name``, or None. Route53
    is a global service — ``region`` is accepted only for signature
    consistency with the rest of this module. Uses ListHostedZones (already
    granted in bootstrap.yaml) rather than ListHostedZonesByName (not
    granted, and unnecessary — client-side filtering is cheap at this scale)."""
    route53 = boto3.client(
        'route53',
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )
    target = f"{zone_name}." if not zone_name.endswith('.') else zone_name
    paginator = route53.get_paginator('list_hosted_zones')
    for page in paginator.paginate():
        for zone in page.get('HostedZones', []):
            if zone.get('Name') == target:
                return zone['Id'].removeprefix('/hostedzone/')
    return None


def find_stack(credentials: dict, region: str, stack_name: str) -> str | None:
    """Return the current StackStatus for ``stack_name``, or None if no such stack
    exists. Used to decide block (live) vs delete-then-recreate (rolled back)."""
    cfn = _cfn_client(credentials, region)
    try:
        response = cfn.describe_stacks(StackName=stack_name)
    except ClientError as exc:
        if 'does not exist' in exc.response['Error']['Message']:
            return None
        raise
    stacks = response.get('Stacks') or []
    return stacks[0]['StackStatus'] if stacks else None


def describe_stack(credentials: dict, region: str, stack_name: str) -> dict:
    """Return ``{stack_name, status, reason, last_updated_time, outputs}`` for a
    stack. ``outputs`` is a list of ``{output_key, output_value, description}``;
    ``last_updated_time`` is an ISO string (CreationTime for never-updated stacks)."""
    cfn = _cfn_client(credentials, region)
    response = cfn.describe_stacks(StackName=stack_name)
    stack = response['Stacks'][0]
    outputs = [
        {
            'output_key': o.get('OutputKey'),
            'output_value': o.get('OutputValue'),
            'description': o.get('Description'),
        }
        for o in stack.get('Outputs', [])
    ]
    last_updated = stack.get('LastUpdatedTime') or stack.get('CreationTime')
    return {
        'stack_name': stack.get('StackName'),
        'status': stack['StackStatus'],
        'reason': stack.get('StackStatusReason'),
        'last_updated_time': last_updated.isoformat() if last_updated else None,
        'outputs': outputs,
    }


def describe_stack_events(credentials: dict, region: str, stack_name: str) -> list[dict]:
    """Return all stack events, oldest first (CFN returns newest first)."""
    cfn = _cfn_client(credentials, region)
    events: list[dict] = []
    paginator = cfn.get_paginator('describe_stack_events')
    for page in paginator.paginate(StackName=stack_name):
        events.extend(page.get('StackEvents', []))
    events.reverse()  # oldest first, so sequence numbers grow with time
    return events


def delete_stack(credentials: dict, region: str, stack_name: str) -> None:
    """Delete a stack (used to clear a rolled-back stack before retrying, and for
    a full teardown)."""
    cfn = _cfn_client(credentials, region)
    cfn.delete_stack(StackName=stack_name)


def create_change_set(credentials: dict, region: str, stack_name: str,
                      template_body: str, change_set_name: str) -> str:
    """Create an UPDATE change set for a live stack. A change set is CFN's dry-run:
    it computes what the template would do (including whether any resource would be
    *replaced*, i.e. destroyed and recreated) WITHOUT applying it, so an update that
    would drop a database can be refused before it runs. Returns the change set id;
    creation is async — poll ``describe_change_set`` for CREATE_COMPLETE."""
    cfn = _cfn_client(credentials, region)
    response = cfn.create_change_set(
        StackName=stack_name,
        TemplateBody=template_body,
        ChangeSetName=change_set_name,
        ChangeSetType='UPDATE',
        Capabilities=['CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
    )
    return response['Id']


def describe_change_set(credentials: dict, region: str, change_set_id: str) -> dict:
    """Return ``{status, status_reason, changes}`` for a change set. Each change is
    ``{action, logical_id, resource_type, replacement}`` — ``replacement`` is the
    decisive signal ('True'/'Conditional' means the resource is destroyed and
    recreated). An empty change set finishes with status FAILED and a status_reason
    that says the submission didn't contain changes."""
    cfn = _cfn_client(credentials, region)
    response = cfn.describe_change_set(ChangeSetName=change_set_id)
    changes = []
    for change in response.get('Changes', []):
        rc = change.get('ResourceChange') or {}
        changes.append({
            'action': rc.get('Action'),
            'logical_id': rc.get('LogicalResourceId'),
            'resource_type': rc.get('ResourceType'),
            'replacement': rc.get('Replacement'),
        })
    return {
        'status': response.get('Status'),
        'status_reason': response.get('StatusReason'),
        'changes': changes,
    }


def execute_change_set(credentials: dict, region: str, change_set_id: str) -> None:
    """Apply a change set — this is the actual UpdateStack. Progress is read via
    describe_stack_events / describe_stack the same way a create is."""
    cfn = _cfn_client(credentials, region)
    cfn.execute_change_set(ChangeSetName=change_set_id)


def delete_change_set(credentials: dict, region: str, change_set_id: str) -> None:
    """Discard a change set (an empty or refused one) so it doesn't linger on the
    stack. Best-effort — a missing change set is not an error here."""
    cfn = _cfn_client(credentials, region)
    try:
        cfn.delete_change_set(ChangeSetName=change_set_id)
    except ClientError:
        pass


def list_stack_resources(credentials: dict, region: str, stack_name: str) -> list[dict]:
    """Return every resource in the stack as
    ``{logical_id, physical_id, resource_type}`` — used to find the ECS
    services / RDS instances-clusters to pause or resume."""
    cfn = _cfn_client(credentials, region)
    resources: list[dict] = []
    paginator = cfn.get_paginator('list_stack_resources')
    for page in paginator.paginate(StackName=stack_name):
        for r in page.get('StackResourceSummaries', []):
            resources.append({
                'logical_id': r.get('LogicalResourceId'),
                'physical_id': r.get('PhysicalResourceId'),
                'resource_type': r.get('ResourceType'),
            })
    return resources


# ── Pause / resume (ECS scale-to-zero + RDS stop) ───────────────────────────────

def _ecs_client(credentials: dict, region: str):
    return boto3.client(
        'ecs',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def _rds_client(credentials: dict, region: str):
    return boto3.client(
        'rds',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def parse_ecs_service_arn(service_arn: str) -> tuple[str, str] | None:
    """``arn:aws:ecs:region:account:service/cluster-name/service-name`` ->
    ``(cluster_name, service_name)``. Returns ``None`` if the ARN doesn't match."""
    parts = service_arn.split(':')
    if len(parts) < 6 or not parts[5].startswith('service/'):
        return None
    resource_parts = parts[5].split('/')
    if len(resource_parts) != 3:
        return None
    return resource_parts[1], resource_parts[2]


def get_ecs_service_desired_count(credentials: dict, region: str, cluster: str, service: str) -> int:
    ecs = _ecs_client(credentials, region)
    resp = ecs.describe_services(cluster=cluster, services=[service])
    services = resp.get('services') or []
    return services[0]['desiredCount'] if services else 0


def set_ecs_service_desired_count(credentials: dict, region: str, cluster: str, service: str, desired: int) -> None:
    ecs = _ecs_client(credentials, region)
    ecs.update_service(cluster=cluster, service=service, desiredCount=desired)


def get_ecs_service_counts(credentials: dict, region: str, cluster: str, service: str) -> dict:
    """``{running, pending, desired}`` for one service — used to tell "scaled up and
    actually serving" from "scaled up and crash-looping"."""
    ecs = _ecs_client(credentials, region)
    resp = ecs.describe_services(cluster=cluster, services=[service])
    services = resp.get('services') or []
    if not services:
        return {'running': 0, 'pending': 0, 'desired': 0}
    svc = services[0]
    return {
        'running': svc.get('runningCount', 0),
        'pending': svc.get('pendingCount', 0),
        'desired': svc.get('desiredCount', 0),
    }


def is_db_cluster_member(credentials: dict, region: str, db_instance_id: str) -> bool:
    """True if ``db_instance_id`` belongs to an Aurora cluster — cluster members
    can't be stopped/started individually, only via the cluster itself."""
    rds = _rds_client(credentials, region)
    resp = rds.describe_db_instances(DBInstanceIdentifier=db_instance_id)
    instances = resp.get('DBInstances') or []
    return bool(instances and instances[0].get('DBClusterIdentifier'))


def stop_db_instance(credentials: dict, region: str, db_instance_id: str) -> None:
    rds = _rds_client(credentials, region)
    try:
        rds.stop_db_instance(DBInstanceIdentifier=db_instance_id)
    except ClientError as exc:
        # Already stopped/stopping — not an error for a pause action.
        if exc.response['Error']['Code'] not in ('InvalidDBInstanceState',):
            raise


def start_db_instance(credentials: dict, region: str, db_instance_id: str) -> None:
    rds = _rds_client(credentials, region)
    try:
        rds.start_db_instance(DBInstanceIdentifier=db_instance_id)
    except ClientError as exc:
        if exc.response['Error']['Code'] not in ('InvalidDBInstanceState',):
            raise


def stop_db_cluster(credentials: dict, region: str, db_cluster_id: str) -> None:
    rds = _rds_client(credentials, region)
    try:
        rds.stop_db_cluster(DBClusterIdentifier=db_cluster_id)
    except ClientError as exc:
        if exc.response['Error']['Code'] not in ('InvalidDBClusterStateFault',):
            raise


def start_db_cluster(credentials: dict, region: str, db_cluster_id: str) -> None:
    rds = _rds_client(credentials, region)
    try:
        rds.start_db_cluster(DBClusterIdentifier=db_cluster_id)
    except ClientError as exc:
        if exc.response['Error']['Code'] not in ('InvalidDBClusterStateFault',):
            raise


# ── Build step (CodeBuild + the S3 staging bucket its source archive lives in) ──

def _s3_client(credentials: dict, region: str):
    return boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def _codebuild_client(credentials: dict, region: str):
    return boto3.client(
        'codebuild',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def put_object(credentials: dict, region: str, bucket: str, key: str, body: bytes) -> None:
    """Upload the downloaded repo archive to the customer account's own staging
    bucket (created alongside the CodeBuild projects) using the assumed-role
    credentials — CodeBuild reads its build source from here via
    ``sourceLocationOverride``, refreshed per build rather than baked into the
    CFN template."""
    s3 = _s3_client(credentials, region)
    s3.put_object(Bucket=bucket, Key=key, Body=body)


def start_codebuild(credentials: dict, region: str, project_name: str, source_location: str) -> str:
    """Start a build, overriding the CFN-time placeholder Source.Location with
    the freshly-uploaded archive key. Returns the build id."""
    codebuild = _codebuild_client(credentials, region)
    response = codebuild.start_build(
        projectName=project_name,
        sourceTypeOverride='S3',
        sourceLocationOverride=source_location,
    )
    return response['build']['id']


def empty_s3_bucket(credentials: dict, region: str, bucket: str) -> None:
    """Delete every object (and, for a versioned bucket, every version and
    delete marker) in a bucket the stack is about to delete. CloudFormation
    can't delete a non-empty bucket — found live: a real teardown attempt hit
    DELETE_FAILED on both the frontend and build-archive buckets because
    nothing ever did this first."""
    s3 = _s3_client(credentials, region)
    paginator = s3.get_paginator('list_object_versions')
    for page in paginator.paginate(Bucket=bucket):
        to_delete = [
            {'Key': v['Key'], 'VersionId': v['VersionId']}
            for v in page.get('Versions', []) + page.get('DeleteMarkers', [])
        ]
        if to_delete:
            s3.delete_objects(Bucket=bucket, Delete={'Objects': to_delete})


def _ecr_client(credentials: dict, region: str):
    return boto3.client(
        'ecr',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def empty_ecr_repository(credentials: dict, region: str, repository_name: str) -> None:
    """Delete every image in a repository the stack is about to delete —
    same DELETE_FAILED problem as empty_s3_bucket, for ECR instead of S3."""
    ecr = _ecr_client(credentials, region)
    paginator = ecr.get_paginator('list_images')
    for page in paginator.paginate(repositoryName=repository_name):
        image_ids = page.get('imageIds', [])
        if image_ids:
            ecr.batch_delete_image(repositoryName=repository_name, imageIds=image_ids)


def batch_get_builds(credentials: dict, region: str, build_ids: list[str]) -> list[dict]:
    """Return CodeBuild's own build summaries (``buildStatus``, ``phases``,
    ``logs``, etc.) for the given build ids."""
    codebuild = _codebuild_client(credentials, region)
    response = codebuild.batch_get_builds(ids=build_ids)
    return response.get('builds') or []


# ── Runtime probes ───────────────────────────────────────────────────────────
#
# Everything above answers "did AWS accept our API call?". These answer "is the
# customer's app actually working?" — the question CloudFormation cannot, since
# a stack reaches CREATE_COMPLETE the moment its resources exist, regardless of
# whether a single container inside them can serve a request. Consumed by
# runtime_probe.py, which turns them into a root cause.


def _elbv2_client(credentials: dict, region: str):
    return boto3.client(
        'elbv2',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def _logs_client(credentials: dict, region: str):
    return boto3.client(
        'logs',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def describe_ecs_service(credentials: dict, region: str, cluster: str, service: str) -> dict:
    """The full service dict. get_ecs_service_counts() throws away everything but
    the three counts; a runtime diagnosis needs ``loadBalancers`` (to find the
    target group), ``deployments`` (rolloutState) and ``events``."""
    ecs = _ecs_client(credentials, region)
    services = ecs.describe_services(cluster=cluster, services=[service]).get('services') or []
    return services[0] if services else {}


def describe_stopped_tasks(credentials: dict, region: str, cluster: str, service: str,
                           limit: int = 5) -> list[dict]:
    """The most recently stopped tasks for a service. ECS keeps stopped tasks
    queryable for roughly an hour — long enough to explain a crash-loop, and the
    only place ``stoppedReason`` and a container's ``exitCode`` ever appear."""
    ecs = _ecs_client(credentials, region)
    arns = ecs.list_tasks(
        cluster=cluster, serviceName=service, desiredStatus='STOPPED',
    ).get('taskArns') or []
    if not arns:
        return []
    return ecs.describe_tasks(cluster=cluster, tasks=arns[:limit]).get('tasks') or []


def task_definition_log_groups(credentials: dict, region: str, task_definition: str) -> list[str]:
    """The awslogs group each container in a task definition writes to. Derived
    from the task definition rather than guessed from a naming convention, since
    the template is authored by an LLM and its log-group names vary."""
    ecs = _ecs_client(credentials, region)
    task_def = ecs.describe_task_definition(
        taskDefinition=task_definition,
    ).get('taskDefinition') or {}
    groups = []
    for container in task_def.get('containerDefinitions') or []:
        options = (container.get('logConfiguration') or {}).get('options') or {}
        group = options.get('awslogs-group')
        if group and group not in groups:
            groups.append(group)
    return groups


def describe_target_health(credentials: dict, region: str, target_group_arn: str) -> list[dict]:
    """``[{state, reason, description}]`` per registered target. The decisive signal
    for "the container runs but the load balancer refuses to send it traffic"."""
    elbv2 = _elbv2_client(credentials, region)
    descriptions = elbv2.describe_target_health(
        TargetGroupArn=target_group_arn,
    ).get('TargetHealthDescriptions') or []
    return [
        {
            'state': d.get('TargetHealth', {}).get('State', ''),
            'reason': d.get('TargetHealth', {}).get('Reason', ''),
            'description': d.get('TargetHealth', {}).get('Description', ''),
        }
        for d in descriptions
    ]


def task_definition_containers(credentials: dict, region: str, task_definition: str) -> list[dict]:
    """``[{name, image}]`` for every container in a task definition. Used to pick
    which container a one-off migration run overrides the command of — the task
    definition is authored by an LLM, so container names aren't guessable."""
    ecs = _ecs_client(credentials, region)
    task_def = ecs.describe_task_definition(
        taskDefinition=task_definition,
    ).get('taskDefinition') or {}
    return [
        {'name': c.get('name'), 'image': c.get('image')}
        for c in task_def.get('containerDefinitions') or []
        if c.get('name')
    ]


def run_task(credentials: dict, region: str, cluster: str, task_definition: str,
             container_name: str, command: list[str], subnets: list[str],
             security_groups: list[str], assign_public_ip: str = 'DISABLED') -> str:
    """Run a task definition ONCE (RunTask), overriding one container's command —
    how a database migration runs: it reuses the app's own task definition (image,
    secret injection, execution role, log config all intact) and just changes the
    entrypoint to the migrate command. ``subnets``/``security_groups``/
    ``assign_public_ip`` are lifted from the live service so the one-off task has
    identical network reachability to the database. Returns the task ARN, or raises
    if ECS refused to place the task."""
    ecs = _ecs_client(credentials, region)
    response = ecs.run_task(
        cluster=cluster,
        taskDefinition=task_definition,
        launchType='FARGATE',
        count=1,
        overrides={'containerOverrides': [{'name': container_name, 'command': command}]},
        networkConfiguration={'awsvpcConfiguration': {
            'subnets': subnets,
            'securityGroups': security_groups,
            'assignPublicIp': assign_public_ip,
        }},
    )
    tasks = response.get('tasks') or []
    if not tasks:
        failures = response.get('failures') or []
        reason = '; '.join(f.get('reason', '') for f in failures) or 'unknown reason'
        raise RuntimeError(f'ECS refused to start the task: {reason}')
    return tasks[0]['taskArn']


def describe_task(credentials: dict, region: str, cluster: str, task_arn: str) -> dict:
    """The full task dict for one task — ``lastStatus``, ``stoppedReason``, and each
    container's ``exitCode``/``reason``, which is how a one-off run reports success
    (exit 0) or failure."""
    ecs = _ecs_client(credentials, region)
    tasks = ecs.describe_tasks(cluster=cluster, tasks=[task_arn]).get('tasks') or []
    return tasks[0] if tasks else {}


def tail_log_group(credentials: dict, region: str, log_group: str, limit: int = 20) -> list[str]:
    """The last ``limit`` messages from the most recently active stream in a log
    group. Returns [] rather than raising when the group does not exist yet — a
    container that dies before its first write leaves no stream at all, and that
    absence is itself diagnostic rather than an error."""
    logs = _logs_client(credentials, region)
    try:
        streams = logs.describe_log_streams(
            logGroupName=log_group, orderBy='LastEventTime', descending=True, limit=1,
        ).get('logStreams') or []
        if not streams:
            return []
        events = logs.get_log_events(
            logGroupName=log_group, logStreamName=streams[0]['logStreamName'],
            limit=limit, startFromHead=False,
        ).get('events') or []
    except ClientError:
        return []
    return [e.get('message', '').rstrip() for e in events]


def _cloudwatch_client(credentials: dict, region: str):
    return boto3.client(
        'cloudwatch',
        region_name=region,
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def get_cloudwatch_metric(credentials: dict, region: str, namespace: str, metric_name: str,
                          dimensions: list[dict], stat: str = 'Average', minutes: int = 5) -> float | None:
    """Latest datapoint for one metric over the last ``minutes``, or None if there's
    no data yet or the role can't read it (bootstrap roles created before the
    cloudwatch:GetMetricData grant was added — degrade gracefully rather than 500)."""
    from datetime import datetime, timedelta, timezone

    cloudwatch = _cloudwatch_client(credentials, region)
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=minutes)
    try:
        response = cloudwatch.get_metric_data(
            MetricDataQueries=[{
                'Id': 'm1',
                'MetricStat': {
                    'Metric': {
                        'Namespace': namespace,
                        'MetricName': metric_name,
                        'Dimensions': dimensions,
                    },
                    'Period': minutes * 60,
                    'Stat': stat,
                },
                'ReturnData': True,
            }],
            StartTime=start,
            EndTime=end,
        )
    except ClientError:
        return None
    values = (response.get('MetricDataResults') or [{}])[0].get('Values') or []
    return values[0] if values else None
