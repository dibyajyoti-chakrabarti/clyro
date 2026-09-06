from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def bootstrap_stack_name(project_name: str) -> str:
    """The connector-stack name baked into the quick-create URL — also the name
    project deletion targets when tearing the connector down."""
    safe_name = ''.join(c if c.isalnum() or c == '-' else '-' for c in project_name)
    return f'ClyroBootstrap-{safe_name}'[:128]


def generate_cfn_console_url(project_name: str, external_id: str, region: str = 'us-east-1') -> str:
    stack_name = bootstrap_stack_name(project_name)

    template_url = settings.CFN_BOOTSTRAP_TEMPLATE_URL
    if not template_url:
        # Better to fail here than to hand back a link that opens a broken
        # CloudFormation page in the user's own console, where nothing Clyro
        # logs would ever show the failure.
        raise ImproperlyConfigured(
            'CFN_BOOTSTRAP_TEMPLATE_URL is not set, so the Step 2 quick-create '
            'link would point nowhere. It is published by the foundation '
            'Terraform layer as /clyro/prod/env/CFN_BOOTSTRAP_TEMPLATE_URL.'
        )

    params = {
        'stackName': stack_name,
        'templateURL': template_url,
        'param_ClyroAccountId': settings.CLYRO_AWS_ACCOUNT_ID,
        'param_ExternalId': external_id,
    }
    query = urlencode(params)
    base = f'https://console.aws.amazon.com/cloudformation/home?region={region}'
    return f'{base}#/stacks/quickcreate?{query}'
