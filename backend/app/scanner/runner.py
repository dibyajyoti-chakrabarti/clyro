"""Step 1 orchestration: ingest the repo's ``CLYRO.md`` contract.

Clyro no longer scans repos itself. The user runs the ``/clyro-scan`` skill with
their own coding agent, which reads their real checkout, fixes what isn't cloud
compliant, and pushes a ``CLYRO.md``. This module reads that file and populates
the same ``ScanResult`` + ``EnvVarKey`` rows the in-cloud scan used to, so
Steps 2-6 are unchanged. See documentation/ch_20 for the full rationale.

Two things stay Clyro's job rather than the contract's:

**Compliance is always recomputed here.** CLYRO.md is committed and hand-editable,
so its ``compliance_findings`` are a claim. Re-running ``compliance.py`` against
the live tree costs a handful of GitHub calls and no LLM, and it means a contract
edited to say every check passed can't walk a blocker into the build. The
recomputed set is what gets stored and what gates the wizard; where it disagrees
with the file, the disagreement itself is surfaced.

**Staleness is judged on content, not on sha equality.** The skill commits
CLYRO.md itself, so the branch head is normally one commit ahead of the
``commit_sha`` inside it. Only a change to a file detection actually reads makes
the contract stale.
"""

from core.models import EnvVarKey, Project, ScanResult
from app.github_utils import get_installation_access_token
from . import clyro_md, compliance


def run_scan_for_project(project: Project) -> ScanResult:
    scan = ScanResult.objects.create(
        project=project,
        status=ScanResult.Status.RUNNING,
        source=ScanResult.Source.CLYRO_MD,
    )

    try:
        token = get_installation_access_token(project.github_installation.installation_id)
        raw = clyro_md.fetch(token, project.repo_full_name, project.repo_branch)

        if raw is None:
            return _block_missing(scan, project)

        scan.contract_raw = raw

        try:
            parsed = clyro_md.parse(raw)
        except clyro_md.ContractError as exc:
            return _block_invalid(scan, project, exc.errors)

        errors = clyro_md.validate(parsed)
        if errors:
            return _block_invalid(scan, project, errors)

        scan.contract_meta = clyro_md.metadata(parsed)
        detection = clyro_md.to_detection(parsed)

        # A contract that already knows the repo can't be deployed (no Postgres,
        # not Django) carries the explanation and no resources — surface it as a
        # block, exactly as the in-cloud scan did.
        if detection["status"] != "complete":
            return _block_from_contract(scan, project, detection)

        scan.detected_resources = detection["detected_resources"]
        scan.env_vars = detection["env_vars"]
        scan.status = ScanResult.Status.COMPLETE

        # Never trust the file's own findings — recompute. Kept best-effort for
        # the same reason as before: a failed GitHub call here must not take down
        # an otherwise-good ingest.
        try:
            scan.compliance_findings = compliance.run_compliance_checks(
                token, project.repo_full_name, project.repo_branch,
                scan.detected_resources, scan.env_vars or [],
            )
        except Exception:
            scan.compliance_findings = None

        scan.contract_drift = _detect_drift(
            token, project, parsed, scan.compliance_findings, scan.contract_meta,
        )

        scan.save(update_fields=[
            "status", "detected_resources", "env_vars", "compliance_findings",
            "contract_raw", "contract_meta", "contract_drift",
        ])

        _save_env_var_keys(project, scan, scan.env_vars or [])

        is_monorepo = (scan.detected_resources or {}).get("repository", {}).get("is_monorepo")
        project.is_monorepo = is_monorepo
        project.status = Project.Status.SCAN_COMPLETE
        project.save(update_fields=["status", "is_monorepo", "updated_at"])

    except Exception as exc:
        scan.status = ScanResult.Status.FAILED
        scan.block_reason = str(exc)
        scan.save(update_fields=["status", "block_reason"])
        project.status = Project.Status.FAILED
        project.save(update_fields=["status", "updated_at"])

    return scan


def _block_missing(scan: ScanResult, project: Project) -> ScanResult:
    """No CLYRO.md on the branch. Not a failure — the user just hasn't run the
    skill yet, so the project stays at repo_connected and Step 1 shows setup
    instructions with a re-check button. Moving it to FAILED (as every other
    block does) would strand them behind a dead-end status."""
    scan.status = ScanResult.Status.BLOCKED
    scan.block_reason = "clyro_md_missing"
    scan.contract_drift = [
        f"No CLYRO.md found at the root of {project.repo_full_name} on branch "
        f"{project.repo_branch}. Run /clyro-scan --fix in your repo and push."
    ]
    scan.save(update_fields=["status", "block_reason", "contract_drift"])
    project.status = Project.Status.REPO_CONNECTED
    project.save(update_fields=["status", "updated_at"])
    return scan


