"""Celery tasks. Populated in Phase 2 with the real scan/canvas-chat/iac task
wrappers; for now just the Phase 1 infra smoke-test task."""

from celery import shared_task

from core.models import AgentJob


@shared_task
def _smoke_task(job_id):
    job = AgentJob.objects.get(id=job_id)
    job.status = AgentJob.Status.DONE
    job.result = {"ok": True}
    job.save(update_fields=["status", "result", "updated_at"])
