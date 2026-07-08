import boto3
from botocore.exceptions import ClientError
from django.conf import settings


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


def create_stack(credentials: dict, region: str, stack_name: str, template_body: str) -> str:
    """Submit a CloudFormation stack to the user's account. Returns the stack id.
    CAPABILITY_NAMED_IAM is required because the template creates named IAM roles
    (ECS task/execution roles, etc.). create_stack returns immediately — CFN
    provisions asynchronously; progress is read via describe_stack_events."""
    cfn = _cfn_client(credentials, region)
    response = cfn.create_stack(
        StackName=stack_name,
        TemplateBody=template_body,
        Capabilities=['CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
        Tags=[{'Key': 'ManagedBy', 'Value': 'Clyro'}],
        OnFailure='ROLLBACK',
    )
    return response['StackId']


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
    """Return ``{status, reason, outputs}`` for a stack. ``outputs`` is a list of
    ``{output_key, output_value, description}``."""
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
    return {
        'status': stack['StackStatus'],
        'reason': stack.get('StackStatusReason'),
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
