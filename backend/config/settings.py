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

# Production has no ElastiCache/Redis — the broker is SQS instead (see
# infrastructure/workloads/celery_worker.tf), authenticated via the Lambda's/
# ECS task's own IAM role (no static keys). `_run()` persists results onto
# AgentJob rows directly, not through Celery's own result backend, so the SQS
# transport not supporting one is a non-issue.
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
# worker service in prod — see infrastructure/modules/celery_worker/).
CELERY_BEAT_SCHEDULE = {
    "reconcile-aws-state": {
        "task": "app.tasks.run_reconcile_sweep_task",
        "schedule": 900.0,  # 15 minutes
    },
}

# Production has no Redis (see the SQS note above), so the cache is deliberately
# per-process LocMem — only used for short-TTL snapshots (the Step 7 health poll)
# that absorb rapid re-polls/multiple tabs and don't need cross-process coherence.
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

AWS_PROFILE = env('AWS_PROFILE', default='default')
AWS_REGION = env('AWS_REGION', default='us-east-1')
CLYRO_AWS_ACCOUNT_ID = env('CLYRO_AWS_ACCOUNT_ID')

# ── Step 3 (Canvas) ─────────────────────────────────────────────────────────
# When set, a new canvas prompt is sent to the deployed Reasoning runtime; when
# empty (default), it runs the local canvas_core deterministic stub.
REASONING_RUNTIME_ARN = env('REASONING_RUNTIME_ARN', default='')

# ── Step 1 (Repo Recon) ─────────────────────────────────────────────────────
# When set, the repo scan is delegated to the deployed RepoRecon runtime; when
# empty (default), it runs the in-process scanner agent (local fallback).
REPORECON_RUNTIME_ARN = env('REPORECON_RUNTIME_ARN', default='')

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
