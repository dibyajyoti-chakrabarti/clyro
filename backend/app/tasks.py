"""Celery tasks wrapping the long-running agent invocations that used to block
the Django request/response cycle: repo scan, Step-3 chat, and IaC generate/
refine. Each task fetches its own AgentJob row, runs the existing (unchanged)
service function, and persists the result/error onto that row for the
frontend to poll — same shape as the CFN deploy-status polling already used
in Step 4."""

import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from core.models import AgentJob, Project

log = logging.getLogger(__name__)


def _run(job_id: str, fn, *args, **kwargs):
    job = AgentJob.objects.get(id=job_id)
    job.status = AgentJob.Status.RUNNING
    job.save(update_fields=["status", "updated_at"])
    try:
        result = fn(*args, **kwargs)
        job.status = AgentJob.Status.DONE
        job.result = result
        job.save(update_fields=["status", "result", "updated_at"])
    except SoftTimeLimitExceeded:
        # Found live: Celery's hard time limit sends SIGKILL, which Python can't
        # catch at all — a task killed that way leaves its AgentJob stuck at
        # 'running' forever, with the real work (e.g. a CFN stack) left
        # unsupervised. A soft limit fires this catchable exception first, in
        # time to mark the job FAILED cleanly before the hard kill lands.
        log.error("AgentJob %s (%s) hit its soft time limit", job_id, job.kind)
        job.status = AgentJob.Status.FAILED
        job.error = "Timed out — this took longer than expected."
        job.save(update_fields=["status", "error", "updated_at"])
    except Exception as exc:
        log.exception("AgentJob %s (%s) failed", job_id, job.kind)
        job.status = AgentJob.Status.FAILED
        job.error = str(exc)
        job.save(update_fields=["status", "error", "updated_at"])


@shared_task
def run_scan_task(job_id: str, project_id: str):
    from app.scanner import runner
    from core.serializers import ScanResultSerializer

    def _do():
        project = Project.objects.get(id=project_id)
        scan = runner.run_scan_for_project(project)
        return ScanResultSerializer(scan).data

    _run(job_id, _do)


@shared_task
def run_canvas_agent_task(job_id: str, project_id: str, prompt: str, confirm: bool,
                           pending_operation: dict | None, history: list | None):
    from app.canvas import services

    def _do():
        project = Project.objects.get(id=project_id)
        return services.run_canvas_agent(
            project, prompt, confirm=confirm, pending_operation=pending_operation, history=history
        )

    _run(job_id, _do)


@shared_task
def run_iac_generate_task(job_id: str, project_id: str, model: str | None):
    from app.provisioning import iac

    def _do():
        project = Project.objects.get(id=project_id)
        return iac.generate(project, model=model)

    _run(job_id, _do)


@shared_task
def run_iac_refine_task(job_id: str, project_id: str, instruction: str, history: list | None,
                         template: str | None, model: str | None):
    from app.provisioning import iac

    def _do():
        project = Project.objects.get(id=project_id)
        return iac.refine(project, instruction, history=history, template=template, model=model)

    _run(job_id, _do)


@shared_task(soft_time_limit=3300, time_limit=3600)
def run_provision_task(job_id: str, project_id: str):
    # Needs far more headroom than the 900s global default (config/settings.py) —
    # up to two full CFN create/rollback cycles (each up to _POLL_TIMEOUT_SECONDS)
    # plus one iac.refine() round in between, plus (now) the build step that
    # runs once CFN itself is live — see deploy.provision_with_feedback.
    from app.provisioning import deploy

    def _do():
        project = Project.objects.get(id=project_id)
        return deploy.provision_with_feedback(project)

    _run(job_id, _do)


@shared_task(soft_time_limit=3300, time_limit=3600)
def run_recreate_task(job_id: str, project_id: str):
    # 'Rebuild from scratch' — teardown + a full reprovision (deploy.recreate).
    # Same generous ceiling as run_provision_task, which it wraps after the
    # teardown wait; the never-been-live gate is enforced in deploy.recreate.
    from app.provisioning import deploy

    def _do():
        project = Project.objects.get(id=project_id)
        return deploy.recreate(project)

    _run(job_id, _do)


@shared_task
def run_warmup_task(project_id: str):
    # Warm the IaC runtime so Step-4 Generate doesn't pay cold-start. Fired on
    # canvas finalize; best-effort — agentcore.warm_runtime swallows all errors,
    # and no AgentJob is tracked (there's nothing for the user to watch).
    from app import agentcore
    agentcore.warm_runtime("IAC_RUNTIME_ARN", f"warmup-{project_id}")


@shared_task(soft_time_limit=2100, time_limit=2400)
def run_build_task(job_id: str, project_id: str):
    # A "Retry build" click after Deployment.Status.BUILD_FAILED — deliberately
    # does NOT go through provision_with_feedback (which would re-poll/retry
    # the CFN stack); the stack is already CREATE_COMPLETE and untouched, only
    # the build step needs to run again. The ceiling must cover the build poll
    # (build._POLL_TIMEOUT_SECONDS) plus the post-build ECS scale-up wait
    # (deploy._STEADY_TIMEOUT_SECONDS), since build_with_feedback does both.
    from app.provisioning import build

    def _do():
        project = Project.objects.get(id=project_id)
        return build.build_with_feedback(project)

    _run(job_id, _do)
