import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402


def handler(event, context):
    """Invoked once per deploy by swapping the Lambda's image Command to
    `migrate_handler.handler`, then reverted to `lambda_handler.handler`.
    Not run on every cold start — Lambda concurrency would race migrations.
    """
    call_command('migrate', '--noinput')
    return {'status': 'migrated'}
