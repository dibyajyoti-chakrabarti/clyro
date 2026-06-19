import boto3
from botocore.exceptions import ClientError
from django.conf import settings


def _get_clyro_session():
    profile = getattr(settings, 'AWS_PROFILE', 'default')
    return boto3.Session(profile_name=profile)


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
