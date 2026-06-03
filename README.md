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
