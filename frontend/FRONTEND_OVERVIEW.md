# Clyro Frontend Overview

> Generated as a read-only orientation document. Scope: `frontend/` only — no backend
> files were read to produce this. All paths are relative to `frontend/`.

## 1. Overall Frontend Structure

**Tech stack** (from `package.json`, `vite.config.js`, `tailwind.config.js`):

- **Framework:** React 19 + Vite 7 (`@vitejs/plugin-react`)
- **Routing:** `react-router-dom` v7 (`BrowserRouter`, nested `<Route>` layouts)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin — theme resolved from CSS
  `@theme` blocks in `src/index.css`, not from `tailwind.config.js`, which is mostly
  legacy/duplicate color definitions), plus one CSS Module (`WhyCrylo.module.css`) and one
  plain global CSS file (`WhyCrylo-global.css`) for a single landing section
- **Animation:** GSAP (`gsap`, `@gsap/react`), `lenis` (smooth scroll), `lottie-react`
- **Auth:** AWS Amplify (`aws-amplify/auth`) — Cognito-backed (`src/lib/cognito.js`)
- **State management:** No Redux/Zustand — plain React Context (`AuthContext`,
  `PreferencesContext`) + local component state/hooks. `src/lib/apiCache.js` provides a
  lightweight in-memory API response cache.
- **Editor:** Monaco Editor (`@monaco-editor/react`, `monaco-yaml`) for in-app YAML/CFN
  template editing (`src/monaco/`, `src/pages/app/ProjectWizard/step5/IacEditor.jsx`)
- **Icons:** `lucide-react`
- **E2E tests:** Playwright (`e2e/*.spec.js`, `playwright.config.js`)

**Top-level `src/` folders:**

| Folder | Purpose |
|---|---|
| `src/pages/` | Route-level page components, grouped by area: `marketing/`, `auth/`, `app/`, `infrastructure/` |
| `src/components/` | Shared/reusable components: `common/`, `layout/`, `marketing/`, `projects/`, `ui/`, `wizard/` |
| `src/layouts/` | Route-group shell components (`AppLayout`, `PublicLayout`, `FullscreenLayout`) |
| `src/routes/` | Single router config file (`index.jsx`) |
| `src/context/` | React Context providers + store/hook pairs (`AuthContext`, `PreferencesContext`) |
| `src/hooks/` | Reusable hooks (scroll, breakpoints, animation, project deletion, etc.) |
| `src/lib/` | Small framework-adjacent utilities (theme, Cognito config, API cache, project-status helpers) |
| `src/api/` | Single `index.js` — the entire backend API client |
| `src/utils/` | Misc pure helpers (`cfnBom.js`, `scallopedPath.js`) |
| `src/monaco/` | Monaco worker setup files |
| `src/assets/` | Images/logos/animations, grouped by feature |
| `e2e/` | Playwright end-to-end specs (top-level, sibling to `src/`) |

## 2. Routing Map

Defined entirely in `src/routes/index.jsx`, gated via two wrapper components defined in
the same file: `ProtectedRoute` (requires auth, else redirects to `/login`) and
`PublicOnlyRoute` (redirects authenticated users to `/app/dashboard`). Gating reads
`isAuthenticated`/`isLoading` from `useAuth()` (`src/context/useAuth.js`).

| Path | Page component | Layout | Gating |
|---|---|---|---|
| `/` | `pages/marketing/Landing.jsx` | none (renders own chrome) | Public-only |
| `/pricing` | `pages/marketing/Pricing.jsx` | `PublicLayout` | Public |
| `/login` | `pages/auth/Login.jsx` | `PublicLayout` | Public-only |
| `/signup` | `pages/auth/Signup.jsx` | `PublicLayout` | Public-only |
| `/verify-otp` | `pages/auth/VerifyOtp.jsx` | `PublicLayout` | Public |
| `/auth/callback` | `pages/auth/OAuthCallback.jsx` | `PublicLayout` | Public |
| `/app/dashboard` | `pages/app/Dashboard.jsx` | `AppLayout` | Protected |
| `/app/profile` | `pages/app/Profile.jsx` | `AppLayout` | Protected |
| `/app/projects` | `pages/app/Projects.jsx` | `AppLayout` | Protected |
| `/app/settings` | `pages/app/Settings.jsx` | `AppLayout` | Protected |
| `/app/github/callback` | `pages/app/GithubCallback.jsx` | `AppLayout` | Protected |
| `/app/projects/:id` | `pages/app/ProjectWizard.jsx` | `FullscreenLayout` | Protected |
| `/app/projects/:id/canvas` | `pages/app/ArchitectureCanvas.jsx` | `FullscreenLayout` | Protected |
| `*` (any other) | redirects to `/` | — | — |

