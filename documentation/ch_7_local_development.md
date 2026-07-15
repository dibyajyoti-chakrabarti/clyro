# Chapter 7: Local Development

The easiest way to run Clyro locally is via Docker Compose.

## Starting the Stack
```bash
docker-compose up -d
```
This spins up:
- `clyro_frontend` (Vite dev server on `:5173`)
- `clyro_backend` (Django runserver on `:8000`)
- `clyro_celery_worker`
- `clyro_db` (Postgres)
- `clyro_redis`

## Running E2E Tests
With the docker containers running, execute the Playwright tests:
```bash
cd frontend
npm run test:e2e
```
