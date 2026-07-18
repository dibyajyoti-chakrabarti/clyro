from urllib.parse import urlencode

from django.conf import settings

TEMPLATE_URL = 'https://clyro-cfn-bootstrap.s3.amazonaws.com/bootstrap.yaml'


def bootstrap_stack_name(project_name: str) -> str:
    """The connector-stack name baked into the quick-create URL — also the name
    project deletion targets when tearing the connector down."""
    safe_name = ''.join(c if c.isalnum() or c == '-' else '-' for c in project_name)
    return f'ClyroBootstrap-{safe_name}'[:128]


def generate_cfn_console_url(project_name: str, external_id: str, region: str = 'us-east-1') -> str:
    stack_name = bootstrap_stack_name(project_name)

    params = {
        'stackName': stack_name,
        'templateURL': TEMPLATE_URL,
        'param_ClyroAccountId': settings.CLYRO_AWS_ACCOUNT_ID,
        'param_ExternalId': external_id,
    }
    query = urlencode(params)
    base = f'https://console.aws.amazon.com/cloudformation/home?region={region}'
    return f'{base}#/stacks/quickcreate?{query}'
