# Clyro

AI-powered infrastructure provisioning platform — give it your GitHub repo and it generates, reviews, and deploys your AWS architecture.

- Frontend: React + Vite + Tailwind CSS
- Backend: Django + PostgreSQL + DRF

## Project Structure

- `frontend/` — React UI
- `backend/` — Django REST API

## Tech Stack

### Frontend
- React 19
- Vite 7
- Tailwind CSS 4
- AWS Amplify (Cognito auth)

### Backend
- Python 3
- Django 6
- Django REST Framework
- PostgreSQL

## Prerequisites

Install these on your machine:
- Node.js (LTS recommended)
- Python 3.12+
- Docker (for local PostgreSQL)

## Environment Setup

### Backend (`backend/.env.local`)

```env
DEBUG=True
SECRET_KEY=django-insecure-replace-this-before-production
DATABASE_URL=postgres://clyro:clyro@localhost:5432/clyro_db
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Cognito
COGNITO_REGION=ap-south-1
COGNITO_USER_POOL_ID=<your-user-pool-id>

# GitHub App (see Step 1 setup below)
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_NAME=<your-app-slug>
GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/github-app.pem
```

### Frontend (`frontend/.env.local`)

```env
VITE_COGNITO_USER_POOL_ID=<your-user-pool-id>
VITE_COGNITO_CLIENT_ID=<your-client-id>
VITE_COGNITO_REGION=ap-south-1

VITE_API_BASE_URL=http://localhost:8000
VITE_GITHUB_APP_NAME=<your-app-slug>
```

## 1) Start the Database

```bash
docker compose up -d
```

## 2) Start the Backend (Django)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://127.0.0.1:8000`

Key endpoints:
- `GET  /api/hello`
- `POST /api/projects/`
- `GET  /api/projects/`
- `GET  /api/projects/<id>/`
- `POST /api/projects/<id>/connect-repo/`
- `POST /api/github/installations/`
- `GET  /api/github/repos/?installation_id=<id>`
- `GET  /api/github/branches/?installation_id=<id>&repo=<owner/repo>`
- `GET  /admin/`

## 3) Start the Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Step 1 — Connect Repository (GitHub App Setup)

Step 1 allows users to connect a GitHub repository to a project. This uses a GitHub App for secure, scoped repository access.

### Create the GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
2. Fill in:
   - **App name**: `Clyro` (or any unique name; the slug is what goes in env vars)
   - **Homepage URL**: `http://localhost:5173`
   - **Callback URL**: `http://localhost:5173/app/github/callback`
   - **Setup URL** (Post installation): `http://localhost:5173/app/github/callback`
   - Check **"Redirect on update"**
   - Uncheck **"Active"** under Webhook (not needed yet)
3. Under **Permissions → Repository permissions**:
   - **Contents**: Read-only
   - **Metadata**: Read-only (mandatory)
4. Under **"Where can this GitHub App be installed?"**: select **"Only on this account"** for development
5. Click **Create GitHub App**

### After creating the app

1. Note the **App ID** (shown at top of the app settings page)
2. Note the **App slug** (the URL-safe name, shown in the public link)
3. Generate a **private key**: scroll down → **Generate a private key** → save the `.pem` file to `backend/github-app.pem`
4. Fill in `backend/.env.local`:
   ```
   GITHUB_APP_ID=<App ID>
   GITHUB_APP_NAME=<App slug>
   GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/backend/github-app.pem
   ```
5. Fill in `frontend/.env.local`:
   ```
   VITE_GITHUB_APP_NAME=<App slug>
   ```
6. Restart the backend and frontend dev servers

### User flow (Step 1 in the wizard)

1. Click **New Project** → enter a project name → project created in DB
2. In wizard Step 1, click **Install Clyro GitHub App** → redirected to GitHub
3. On GitHub, select which repositories to grant access to → click **Install**
4. GitHub redirects to `http://localhost:5173/app/github/callback?installation_id=<id>&setup_action=install`
5. Backend stores the `GitHubInstallation` record; page redirects back to the wizard
6. Repository and branch dropdowns populate from GitHub API
7. Select repo + branch → click **Connect repository**
8. Project status updates to `repo_connected` in DB → Step 1 complete

