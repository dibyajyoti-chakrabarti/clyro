"""Provision (or reset the password of) an admin panel account.

Admin credentials are never self-service — this command is the only way to
create them. Interactive by default; --password exists for scripted setups
where the shell history/process list is not a concern, and
--password-from-ssm for the deployed box, where they very much are.
"""

import os
from getpass import getpass

from django.core.management.base import BaseCommand, CommandError

from core.models import AdminUser

# Beside the other operator secrets under $CLYRO_SSM_PREFIX, so the instance
# role already grants the read and the KMS decrypt.
SSM_SUFFIX = "admin/bootstrap-password"


def _password_from_ssm() -> str:
    """Read the password the container is allowed to read, rather than being
    handed one.

    The deployed path runs through `aws ssm send-command`, which stores its
    command text in the SSM command history and puts it in the container's
    process list, so a --password argument there would leak the credential to
    anyone with ssm:ListCommands. Fetching it inside the process keeps it in
    memory only.
    """
    prefix = os.environ.get("CLYRO_SSM_PREFIX")
    if not prefix:
        raise CommandError(
            "--password-from-ssm needs CLYRO_SSM_PREFIX, which only the "
            "deployed container sets. Use --password locally."
        )

    import boto3  # lazy, so local runs never pay for it

    name = f"{prefix.rstrip('/')}/{SSM_SUFFIX}"
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
    client = boto3.client("ssm", region_name=region)
    try:
        value = client.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]
    except client.exceptions.ParameterNotFound:
        raise CommandError(f"{name} does not exist. Write it before running this.")
    if not value or value == "PENDING":
        raise CommandError(f"{name} still holds its placeholder. Write a real password first.")
    return value


class Command(BaseCommand):
    help = 'Create an admin panel user, or reset its password if it already exists'

    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('--password', help='Set password non-interactively (visible in shell history)')
        parser.add_argument(
            '--password-from-ssm', action='store_true',
            help=f'Read the password from $CLYRO_SSM_PREFIX/{SSM_SUFFIX} (deployed box)',
        )

    def handle(self, *args, **options):
        username = options['username'].strip()
        if not username:
            raise CommandError('username must not be empty')

        if options['password_from_ssm']:
            if options['password']:
                raise CommandError('Pass either --password or --password-from-ssm, not both')
            password = _password_from_ssm()
        else:
            password = options['password']
        if not password:
            password = getpass('Password: ')
            confirm = getpass('Confirm password: ')
            if password != confirm:
                raise CommandError('Passwords do not match')
        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters')

        admin, created = AdminUser.objects.get_or_create(username=username)
        admin.set_password(password)
        admin.is_active = True
        admin.save()

        verb = 'Created' if created else 'Updated password for'
        self.stdout.write(self.style.SUCCESS(f'{verb} admin user "{username}"'))