Note: `/` (Landing) intentionally sits outside `PublicLayout` — it renders its own
`LandingNavbar`/`LandingFooter` to keep a distinct dark marketing theme, per an inline
comment in `routes/index.jsx`.

## 3. Main User Flows

### Flow A — Marketing → Sign up → Login

```
/  (Landing.jsx)
 └─ LandingNavbar "Sign up" / "Login" links
      ├─→ /signup  (pages/auth/Signup.jsx)      — Amplify signUp() + OAuth (Google/GitHub)
      │     └─→ /verify-otp (pages/auth/VerifyOtp.jsx)   — OTP confirmation step
      │           └─→ /login (on success)
      └─→ /login   (pages/auth/Login.jsx)       — Amplify signIn() + signInWithRedirect()
            └─→ /auth/callback (pages/auth/OAuthCallback.jsx)  — for OAuth (Google/GitHub) redirect
                  └─→ /app/dashboard (on success)
```

### Flow B — Authenticated shell (post-login)

```
AppLayout (layouts/AppLayout.jsx)
 ├─ Sidebar (components/layout/Sidebar.jsx) — nav: Home / Projects / Profile / Settings
 └─ <Outlet/> renders one of:
      /app/dashboard  → pages/app/Dashboard.jsx   (stats, recent projects list)
      /app/projects   → pages/app/Projects.jsx    (full project list/management)
      /app/profile    → pages/app/Profile.jsx
      /app/settings   → pages/app/Settings.jsx
      /app/github/callback → pages/app/GithubCallback.jsx  (GitHub App install callback)
```

### Flow C — Project creation & the 7-step wizard (core product flow)

```
Dashboard/Projects "New project" → /app/projects/new
 └─ ProjectWizard.jsx detects id === 'new' → renders CreateProject.jsx
      (pages/app/CreateProject.jsx — name input, api.createProject())
      └─→ navigate to /app/projects/:id  (real id, replace)

/app/projects/:id → ProjectWizard.jsx (FullscreenLayout, no sidebar — own WizardNavbar)
  Loads state via api.getWizardState(id); step derived from project status
  (constants/wizardStatuses.js → STATUS_STEP), step list from
  constants/stepConfig.js. Steps render conditionally inside ProjectWizard.jsx:

  Step 1  Connect repository        → ProjectWizard/step1/StepOne.jsx
            ├─ GithubConnectCard.jsx, RepositorySelector.jsx
            ├─ ContractSetup.jsx / ContractIngesting.jsx / ScanResults.jsx / ScanBlocked.jsx
            └─ SecretsCollect.jsx
  Step 2  Connect AWS account       → ProjectWizard/step2/StepTwo.jsx
            └─ AwsConnectCard.jsx, AwsSetup.jsx
  Step 3  App questionnaire         → ProjectWizard/step3/StepThree.jsx
            └─ QuestionCard.jsx, ChoiceOption.jsx, IntentSummary.jsx
               (questions sourced from constants/questions.js)
  Step 4  Review architecture       → ProjectWizard/step4/StepFour.jsx
            └─ canvas/ (CanvasSurface.jsx, CanvasNode.jsx, NodePopup.jsx,
               CanvasErrorBoundary.jsx), chat/ (ChatSidebar.jsx, ChatBubble.jsx),
               sidebar/CostPanel.jsx
  Step 5  Generate & validate IaC   → ProjectWizard/step5/StepFive.jsx
            └─ IacEditor.jsx (Monaco-based CloudFormation template editor)
  Step 6  Review & provision        → ProjectWizard/step6/StepSix.jsx
            └─ ReviewArchitecture.jsx, SecretsWrite.jsx, ProvisionLog.jsx,
               ProvisioningBackground.jsx, DeploymentSuccess.jsx
  Step 7  Live infrastructure       → ProjectWizard/step7/StepSeven.jsx
            └─ HealthOverview.jsx, MetricsGrid.jsx, LogsPanel.jsx, AlarmsPanel.jsx,
               AlertsList.jsx, CostCard.jsx, UptimeSection.jsx, StackStatus.jsx,
               MonitorCard.jsx, RingGauge.jsx, Sparkline.jsx (+ useAlarms.js hook)
            └─→ "Go to dashboard" → /app/dashboard
```