---

## Agentic Workflow

### Step 1 — Repository Analysis

After the user connects a repo, Clyro runs an agentic scan using the **Strands** framework (AWS open-source Python SDK for agents) backed by **Claude 3.5 Sonnet** via AWS Bedrock (APAC cross-region inference profile).

**Stack:**
- Agent framework: [`strands-agents`](https://github.com/strands-agents/sdk-python)
- LLM: `apac.anthropic.claude-3-5-sonnet-20241022-v2:0` via AWS Bedrock
- Tools: three `@tool`-decorated functions the agent can call — `get_file_tree`, `read_file`, `search_in_files` — all backed by GitHub's REST API using the project's installation token

**How it works:**

The agent is given a detailed system prompt encoding every detection rule from the product spec and runs a structured 3-pass scan:

1. **Pass 1 — File tree** (`get_file_tree`): walks the repo root, identifies monorepo vs single-service, flags high-signal files. No file contents are read.
2. **Pass 2 — Targeted reads** (`read_file`): reads specific files in priority order — `requirements.txt`, `manage.py`, settings files (all discovered locations), `package.json`, `docker-compose.yml`, CI workflows.
3. **Pass 3 — Fallback search** (`search_in_files`): fires only when Pass 2 leaves genuine ambiguity (no settings file found, DB engine unclear). Runs targeted string searches across `.py` files; never reads whole files.

Detection is deterministic by rule first; the LLM only uses its own reasoning for genuinely ambiguous cases. The agent returns a single JSON object with three payloads: a `detected_resources` record (services, infrastructure, IaC), an `env_vars` record (each key classified as `generated`, `user_secret`, or `optional`), and a `draft_canvas_yaml`.

Django's `runner.py` receives this, persists `ScanResult` and individual `EnvVarKey` rows to the DB, and advances the project status to `scan_complete`.

**To use locally:** set `AWS_PROFILE` and `AWS_REGION` in `backend/.env.local` and ensure the profile has `AmazonBedrockFullAccess`.

```env
AWS_PROFILE=your-aws-profile
AWS_REGION=ap-south-1
```

### Step 2 — Intent Collection

Step 2 is not agentic — it's a short adaptive questionnaire. The questions the user sees are determined by what Step 1 detected:

- **Q: Database choice** — only shown if PostgreSQL was detected (`psycopg2` in `requirements.txt`)
- **Q: Worker compute** — only shown if Celery was detected
- **Backend compute** — defaults silently to ECS Fargate; not asked (most users should pick this anyway)

Once the user answers, the intent is persisted as an `IntentRecord` and the `draft_canvas_yaml` from Step 1 is updated with the confirmed `aws_service` values (e.g. `rds_postgres` vs `aurora_postgres`). Project status advances to `intent_collected`.

Step 3 (canvas review) and Step 4 (provisioning) will bring agentic AI back — the canvas agent will handle natural-language edits to the architecture, and the provisioning step will generate CloudFormation from the finalised `canvas.yml`.

---

## Common Development Workflow

1. Start Docker (database)
2. Start backend
3. Start frontend
4. Open `http://localhost:5173`

## Helpful Commands

### Frontend

```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
```

### Backend

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
python manage.py migrate
python manage.py createsuperuser
```

## Troubleshooting

- **`pip: command not found`**: Use `python3 -m pip install -r requirements.txt`
- **Port in use**: Backend → `python manage.py runserver 8001`; Vite suggests another port automatically
- **venv not active**: Run `source .venv/bin/activate` inside `backend/`
- **GitHub callback fails**: Ensure the GitHub App's Setup URL matches exactly `http://localhost:5173/app/github/callback` and that `VITE_GITHUB_APP_NAME` matches the app slug (not the display name)
