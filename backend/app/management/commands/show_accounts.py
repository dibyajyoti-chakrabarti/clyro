"""Print who exists and what they have connected.

Read-only. Answering "can this account run the wizard" otherwise means either
the admin panel or a psql session, and the answer turns on two separate facts:
whether a GitHub App installation exists at all, and which user owns it.
Installations are one-to-one with a user by design, so the owner matters as
much as the existence.
"""

from django.core.management.base import BaseCommand

from core.models import GitHubInstallation, Project, User, WhitelistedEmail


class Command(BaseCommand):
    help = 'Show users, their GitHub installations, and the project-creation allowlist'

    def handle(self, *args, **options):
        allowed = set(WhitelistedEmail.objects.values_list('email', flat=True))

        self.stdout.write('USERS')
        users = User.objects.order_by('email')
        if not users:
            self.stdout.write('  (none)')
        for user in users:
            gate = 'allowlisted' if (user.email or '').lower() in allowed else 'not allowlisted'
            projects = Project.objects.filter(user=user).count()
            self.stdout.write(f'  {user.email}  [{gate}]  projects={projects}')

            installs = GitHubInstallation.objects.filter(user=user).order_by('account_login')
            if not installs:
                self.stdout.write('    github: none')
            for inst in installs:
                suspended = ' SUSPENDED' if inst.suspended_at else ''
                self.stdout.write(
                    f'    github: {inst.account_login} ({inst.account_type}) '
                    f'installation_id={inst.installation_id}{suspended}'
                )

        orphaned = GitHubInstallation.objects.filter(user__isnull=True).count()
        if orphaned:
            self.stdout.write(f'\n{orphaned} installation(s) with no user')

        self.stdout.write(f'\nALLOWLIST ({len(allowed)})')
        for email in sorted(allowed):
            self.stdout.write(f'  {email}')
