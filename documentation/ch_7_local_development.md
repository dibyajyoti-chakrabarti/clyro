# Chapter 7: Local Development

Local development is Docker Compose, and it deliberately runs the **same service set as
production** minus the two frontends, which production serves as static bundles from S3.
That match is the whole point of the consolidation onto one box: it removes an entire
class of "works locally, breaks in production" failures.

## Starting the stack

```bash
docker compose up -d
```

| Container | Port | Image or build |
| --- | --- | --- |
| `clyro_db` | 5432 | `postgres:16-alpine` |
| `clyro_redis` | 6379 | `redis:7-alpine` |
| `clyro_backend` | 8000 | built from `./backend` |
| `clyro_celery_worker` | | same build, `celery -A config worker` |
| `clyro_celery_beat` | | same build, `celery -A config beat` |
| `clyro_frontend` | 5173 | Vite dev server, main SPA |
| `clyro_frontend_admin` | 5174 | Vite dev server, admin SPA |

The admin app is a separate container on a separate port for the same reason it is a
separate origin in production: an admin token never shares an origin, or a JS bundle,
with the Cognito-backed user frontend.

`backend/.env.local` supplies the Django settings. The database and broker URLs are set
in the compose file itself and point at the sibling containers.

## AWS credentials in the container

The backend container mounts the host's `~/.aws` read-only, because local development
still needs real credentials for Bedrock AgentCore and for the cross-account
assume-role path.

The mount is written as a **compose-relative path** (`../../.aws`), not `${HOME}/.aws`.
Under Docker Desktop's WSL interop, compose interpolation runs on the Windows side where
`$HOME` is empty, so `${HOME}` yields an empty mount, and an absolute `/home/...` is read
inside the Docker VM, which is also empty. A compose-relative path resolves against the
WSL project directory correctly.

## Running E2E tests

With the stack up:

```bash
cd frontend
npm run test:e2e
```

The same specs run against a real deployment in CI through
`.github/workflows/e2e.yml`, which is dispatch-only. See Chapter 4 for what each spec
covers.
