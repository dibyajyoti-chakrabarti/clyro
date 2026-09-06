"""Add, remove or list the emails allowed to create projects.

Project creation is gated on core.WhitelistedEmail (checked in projects_list
POST). The admin panel can manage the list, but that needs an admin account and
a browser, which is no use to CI. This command is the scriptable path, so the
e2e suite can grant its own bot account access without a human in the loop.
"""

from django.core.management.base import BaseCommand, CommandError

from core.models import WhitelistedEmail


class Command(BaseCommand):
    help = 'Manage the project-creation email allowlist'

    def add_arguments(self, parser):
        parser.add_argument(
            'action', choices=['add', 'remove', 'list'],
            help='What to do with the allowlist',
        )
        parser.add_argument('email', nargs='?', help='Required for add and remove')
        parser.add_argument('--note', help='Why this email was added')

    def handle(self, *args, **options):
        action = options['action']

        if action == 'list':
            emails = WhitelistedEmail.objects.order_by('email').values_list('email', flat=True)
            if not emails:
                self.stdout.write('The allowlist is empty, so nobody can create projects.')
                return
            for email in emails:
                self.stdout.write(email)
            return

        email = (options['email'] or '').strip().lower()
        if not email:
            raise CommandError(f'"{action}" needs an email address')

        if action == 'add':
            entry, created = WhitelistedEmail.objects.get_or_create(email=email)
            if options['note']:
                entry.note = options['note']
                entry.save()
            verb = 'Added' if created else 'Already present:'
            self.stdout.write(self.style.SUCCESS(f'{verb} {email}'))
            return

        deleted, _ = WhitelistedEmail.objects.filter(email=email).delete()
        if not deleted:
            self.stdout.write(f'{email} was not on the allowlist')
            return
        self.stdout.write(self.style.SUCCESS(f'Removed {email}'))