Shared wizard-level hooks: `ProjectWizard/hooks/useQuestionFlow.js`,
`useScanFlow.js`, `useCanvasAgent.js`. Shared cross-step UI:
`ProjectWizard/components/StepProgress.jsx`, `ProgressBar.jsx`, `DropDown.jsx`,
`GithubMark.jsx`, and `ProjectWizard/shared/EnvVarsPanel.jsx`.

There is also a second, older-looking `StepProgress.jsx` at
`components/wizard/StepProgress.jsx` (see §6 — Dead/Duplicated).

### Flow D — Architecture canvas (standalone view)

```
/app/projects/:id/canvas → pages/app/ArchitectureCanvas.jsx  (FullscreenLayout)
```
A separate full-screen route from the Step-4 in-wizard canvas — appears to be a
dedicated/standalone canvas viewer outside the step flow.

### Flow E — Backend-down / health gate (wraps the entire app)

```
main.jsx → HealthGate (components/common/HealthGate.jsx)
  polls GET /api/health/ every 15s (skipped entirely in dev mode)
  ├─ not yet checked   → CheckingServerStatus.jsx
  ├─ unhealthy         → pages/infrastructure/ServerDown.jsx
  └─ healthy           → renders AuthProvider → AppRoutes (rest of app)
```

## 4. Key Shared Frontend Infrastructure

- **Global providers** (wired in `src/main.jsx`, outside-in): `PreferencesProvider`
  (`src/context/PreferencesContext.jsx`, backed by `preferencesStore.js` — theme +
  preferred AWS region, persisted to `localStorage`) → `HealthGate` → `AuthProvider`
  (`src/context/AuthContext.jsx`, backed by `authStore.js` — wraps Amplify Cognito
  session/user state) → `AppRoutes`.
- **Theme system:** `src/lib/theme.js` (`initThemeFromStorage`, `applyTheme`, stamps
  `data-theme="light"|"dark"` on `<html>`) paired with CSS custom properties defined in
  `src/index.css` under a Tailwind v4 `@theme` block (`--color-background`,
  `--color-accent`, etc., indirecting through `--c-*` variables per theme). A second,
  separate marketing-only color palette (`--color-marketing-*`) is also defined there for
  the landing/pricing pages specifically.
- **Shared layout shells:** `src/layouts/AppLayout.jsx` (sidebar + rounded panel shell for
  the authenticated app), `src/layouts/PublicLayout.jsx` (navbar/footer for
  pricing/login/signup), `src/layouts/FullscreenLayout.jsx` (chromeless full-bleed shell
  for the wizard and canvas routes).
- **Shared layout components:** `src/components/layout/Navbar.jsx`, `Footer.jsx`,
  `Sidebar.jsx` (used by `PublicLayout`/`AppLayout`); marketing-only chrome
  (`LandingNavbar.jsx`, `LandingFooter.jsx`) lives instead under
  `src/pages/marketing/landing/`.
- **Design-system / UI component library:** `src/components/ui/` — `Button.jsx`,
  `Card.jsx`, `Input.jsx`, `Select.jsx`, `GlassSelect.jsx`, `Badge.jsx`,
  `ConfirmDialog.jsx`, `ProcessingLoader.jsx`, `ScallopedPanel.jsx`, `BrandIcons.jsx`.
- **Domain-specific shared components:** `src/components/projects/` (project cards,
  status badges, infra management panel/modal used by both Dashboard and Projects pages).
- **Health/loading gating:** `src/components/common/HealthGate.jsx`,
  `CheckingServerStatus.jsx`, `GitHubLogo.jsx`.
- **Hooks:** `src/hooks/` — `useSmoothScroll.js` (Lenis, used by Landing),
  `useHowItWorksAnimation.js` (GSAP, landing section), `useCardBreakpoint.js`,
  `useInfraManagement.js`, `useProjectDeletion.jsx`.
