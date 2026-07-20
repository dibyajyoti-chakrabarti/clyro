# Codebase Security Audit

Findings ranked most → least important. Compiled 2026-07-15 during the TODO.md cleanup / Step 1 generalization session; re-verify claims against current code before acting, the way `documentation/ch_13_deterministic_iac_mechanism.md`'s own status table was found to have drifted.

## 1. ~~No `CSRF_TRUSTED_ORIGINS`, `SECURE_*`, or `SESSION_COOKIE_*` settings~~ — fixed

**Fixed as of commit `2cc6ac9`.** `backend/config/settings.py:187-202` now sets `CSRF_TRUSTED_ORIGINS`, `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`/`SECURE_HSTS_INCLUDE_SUBDOMAINS`/`SECURE_HSTS_PRELOAD`, `X_FRAME_OPTIONS`, and `SECURE_PROXY_SSL_HEADER` (env-driven, gated on `IS_PRODUCTION` where appropriate — `SECURE_PROXY_SSL_HEADER` is needed because ALB terminates TLS before the app). Re-verified live 2026-07-17.

## 2. RepoRecon's Django+React-only detection is a hard product boundary, not (currently) a security control

`backend/agents/CryloCanvas/app/RepoRecon/main.py`'s system prompt hard-blocks any backend that isn't Django before Step 1 compliance checks or provisioning ever run. This session deliberately left this untouched (user decision: generalize Step 1's checks for all *Django+React* variations, not other stacks) — noting it here because it means the compliance hardening done this session (see `backend/app/scanner/compliance.py`) only ever protects Django+React projects; anything else is rejected upstream, so there's no compliance gap for other stacks today, but also no coverage if that hard-block is ever loosened without revisiting `compliance.py` in the same pass.

## 3. Secrets handling is sound but worth a periodic spot-check

`AWSAccountConnection.iam_role_arn` (cross-account STS AssumeRole, `ExternalId`-gated) and `EnvVarKey.secrets_manager_arn` (pointer only, not the value) mean Clyro never stores a customer's raw AWS credentials or app secrets in its own database — actual secret values live only in the customer's own Secrets Manager. `github-app.pem`, `.env.local`, and `db.sqlite3` are all correctly `.gitignore`d and unstaged. No finding here beyond: keep verifying this invariant holds as new integrations are added, since it's currently enforced by convention, not by a schema constraint.

## 4. ~~`github_installations` POST reassigns a GitHubInstallation's owner with no ownership check~~ — fixed (found live, 2026-07-16; fixed same cycle in `2cc6ac9`)

**Fixed as of commit `2cc6ac9`.** `backend/app/views.py:290-306`, the `POST` branch of `github_installations` now looks up any existing row for the `installation_id` first and returns `403` if it's already owned by a different user, before `update_or_create` ever runs:

```python
existing = GitHubInstallation.objects.filter(installation_id=installation_id).first()
if existing and existing.user_id != request.user.id:
    return Response({'error': ...}, status=status.HTTP_403_FORBIDDEN)
```

Original finding (kept for context): `GitHubInstallation.objects.update_or_create(installation_id=int(installation_id), defaults={'user': request.user, ...})` was keyed **only** on `installation_id` — whichever authenticated user's session happened to POST this installation_id last became its owner, silently reassigning it away from whoever connected it first. Reproduced live mid-session (a real `GitHubInstallation` row's `user_id` flipped to a different account after a second GitHub App install/re-auth flow completed in the same browser), then worked around live via the app's normal reauth flow, and fixed properly in code the same cycle. Re-verified live 2026-07-17.
