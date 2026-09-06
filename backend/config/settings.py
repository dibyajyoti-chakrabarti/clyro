from pathlib import Path
import environ
import os

env = environ.Env(
    DEBUG=(bool, False),
)

BASE_DIR = Path(__file__).resolve().parent.parent

environment = os.environ.get('ENVIRONMENT', 'local')
env_file = '.env.production' if environment == 'production' else '.env.local'
environ.Env.read_env(BASE_DIR / env_file)

# Resolve deployed secrets (SECRET_KEY, the GitHub App PEM, and the RDS
# password behind DATABASE_URL) from SSM / Secrets Manager. Deliberately here,
# after read_env and before the first env() call: every entrypoint — API
# handler, migration handler, admin bootstrap, celery worker, celery beat,
# manage.py — reaches settings, so wiring it in once here covers all of them
# instead of each having to remember. No-op when CLYRO_SSM_PREFIX is unset,
# which is every local and CI run. See config/aws_secrets.py.
from config.aws_secrets import load_into_environ  # noqa: E402

load_into_environ()

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'app',
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': env.db('DATABASE_URL')
}

# Celery — async job queue for the long-running agent invocations (scan, Step-3
# chat, IaC generate/refine, provisioning) that previously blocked the Django
# request/response cycle for up to 600s. See core.models.AgentJob.
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://redis:6379/1')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://redis:6379/1')
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_TRACK_STARTED = True

# Production runs redis:7-alpine on the app box and CELERY_BROKER_URL points at
# it (see infrastructure/modules/ec2_app/templates/cloud-init.yaml.tftpl). The
# SQS branch below is left in place for the serverless deployment shape this
# used to have, and for anyone running it that way; it is not what prod does.
# `_run()` persists results onto AgentJob rows directly rather than through
# Celery's own result backend, which is why no result backend is configured
# either way.
if CELERY_BROKER_URL.startswith('sqs://'):
    CELERY_BROKER_TRANSPORT_OPTIONS = {
        'queue_name_prefix': env('CELERY_SQS_QUEUE_PREFIX', default=''),
        'region': env('AWS_REGION', default='ap-south-1'),
    }
# Agent calls can legitimately run for several minutes (IacArchitect's worst-case
# lint-fix + security-fix rounds) — don't let Celery's own visibility/ack timeout
# race the work itself.
CELERY_TASK_TIME_LIMIT = 900

# Proactive AWS-state reconciliation (app.provisioning.reconcile) — catches dead
# AWSAccountConnections and stuck 'deleting' Deployments on a schedule instead of
# only reactively, the next time the user hits _assume(). Runs on whatever
# process invokes `celery -A config beat` (a sidecar process on the same Celery
# worker service in prod: the celery_beat service in the box's compose file).
CELERY_BEAT_SCHEDULE = {
    "reconcile-aws-state": {
        "task": "app.tasks.run_reconcile_sweep_task",
        "schedule": 900.0,  # 15 minutes
    },
    # Step 7 history: one HealthSnapshot per live project per minute
    # (app.provisioning.monitoring) — powers uptime % and the 24h status strip.
    "collect-health-snapshots": {
        "task": "app.tasks.run_health_snapshot_task",
        "schedule": 60.0,
    },
    # Step 7 logs: archive each live service's CloudWatch events into the
    # stack's LogArchiveBucket in 5-minute JSONL slots (idempotent keys, so the
    # cadence matching the slot size is safe).
    "archive-service-logs": {
        "task": "app.tasks.run_log_archive_task",
        "schedule": 300.0,
    },
}

# Deliberately per-process LocMem even though prod now has a Redis to point at.
# The cache only holds short-TTL snapshots (the Step 7 health poll) that absorb
# rapid re-polls and multiple tabs, and those do not need cross-process
# coherence. Worth revisiting if anything starts caching something that does.
CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['app.auth.CognitoAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
}

COGNITO_REGION = env('COGNITO_REGION', default='ap-south-1')
COGNITO_USER_POOL_ID = env('COGNITO_USER_POOL_ID', default='')

GITHUB_APP_ID = env.int('GITHUB_APP_ID', default=0)
GITHUB_APP_NAME = env('GITHUB_APP_NAME', default='')
_github_app_private_key_path = Path(
    env('GITHUB_APP_PRIVATE_KEY_PATH', default='github-app.pem')
)
GITHUB_APP_PRIVATE_KEY_PATH = (
    _github_app_private_key_path
    if _github_app_private_key_path.is_absolute()
    else BASE_DIR / _github_app_private_key_path
)

