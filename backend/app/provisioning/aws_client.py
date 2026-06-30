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
    """Delete a stack (used to clear a rolled-back stack before retrying)."""
    cfn = _cfn_client(credentials, region)
    cfn.delete_stack(StackName=stack_name)
