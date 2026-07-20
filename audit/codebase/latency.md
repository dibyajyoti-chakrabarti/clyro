# Codebase Latency Audit

## 1. Warmup only covers Step 4's IacArchitect runtime — RepoRecon and the Canvas agent still pay full cold-start

`IAC_WARMUP_ENABLED` (`config/settings.py:150`, default `True`) is read in exactly two places: `app/canvas/services.py:172` (fires `tasks.run_warmup_task` for the IacArchitect runtime right when canvas finalizes, so Step 4's Generate is hot) and `app/provisioning/views.py:236` (Step 4's own IaC view). Step 1's RepoRecon scan and Step 3's Canvas agent itself have no equivalent warmup trigger anywhere (`grep` for `warmup`/`WARMUP` in `app/scanner/runner.py` finds nothing) — a user's very first scan and very first canvas load each pay the full AgentCore cold-start (~17s per `ch_15_hardening_and_latency_plan.md`'s measurement) with no mitigation. Worth the same treatment as Step 4: fire a warmup as soon as the wizard reaches Step 1 (for RepoRecon) and as soon as Step 2's intent is saved (for the Canvas agent, one step ahead of when it's needed), mirroring the existing pattern instead of inventing a new one.

## 2. Generate's ~1s latency (already fixed) vs. Refine's still-LLM-backed latency (by design)

`ch_13_deterministic_iac_mechanism.md` confirms Step 4's initial template generation is deterministic-first and returns in under a second — the ~85%-of-wizard-wall-clock finding from `ch_17_e2e_hardening_report.md` (2026-07-09) no longer applies to `generate()`. `refine()` (Ask Clyro's NL template edits) is intentionally kept LLM-backed (correctly scoped per `TODO.md`'s own survey — this is genuinely open-ended work) and will always carry a Bedrock round-trip's latency. Not a bug — noted only so a future latency pass doesn't mistake "refine is slow" for a regression when it's an inherent, accepted tradeoff.
