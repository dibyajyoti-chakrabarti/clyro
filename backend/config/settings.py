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

# ── Step 3 (Canvas) ─────────────────────────────────────────────────────────
# When set, a new canvas prompt is sent to the deployed Reasoning runtime; when
# empty (default), it runs the local canvas_core deterministic stub.
REASONING_RUNTIME_ARN = env('REASONING_RUNTIME_ARN', default='')

# AgentCore Memory id for persisting the canvas chat (so it survives a refresh).
# When empty, chat persistence no-ops and the UI runs without it.
AGENTCORE_MEMORY_ID = env('AGENTCORE_MEMORY_ID', default='')

# DEBUG-only convenience: treat every Step 3 canvas request as the seeded dev
# user so the endpoints can be exercised without a Cognito token. Inert in
# production (requires DEBUG=True). Off by default.
DEV_AUTH_BYPASS = env.bool('DEV_AUTH_BYPASS', default=False)
DEV_USER_EMAIL = env('DEV_USER_EMAIL', default='dev@crylo.local')
