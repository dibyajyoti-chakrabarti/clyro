import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402


def handler(event, context):
    """One-off admin provisioning, run the same way as ``migrate_handler``:
    swap the Lambda's image Command to ``admin_bootstrap_handler.handler``,
    invoke once, then revert to ``lambda_handler.handler``. It is never on the
    normal request path.

    The username/password come from the invoke payload rather than being baked
    into the image, so no credential is committed to the repo. Delegates to the
    ``create_admin`` management command (create-or-reset-password), which is the
    only sanctioned way to set admin panel credentials.
    """
    event = event or {}
    username = (event.get('username') or '').strip()
    password = event.get('password') or ''
    if not username or not password:
        return {'status': 'error', 'detail': 'username and password are required in the invoke payload'}

    call_command('create_admin', username, password=password)
    return {'status': 'ok', 'username': username}
