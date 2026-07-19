"""Provision (or reset the password of) an admin panel account.

Admin credentials are never self-service — this command is the only way to
create them. Interactive by default; --password exists for scripted setups
where the shell history/process list is not a concern.
"""

from getpass import getpass

from django.core.management.base import BaseCommand, CommandError

from core.models import AdminUser


class Command(BaseCommand):
    help = 'Create an admin panel user, or reset its password if it already exists'

    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('--password', help='Set password non-interactively (visible in shell history)')

    def handle(self, *args, **options):
        username = options['username'].strip()
        if not username:
            raise CommandError('username must not be empty')

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
