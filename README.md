# Clyro

Beginner-friendly full-stack starter project with:
- Frontend: React + Vite + Tailwind CSS
- Backend: Django (Python) + SQLite

## Project Structure

- `frontend/` - React UI
- `backend/` - Django API/server

## Tech Stack

### Frontend
- React 19
- Vite 7
- Tailwind CSS 4
- ESLint

### Backend
- Python 3
- Django 6
- SQLite (local file database)

## Prerequisites

Install these on your machine:
- Node.js (LTS recommended, includes `npm`)
- Python 3.12+ (or a recent Python 3 version)

Check versions:

```bash
node -v
npm -v
python3 --version
```

## 1) Start the Backend (Django)

Open terminal 1:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at:
- `http://127.0.0.1:8000`

Useful endpoints:
- `http://127.0.0.1:8000/hello`
- `http://127.0.0.1:8000/admin/`

To stop backend:
- Press `Ctrl + C`

## 2) Start the Frontend (React + Vite)

Open terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Frontend usually runs at:
- `http://localhost:5173`

To stop frontend:
- Press `Ctrl + C`

## Common Development Workflow

1. Start backend first.
2. Start frontend in a second terminal.
3. Open frontend in browser.
4. Use backend endpoints as needed.

## Helpful Commands

### Frontend

```bash
cd frontend
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
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

- `pip: command not found`:
  - Try `python3 -m pip install -r requirements.txt`

- Port already in use:
  - Backend: change port with `python manage.py runserver 8001`
  - Frontend: Vite will usually suggest another port automatically

- Virtual environment not active:
  - Run `source .venv/bin/activate` inside `backend/`

## Notes

- Database is SQLite (`backend/db.sqlite3`), good for local development.
- This setup is for development, not production deployment.