def _block_invalid(scan: ScanResult, project: Project, errors: list[str]) -> ScanResult:
    """CLYRO.md exists but doesn't validate — a hand-edit gone wrong, or an agent
    that emitted an off-schema file. Also retryable: the errors are shown so the
    user can regenerate, and the project stays where it was."""
    scan.status = ScanResult.Status.BLOCKED
    scan.block_reason = "clyro_md_invalid"
    scan.contract_drift = errors
    scan.save(update_fields=["status", "block_reason", "contract_raw", "contract_drift"])
    project.status = Project.Status.REPO_CONNECTED
    project.save(update_fields=["status", "updated_at"])
    return scan


def _block_from_contract(scan: ScanResult, project: Project, detection: dict) -> ScanResult:
    """The contract itself reports the repo as unsupported."""
    scan.status = ScanResult.Status.BLOCKED
    scan.block_reason = detection.get("block_message") or detection.get("block_reason")
    scan.save(update_fields=["status", "block_reason", "contract_raw", "contract_meta"])

    if detection["status"] == "hard_block":
        project.status = Project.Status.FAILED
        project.save(update_fields=["status", "updated_at"])
    return scan


def _detect_drift(token, project, parsed, recomputed, meta) -> list[str] | None:
    """Everywhere the contract and reality disagree, in user-facing wording.

    Two independent sources of disagreement: compliance findings the contract
    claimed differently to what we just verified, and repo changes since the
    contract was generated. Both are warnings — the recomputed findings already
    gate the wizard, so drift is for explaining *why* the user is seeing
    something they didn't expect.
    """
    notes: list[str] = []
    notes.extend(_compliance_drift(parsed.get("compliance_findings"), recomputed))
    notes.extend(_staleness_drift(token, project, meta))
    return notes or None


def _compliance_drift(claimed, recomputed) -> list[str]:
    if not isinstance(claimed, list) or not recomputed:
        return []

    claimed_by_id = {
        f.get("id"): f for f in claimed
        if isinstance(f, dict) and f.get("id")
    }
    notes = []
    for finding in recomputed:
        was = claimed_by_id.get(finding.get("id"))
        if was is None or was.get("passed") == finding.get("passed"):
            continue
        if finding.get("passed"):
            notes.append(
                f"{finding.get('title')}: CLYRO.md recorded this as failing, but it passes now. "
                "Regenerate CLYRO.md to keep the contract in sync."
            )
        else:
            notes.append(
                f"{finding.get('title')}: CLYRO.md claims this passes, but Clyro verified it "
                f"against the branch and it fails. {finding.get('detail') or ''}".strip()
            )
    return notes


def _staleness_drift(token, project, meta) -> list[str]:
    contract_sha = (meta or {}).get("commit_sha")
    if not contract_sha:
        return [
            "CLYRO.md has no commit_sha, so Clyro can't tell whether it still matches this "
            "branch. Regenerate it with the current /clyro-scan skill."
        ]

    from app import github_utils

    head = github_utils.get_branch_head_sha(token, project.repo_full_name, project.repo_branch)
    if not head or head == contract_sha:
        return []

    changed = github_utils.compare_changed_paths(
        token, project.repo_full_name, contract_sha, head,
    )
    if changed is None:
        return [
            f"CLYRO.md was generated at {contract_sha[:7]}, which is no longer reachable from "
            f"{project.repo_branch} (a force-push or squash?). Regenerate it to be sure."
        ]

    relevant = sorted({p for p in changed if clyro_md.is_detection_relevant(p)})
    if not relevant:
        return []

    shown = ", ".join(relevant[:5]) + (f" (+{len(relevant) - 5} more)" if len(relevant) > 5 else "")
    return [
        f"CLYRO.md was generated at {contract_sha[:7]}; since then {shown} changed, which can "
        "change what Clyro detects. Re-run /clyro-scan and push."
    ]


def _save_env_var_keys(project: Project, scan: ScanResult, env_vars: list) -> None:
    for var in env_vars:
        key_name = var.get("key")
        if not key_name:
            continue
        classification = var.get("classification", EnvVarKey.Classification.USER_SECRET)
        EnvVarKey.objects.update_or_create(
            project=project,
            key_name=key_name,
            defaults={
                "scan_result": scan,
                "classification": classification,
                "source_file": var.get("source"),
                "context_block": var.get("context"),
                "production_default": var.get("production_default"),
                "hint": var.get("hint"),
                "acquire_url": var.get("acquire_url"),
                "is_active": True,
            },
        )