# ── GitHub OIDC shim (app/oidc/) ────────────────────────────────────────────
#
# Lets Cognito federate GitHub sign-in, which it cannot do directly because
# GitHub speaks OAuth2 and not OIDC. The issuer is the public URL prefix these
# views are mounted at; changing it invalidates every token already issued and
# has to be changed in the Cognito provider at the same time.
OIDC_ISSUER = env('OIDC_ISSUER', default='https://api.clyro.cloud/oidc/github')

# Credentials Cognito uses to authenticate to us. Generated for this purpose
# and unrelated to GitHub's.
OIDC_CLIENT_ID = env('OIDC_CLIENT_ID', default='')
OIDC_CLIENT_SECRET = env('OIDC_CLIENT_SECRET', default='')

# RSA private key that signs the ID tokens, resolved from SSM at start up.
OIDC_SIGNING_KEY = env('OIDC_SIGNING_KEY', default='')

# The OAuth App we present to GitHub. Separate from the GitHub App that reads
# repositories, so rotating sign-in cannot disturb repository access, and so
# email arrives via the user:email scope rather than an App permission that
# existing installations would have to re-approve.
GITHUB_OAUTH_CLIENT_ID = env('GITHUB_OAUTH_CLIENT_ID', default='')
GITHUB_OAUTH_CLIENT_SECRET = env('GITHUB_OAUTH_CLIENT_SECRET', default='')

AWS_PROFILE = env('AWS_PROFILE', default='default')
AWS_REGION = env('AWS_REGION', default='us-east-1')
CLYRO_AWS_ACCOUNT_ID = env('CLYRO_AWS_ACCOUNT_ID')

# Where Step 2's CloudFormation quick-create link fetches its template from.
# Published by Terraform (infrastructure/foundation/cfn_bootstrap.tf) rather
# than hardcoded: the previous value pointed at a bucket in an AWS account that
# has since been closed, so every quick-create link opened a console page that
# could not load its template, and Step 2 was unreachable for every user.
CFN_BOOTSTRAP_TEMPLATE_URL = env('CFN_BOOTSTRAP_TEMPLATE_URL', default='')

# ── Step 3 (Canvas) ─────────────────────────────────────────────────────────
# When set, a new canvas prompt is sent to the deployed Reasoning runtime; when
# empty (default), it runs the local canvas_core deterministic stub.
REASONING_RUNTIME_ARN = env('REASONING_RUNTIME_ARN', default='')

# Step 1 has no runtime: the repo scan moved offline into the /clyro-scan skill,
# and the platform ingests the CLYRO.md it commits (documentation/ch_20).

# ── Step 4 (IaC generation) ─────────────────────────────────────────────────
# Deployed IacArchitect runtime used to *refine* the CloudFormation template
# from natural-language edits (and as a rare fallback). The initial template
# is authored deterministically by `cfn_generator`, not this runtime. Required
# to refine a template; the standalone validate endpoint runs cfn-lint
# in-process and needs no ARN.
IAC_RUNTIME_ARN = env('IAC_RUNTIME_ARN', default='')

# Fire a best-effort warm-up ping to the IaC runtime when the canvas is finalized,
# so the container is hot before Step-4 Generate (cold-start is ~14s of overhead).
# ON by default: the agent is deployed with the mode='warmup' short-circuit so
# the ping is a cheap no-op that just keeps the container warm.
IAC_WARMUP_ENABLED = env.bool('IAC_WARMUP_ENABLED', default=True)

# AgentCore Memory id for persisting the canvas chat (so it survives a refresh).
# When empty, chat persistence no-ops and the UI runs without it.
AGENTCORE_MEMORY_ID = env('AGENTCORE_MEMORY_ID', default='')

# ── Production security hardening ───────────────────────────────────────────
# Django's insecure defaults are fine for local HTTP dev but must not ship to
# production behind API Gateway. Gated on ENVIRONMENT so local/.env.local
# behavior is unchanged.
IS_PRODUCTION = environment == 'production'

CSRF_TRUSTED_ORIGINS = env.list(
    'CSRF_TRUSTED_ORIGINS', default=['https://clyro.cloud', 'https://www.clyro.cloud']
)
SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=IS_PRODUCTION)
SESSION_COOKIE_SECURE = IS_PRODUCTION
CSRF_COOKIE_SECURE = IS_PRODUCTION
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=31536000 if IS_PRODUCTION else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = IS_PRODUCTION
SECURE_HSTS_PRELOAD = IS_PRODUCTION
X_FRAME_OPTIONS = 'DENY'

# API Gateway (apigatewayv2, AWS_PROXY integration) terminates TLS and forwards
# the original scheme via X-Forwarded-Proto — without this, Django sees every
# request as plain HTTP (Lambda is invoked over an internal channel, not real
# HTTP) and SECURE_SSL_REDIRECT would redirect-loop every request.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