- **API caching:** `src/lib/apiCache.js` (in-memory cache layer, separate from
  `src/api/index.js`'s request logic).

## 5. Frontend-to-Backend Touchpoints

All backend calls are centralized in the single file `src/api/index.js`, which builds a
`fetch`-based client against `BASE_URL` (`import.meta.env.VITE_API_BASE_URL`, default
`http://localhost:8000`), attaching a Cognito bearer token from
`aws-amplify/auth`'s `fetchAuthSession()` on every request. Every page/component calls
through the exported `api` object rather than calling `fetch` directly (only
`HealthGate.jsx` calls `fetch` independently, against `/api/health/`).

Endpoint groups exposed by `api` (from `src/api/index.js`), by feature:

- **User:** `GET/PATCH/DELETE /api/users/me/`
- **Projects:** `POST/GET/DELETE /api/projects/`, `/api/projects/:id/connect-repo/`,
  `/api/projects/:id/scan/`, `/api/projects/:id/intent/`,
  `/api/projects/:id/wizard-state/`
- **Async jobs:** `GET /api/projects/:id/jobs/:jobId/` — polled by `pollJob()`, used
  across scan / canvas-agent chat / IaC generate-refine flows
- **Canvas (Step 4):** `/api/projects/:id/canvas/latest/`, `/canvas/agent/`,
  `/canvas/chat/` (+`/flush/`), `/canvas/dismiss/`, `/canvas/versions/` (+`/revert/`),
  `/canvas/finalize/`
- **AWS connection (Step 2):** `/api/projects/:id/aws-connection/` (+`/verify/`)
- **Env vars (Step 1 & 6):** `/api/projects/:id/env-vars/` (+`/stage/`, `/save/`)
- **IaC (Step 5):** `/api/projects/:id/iac/` (+`/generate/`, `/refine/`, `/validate/`)
- **Provisioning (Step 6/7):** `/api/projects/:id/deploy/` (+`/status/`, `/health/`,
  `/history/`, `/alarms/`, `/logs/` [+`/download/`], `/pause/`, `/resume/`,
  `/teardown/`, `/recreate/`, `/retry-build/`)
- **GitHub:** `/api/github/installations/` (POST+GET), `/api/github/repos/`,
  `/api/github/branches/`
- **Health check (outside `api` client):** `GET /api/health/`, called directly from
  `src/components/common/HealthGate.jsx`

No backend files were opened to produce this list — it reflects only the frontend-side
call sites in `src/api/index.js`.

## 6. Notably Dead, Duplicated, or Inconsistent (structural only)

- **Two `StepProgress` components:** `src/components/wizard/StepProgress.jsx` and
  `src/pages/app/ProjectWizard/components/StepProgress.jsx`. Only the one under
  `ProjectWizard/components/` is imported by `ProjectWizard.jsx`; the one in
  `components/wizard/` was not seen imported by any route/page visited during this
  survey and may be unused or superseded.
- **Two "how it works" implementations:** `src/pages/marketing/landing/HowItWorks.jsx`
  and `HowClyroWorks.jsx` both exist under the same folder, but `Landing.jsx` only
  renders `HowClyroWorks`. `HowItWorks.jsx` (plus its companion
  `components/marketing/HowItWorksCard.jsx` and `hooks/useHowItWorksAnimation.js`) may be
  an earlier/alternate version not wired into the current landing page.
  There is a separate `src/pages/marketing/landing/WhyCrylo.jsx`, whose styling is split
  across a CSS Module (`WhyCrylo.module.css`) and a same-folder global stylesheet
  (`WhyCrylo-global.css`) — an inconsistent styling approach compared to the rest of the
  app, which is otherwise all Tailwind utility classes; `WhyCrylo` itself is also not
  imported by `Landing.jsx`.
- **Duplicated color/theme definitions:** `tailwind.config.js` defines a `colors` palette
  (`background`, `surface`, `accent`, etc.) that, per a comment at the top of
  `src/index.css`, is superseded by Tailwind v4's CSS-based `@theme` block — the config
  file's `theme.extend.colors` appears to be legacy/inert.
  Similarly, `CreateProject.jsx` and the wizard step components use raw hex literals
  (e.g. `bg-[#040404]`, `border-[#E8B84B]`) rather than the shared design tokens
  (`bg-background`, `text-accent`), inconsistent with pages like `Dashboard.jsx` which do
  use the token classes.
- **`FullscreenLayout.jsx` branches on `id === 'new'`** to pick between two visually
  distinct wrapper divs with otherwise-identical structure/classes — a special case that
  could suggest `CreateProject.jsx` was bolted on after the fact rather than designed as
  a wizard step.
- **`src/routes/index.jsx` comment** explicitly documents that Landing is deliberately
  kept outside `PublicLayout` to avoid duplicate navbar/footer — an intentional
  inconsistency, not an accidental one, but worth knowing when reasoning about routing.
