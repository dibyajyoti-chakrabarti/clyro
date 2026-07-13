# Chapter 4: Frontend & Canvas

The frontend is a React application built with Vite and TailwindCSS. 

## Project Wizard
The core user journey is the Project Wizard:
1. **Connect**: Select a GitHub repository.
2. **Configure**: Enter environment variables.
3. **Canvas**: Chat with the `CryloCanvas` agent to define the architecture.
4. **Deploy**: Review the generated IaC in a Monaco editor, and provision it live.

## Playwright E2E Tests
E2E testing is handled by Playwright, located in `frontend/e2e/`. We cover:
- Smoke tests (basic app loading)
- Landing page checks (marketing copy and CTAs)
- Auth flow (login, signup, route protection)
- Navigation transitions
