"""The seeded ``invoiceapp`` Step 1 / Step 2 example, straight from the design docs.

Single source of truth for the hardcoded inputs: imported by the canvas_core
tests *and* by the backend ``seed_step3`` management command, so the example the
tests verify is exactly the example the app is seeded with.
"""

from __future__ import annotations

from typing import Any

# --- Step 1 output: detected-resources record (docs §1.5) --------------------

SEED_DETECTED_RESOURCES: dict[str, Any] = {
    "scan_timestamp": "2024-01-01T00:00:00Z",
    "repository": {
        "url": "github.com/durvesh/invoiceapp",
        "branch": "main",
        "is_monorepo": True,
    },
    "services": {
        "backend": {
            "detected": True,
            "framework": "django",
            "path": "./backend",
            "project_name": "invoiceapp",
            "wsgi_path": "invoiceapp.wsgi:application",
            "dockerfile_found": False,
            "dockerfile_generated": True,
        },
        "frontend": {"detected": True, "framework": "react", "path": "./frontend"},
        "worker": {"detected": True, "type": "celery", "scheduled": True},
    },
    "infrastructure": {
        "database": {"detected": True, "engine": "postgres", "source": "requirements.txt"},
        "cache": {"detected": True, "engine": "redis", "source": "requirements.txt"},
        "storage": {"detected": True, "type": "s3", "source": "settings.py"},
        "queue": {"detected": True, "type": "sqs", "source": "celery_detected"},
    },
    "existing_iac": {"found": False, "type": None, "path": None, "used_as": None},
}

# --- Step 1 output: environment-variables record (docs §1.5) -----------------

SEED_ENV_VARS: list[dict[str, Any]] = [
    {"key": "DB_PASSWORD", "source": "settings/base.py", "context": "DATABASES", "classification": "generated"},
    {"key": "REDIS_URL", "source": "settings/base.py", "context": "CACHES", "classification": "generated"},
    {"key": "SECRET_KEY", "source": "settings/base.py", "context": "SECRET_KEY", "classification": "user_secret"},
    {"key": "STRIPE_SECRET_KEY", "source": "settings/production.py", "context": "unknown", "classification": "user_secret"},
    {"key": "DEBUG", "source": "settings/base.py", "context": "DEBUG", "classification": "optional", "production_default": "False"},
]

# --- Step 2 output: intent record (docs §Step 2 Output) ----------------------

SEED_INTENT: dict[str, Any] = {
    "description": "A SaaS tool for managing freelance invoices",
    "scale": "small",
    "criticality": "high",
    "environment": "production",
    "compute_choice": "ecs_fargate",
    "database_choice": "rds_postgres",
    "worker_compute_choice": "ecs_fargate",
    "domain": {"has_domain": True, "domain_name": "app.myproduct.com"},
}

# --- Step 2 output: confirmed canvas.yml (docs §Step 2 canvas.yml Update) -----

SEED_CANVAS_YAML: str = """\
version: 1
project: invoiceapp

nodes:
  - id: backend
    label: Django Backend
    type: service
    aws_service: ecs_fargate
    image: ecr
    port: 8000

  - id: frontend
    label: React Frontend
    type: static
    aws_service: s3_cloudfront

  - id: db
    label: PostgreSQL
    type: database
    aws_service: rds_postgres

  - id: cache
    label: Redis
    type: cache
    aws_service: elasticache

  - id: worker
    label: Celery Worker
    type: worker
    aws_service: ecs_fargate
    image: ecr

  - id: queue
    label: Task Queue
    type: queue
    aws_service: sqs

connections:
  - from: frontend
    to: backend
    label: REST API
  - from: backend
    to: db
    label: reads/writes
  - from: backend
    to: cache
    label: caching
  - from: backend
    to: worker
    label: async tasks
  - from: worker
    to: queue
    label: consumes
"""
