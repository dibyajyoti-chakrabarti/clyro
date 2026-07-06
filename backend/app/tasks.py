"""Celery tasks wrapping the long-running agent invocations that used to block
the Django request/response cycle: repo scan, Step-3 chat, and IaC generate/
refine. Each task fetches its own AgentJob row, runs the existing (unchanged)
service function, and persists the result/error onto that row for the
frontend to poll — same shape as the CFN deploy-status polling already used
in Step 4."""

import logging

from celery import shared_task

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
