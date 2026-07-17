# Codebase Efficiency Audit

## 1. RepoRecon (Step 1 repo scan) is the last LLM call with no deterministic floor

A TODO.md survey (2026-07-14, superseded by this session's narrower scope decision but still valid) mapped every remaining LLM/agent call site in the backend: Step 1's RepoRecon (`backend/app/scanner/runner.py:12`), Step 3's canvas chat (`app/canvas/services.py:236`), and Step 4's `iac.refine()` (`app/provisioning/iac.py:2173`). The latter two are correctly scoped as inherently open-ended NL work with hard deterministic guardrails already wrapped around their output (`canvas_ops.apply_operation`'s constraints; `iac.py`'s `enforce_*` chain + `lint_template` + bounded corrective loop). RepoRecon is the outlier: it has no schema/enum validation or corrector layer on its output at all, and — same shape of problem Step 4 already solved once with `cfn_generator.py` — a deterministic, manifest-based detector (`requirements.txt`/`package.json`/`Dockerfile`/`docker-compose.yml` patterns + env-var grep) could handle the vast majority of repos, demoting the LLM to a fallback for genuinely unrecognized layouts. Deliberately not done this session (user scope decision: generalize `compliance.py`'s checks for Django+React variations, leave RepoRecon's detection untouched) — flagged here so it isn't lost.

## 2. CodeBuild CFN splice was recently de-duplicated — verify no regression creeps back

`cfn_generator.generate_template()` and `iac.py`'s `enforce_codebuild_projects()` used to each splice CodeBuild resources into the template independently (one regex anchored on `Resources:`, one on `Outputs:`) — a real, found-live duplication, consolidated in commit `53cd0c2` onto one shared `codebuild_spec.splice_into_template()` used by both call sites (intentionally kept as two call sites, since `enforce_codebuild_projects` also has to run after LLM `refine()` output that the generator itself never touches). Not a current bug — noted so future changes to either call site don't reintroduce a second splice implementation.

## 3. Cost estimation is already fully deterministic

`canvas_core/cost_engine.py` was checked as part of the same LLM-touchpoint survey and found to be 100% fixed price-book arithmetic already, despite a comment mentioning an optional live price-book fetch as a future data source. No finding — listed for completeness so it isn't re-investigated as if it were an open question.
