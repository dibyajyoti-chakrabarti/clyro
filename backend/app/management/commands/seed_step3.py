"""Seed a project that's already past Steps 1 & 2, sitting at the Step 3 canvas.

This is how the "hardcoded Step 1/2 inputs" become testable: it writes real
rows (User, Project, ScanResult, IntentRecord, EnvVarKeys, CanvasVersion v1)
using the canonical ``invoiceapp`` example from ``canvas_core.examples`` — the
same example the canvas_core tests verify. After running, log in (or use the
DEV_AUTH_BYPASS) and open the printed project URL to land directly in Step 3.

    python manage.py seed_step3 --email you@example.com

Idempotent: re-running resets the project's Step 1/2/3 records.
"""

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from canvas_core import canvas_ops, cost_engine, layout_solver
from canvas_core.examples import (
    SEED_CANVAS_YAML,
    SEED_DETECTED_RESOURCES,
    SEED_ENV_VARS,
    SEED_INTENT,
)
from core.models import (
    CanvasVersion,
    EnvVarKey,
    IntentRecord,
    Project,
    ScanResult,
    User,
)


class Command(BaseCommand):
    help = "Seed a project at the Step 3 canvas stage (hardcoded Step 1/2 outputs)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=getattr(settings, "DEV_USER_EMAIL", "dev@crylo.local"),
            help="Owner email. Defaults to settings.DEV_USER_EMAIL. Use your login email for the browser flow.",
        )
        parser.add_argument("--name", default="invoiceapp", help="Project name.")

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"]
        name = options["name"]

        user, created_user = User.objects.get_or_create(
            email=email,
            defaults={"cognito_sub": f"seed-{email}", "name": "Seed User"},
        )

        repo = SEED_DETECTED_RESOURCES["repository"]
        project, _ = Project.objects.get_or_create(user=user, name=name)

        # Reset the Step 1/2/3 chain so re-seeding is clean.
        CanvasVersion.objects.filter(project=project).delete()
        EnvVarKey.objects.filter(project=project).delete()
        IntentRecord.objects.filter(project=project).delete()
        ScanResult.objects.filter(project=project).delete()

        project.description = SEED_INTENT["description"]
        project.repo_full_name = repo["url"]
        project.repo_branch = repo["branch"]
        project.is_monorepo = repo["is_monorepo"]
        project.status = Project.Status.CANVAS_DRAFT
        project.save()

        # Step 1 — scan result
        scan = ScanResult.objects.create(
            project=project,
            status=ScanResult.Status.COMPLETE,
            detected_resources=SEED_DETECTED_RESOURCES,
            env_vars=SEED_ENV_VARS,
            draft_canvas_yaml=SEED_CANVAS_YAML,
        )
        for ev in SEED_ENV_VARS:
            EnvVarKey.objects.create(
                project=project,
                scan_result=scan,
                key_name=ev["key"],
                classification=ev["classification"],
                source_file=ev.get("source"),
                context_block=ev.get("context"),
                production_default=ev.get("production_default"),
            )

        # Step 2 — intent record
        domain = SEED_INTENT["domain"]
        intent = IntentRecord.objects.create(
            project=project,
            description=SEED_INTENT["description"],
            scale=SEED_INTENT["scale"],
            criticality=SEED_INTENT["criticality"],
            environment=SEED_INTENT["environment"],
            compute_choice=SEED_INTENT["compute_choice"],
            database_choice=SEED_INTENT["database_choice"],
            worker_compute_choice=SEED_INTENT["worker_compute_choice"],
            domain_has=IntentRecord.DomainHas.YES if domain["has_domain"] else IntentRecord.DomainHas.NO,
            domain_name=domain.get("domain_name"),
            completed_at=timezone.now(),
        )

        # Step 3 — initial canvas version (v1)
        canvas = canvas_ops.parse_canvas(SEED_CANVAS_YAML)
        intent_d = {
            "scale": SEED_INTENT["scale"],
            "criticality": SEED_INTENT["criticality"],
            "environment": SEED_INTENT["environment"],
        }
        positions = layout_solver.compute_positions(canvas)
        cost = cost_engine.estimate_cost(canvas, intent_d)
        CanvasVersion.objects.create(
            project=project,
            intent_record=intent,
            version_number=1,
            status=CanvasVersion.Status.DRAFT,
            canvas_yaml=canvas_ops.dump_canvas(canvas),
            canvas_snapshot=canvas_ops.build_canvas_snapshot(canvas, positions, cost),
            operation=CanvasVersion.Operation.INITIAL,
            estimated_cost=cost,
        )

        self.stdout.write(self.style.SUCCESS(f"Seeded '{name}' (project {project.id}) for {email}"))
        self.stdout.write(f"  user {'created' if created_user else 'reused'} · cost ${cost['total']}/mo · canvas v1 (draft)")
        self.stdout.write(self.style.HTTP_INFO(f"  open: /app/projects/{project.id}/"))
