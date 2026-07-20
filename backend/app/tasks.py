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


def _iac_progress_callback(job_id: str, initial_phase: str = "drafting"):
    """Shared on_event for generate/refine (B2): derive a live phase from the agent's
    streamed events — text deltas build the template; tool calls mark validate /
    compliance; text after a validate is the model fixing errors, after compliance
    it's finalizing — and throttled-write {phase, partial_template} to the job's
    progress (~1.5s; a phase change flushes immediately). The row-scoped .update()
    touches only `progress`, so it never clobbers the _run status/result save.

    `thinking` is retained here for backend debugging only (raw model reasoning) —
    the frontend must never read or render it directly; the UI drives entirely off
    the curated `phase` enum instead."""
    from core.models import AgentJob
    import time as _time

    state = {"buf": "", "thinking": "", "last_write": 0.0, "phase": initial_phase, "last_tool": None}

    def _write():
        AgentJob.objects.filter(id=job_id).update(
            progress={
                "phase": state["phase"],
                "partial_template": state["buf"][:100_000],
                "thinking": state["thinking"][:20_000],
            }
        )

    def on_event(event):
        if not isinstance(event, dict):
            return
        # Reasoning/thinking deltas (Claude extended thinking / MiniMax native) —
        # streamed before the template so the UI can show a live 'Thinking…' pane.
        reasoning = event.get("reasoning")
        if isinstance(reasoning, str):
            state["thinking"] += reasoning
            state["phase"] = "thinking"
            now = _time.monotonic()
            if now - state["last_write"] >= 1.0:
                state["last_write"] = now
                _write()
            return
        tool = event.get("tool")
        if isinstance(tool, str):
            low = tool.lower()
            if "compliance" in low:
                state["last_tool"], state["phase"] = "compliance", "checking compliance"
            elif "validate" in low:
                state["last_tool"], state["phase"] = "validate", "validating"
            _write()
            return
        data = event.get("data")
        if isinstance(data, str):
            state["buf"] += data
            state["phase"] = {"validate": "fixing", "compliance": "finalizing"}.get(
                state["last_tool"], initial_phase
            )
            now = _time.monotonic()
            if now - state["last_write"] >= 1.5:
                state["last_write"] = now
                _write()

    return on_event


@shared_task
def run_iac_generate_task(job_id: str, project_id: str, model: str | None):
    from app.provisioning import iac

    on_event = _iac_progress_callback(job_id, initial_phase="drafting")

    def _do():
        project = Project.objects.get(id=project_id)
        return iac.generate(project, model=model, on_event=on_event)

    _run(job_id, _do)


@shared_task
def run_iac_refine_task(job_id: str, project_id: str, instruction: str, history: list | None,
                         template: str | None, model: str | None):
    from app.provisioning import iac

    on_event = _iac_progress_callback(job_id, initial_phase="refining")

    def _do():
        project = Project.objects.get(id=project_id)
        return iac.refine(project, instruction, history=history, template=template,
                          model=model, on_event=on_event)

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


@shared_task(soft_time_limit=1500, time_limit=1800)
def run_delete_project_task(job_id: str, project_id: str):
    """Full project delete: purge AWS (app stack, secrets, connector stack —
    deploy.destroy) then hard-delete the DB rows. Not routed through _run():
    the final project.delete() cascades this AgentJob row away too, so _run's
    post-fn job.save() would hit a deleted row — success is signalled to the
    poller by the job 404ing. Failure leaves the row behind with error set and
    flips the project to FAILED so the delete can be retried."""
    from app.provisioning import deploy

    job = AgentJob.objects.get(id=job_id)
    job.status = AgentJob.Status.RUNNING
    job.save(update_fields=["status", "updated_at"])

    def _fail(message: str):
        job.status = AgentJob.Status.FAILED
        job.error = message
        job.save(update_fields=["status", "error", "updated_at"])
        Project.objects.filter(id=project_id).update(status=Project.Status.FAILED)

    try:
        project = Project.objects.get(id=project_id)
        deploy.destroy(project)
        # Deployment's PROTECT FKs (canvas_version/intent_record/aws_connection)
        # block Project.delete()'s cascade to those rows — clear deployments first.
        project.deployments.all().delete()
        project.delete()
    except SoftTimeLimitExceeded:
        log.error("AgentJob %s (delete) hit its soft time limit", job_id)
        _fail("Timed out — infrastructure teardown took longer than expected; delete again to retry.")
    except Exception as exc:
        log.exception("AgentJob %s (delete) failed", job_id)
        _fail(str(exc))


@shared_task
def run_warmup_task(project_id: str, runtime_env_var: str = "IAC_RUNTIME_ARN"):
    # Warm a given AgentCore runtime so the next step's first real call doesn't
    # pay its ~17s cold start. Originally IaC-only (fired on canvas finalize,
    # right before Step-4/5 Generate); now also fired for RepoRecon (Step 1
    # entry) and Reasoning (right after Step 2/3's intent save, before the
    # canvas step). Best-effort — agentcore.warm_runtime swallows all errors,
    # and no AgentJob is tracked (there's nothing for the user to watch).
    from app import agentcore
    agentcore.warm_runtime(runtime_env_var, f"warmup-{project_id}")


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


@shared_task
def run_reconcile_sweep_task():
    # Scheduled via CELERY_BEAT_SCHEDULE (config/settings.py) on the Celery
    # worker — proactively catches dead AWSAccountConnections and stuck
    # 'deleting' Deployments instead of only surfacing them reactively on the
    # user's next action. Not job-tracked (no AgentJob) — nothing user-facing
    # to poll; see app.provisioning.reconcile for the incident that motivated this.
    from app.provisioning import reconcile
    return reconcile.sweep()


@shared_task
def run_health_snapshot_task():
    # Scheduled via CELERY_BEAT_SCHEDULE — records a HealthSnapshot per live
    # project every minute so Step 7 can show uptime and history, which the
    # dashboard's live-only poll can't provide. Not job-tracked (no AgentJob).
    from app.provisioning import monitoring
    return monitoring.collect_snapshots()


@shared_task
def run_log_archive_task():
    # Scheduled via CELERY_BEAT_SCHEDULE — copies each live service's CloudWatch
    # events into the stack's LogArchiveBucket in 5-minute JSONL slots, which
    # the Step 7 logs panel reads for ranges beyond the last hour. Not
    # job-tracked (no AgentJob).
    from app.provisioning import monitoring
    return monitoring.archive_logs()
