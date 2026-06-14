from urllib.parse import urlencode, quote

TEMPLATE_URL = 'https://clyro-cfn-bootstrap.s3.amazonaws.com/bootstrap.yaml'
CLYRO_ACCOUNT_ID = '321613317660'


def generate_cfn_console_url(project_name: str, external_id: str, region: str = 'us-east-1') -> str:
    safe_name = ''.join(c if c.isalnum() or c == '-' else '-' for c in project_name)
    stack_name = f'ClyroBootstrap-{safe_name}'[:128]

    params = {
        'stackName': stack_name,
        'templateURL': TEMPLATE_URL,
        'param_ClyroAccountId': CLYRO_ACCOUNT_ID,
        'param_ExternalId': external_id,
    }
    query = urlencode(params)
    base = f'https://console.aws.amazon.com/cloudformation/home?region={region}'
    return f'{base}#/stacks/quickcreate?{query}'
