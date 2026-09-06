# Chapter 4: Frontend & Canvas

Two React applications, built with Vite and TailwindCSS, shipped as static bundles to S3
behind CloudFront.

- **`frontend/`** is the product: marketing pages, auth, the project dashboard, and the
  seven-step wizard.
- **`frontend-admin/`** is the admin panel. It is a separate bundle on its own subdomain
  rather than a route inside the main app, so an admin session never shares an origin or
  a JS bundle with the user-facing application.

## The project wizard

Seven steps, defined in
`frontend/src/pages/app/ProjectWizard/constants/stepConfig.js` and driven through
`wizardStatuses.js`, which maps each `Project.status` to the step it belongs to.

| Step | Title | Chapter |
| --- | --- | --- |
| 1 | Connect your repository | [8](ch_8_wizard_step_1_connect.md) |
| 2 | Connect your AWS account | [11](ch_11_wizard_step_4_deploy.md) |
| 3 | Tell us about your app | [9](ch_9_wizard_step_2_configure.md) |
| 4 | Review your architecture | [10](ch_10_wizard_step_3_canvas.md) |
| 5 | Generate & validate infrastructure | [11](ch_11_wizard_step_4_deploy.md) |
| 6 | Review & provision | [11](ch_11_wizard_step_4_deploy.md) |
| 7 | Your infrastructure is live | [12](ch_12_wizard_step_5_manage.md) |

The chapter numbers and the step numbers do not line up. The chapters were written
against an earlier five-step wizard and keep their filenames so existing links do not
break; each one now states at the top which step it actually describes.

Step 5 embeds a **Monaco editor** over the generated CloudFormation, with a model picker
(MiniMax M2.5, GLM-5, Kimi K2.5, DeepSeek V3.2) for the refinement chat beside it. Step 6
streams the provisioning log. Step 7 is the operational dashboard.

## Playwright E2E tests

In `frontend/e2e/`, run against a real deployment rather than a local stub. The suite is
dispatch-only in CI (`.github/workflows/e2e.yml`) because the application instance is
powered on by hand, and a push-triggered run would fail on every push made while the box
is off.

| Spec | Covers |
| --- | --- |
| `smoke.spec.js` | The app loads |
| `landing.spec.js` | Marketing copy and CTAs |
| `auth.spec.js` | Login, signup, route protection |
| `navigation.spec.js` | Route transitions |
| `wizard.spec.js` | The authenticated wizard |
| `provisioning.spec.js` | The provisioning screens |
| `zz-status.spec.js`, `zz-fullrun.spec.js` | Long-running checks, named to sort last |
