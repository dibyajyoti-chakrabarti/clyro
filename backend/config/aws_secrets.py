"""Runtime secret loading for the deployed backend (Lambda + ECS celery).

Why this exists
---------------
Terraform used to resolve every secret at *plan* time and bake the plaintext
into the Lambda's and the ECS task's environment variables — the Django
SECRET_KEY, the full GitHub App RSA private key, and the RDS password inside
DATABASE_URL. Anyone with `lambda:GetFunctionConfiguration`,
`ecs:DescribeTaskDefinition`, or read access to the Terraform state bucket
could read all three. Secrets Manager already held them; nothing fetched them.

Now the deployed environment carries only *pointers* (an SSM path prefix, a
secret ARN, and the non-secret DB host/port/name/user), and this module
resolves the actual values once per cold start.

Where each value lives, and why they are not all in one place
------------------------------------------------------------
* SSM Parameter Store SecureString (`$CLYRO_SSM_PREFIX/...`)
    - `django/secret-key`      (required)
    - `github/app-pem`         (required)
    - `oidc/signing-key`       (optional, GitHub sign-in)
    - `oidc/client-secret`     (optional, GitHub sign-in)
    - `github/oauth-client-secret` (optional, GitHub sign-in)
  Only the application reads these, so they live in Parameter Store, which is
  free for standard parameters (Secrets Manager bills $0.40/secret/month).

* Secrets Manager (`$CLYRO_DB_PASSWORD_SECRET_ARN`)
    - the RDS master password
  This one deliberately stays put: it is the `password` argument of the
  `aws_db_instance` resource itself, so moving it would rotate the master
  password on a live database. Not worth $0.40/month.

Local development is unaffected: with `CLYRO_SSM_PREFIX` unset, every function
here is a no-op and settings falls back to `.env.local` exactly as before.

Existing environment variables always win, so this can be deployed *before*
Terraform stops setting them — during the rollout both paths work and there is
no flag day.
"""

import os
import urllib.parse

from django.core.exceptions import ImproperlyConfigured

# Lambda's only writable directory. Django's settings read the GitHub App key
# from a *file path*, never from a string, so the PEM has to land on disk.
_PEM_PATH = "/tmp/github-app.pem"


def _region() -> str:
    # AWS_REGION is set automatically by the Lambda runtime; ECS tasks get
    # AWS_DEFAULT_REGION from the task definition.
    return (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "ap-south-1"
    )


def _fetch_ssm_parameters(prefix: str) -> dict[str, str]:
    """Both SecureStrings in a single GetParameters call.

    Raises rather than degrading: a backend running with a missing SECRET_KEY
    or an unusable GitHub App key is not meaningfully alive, and failing at
    import time gives a clear CloudWatch error instead of confusing 500s later.
    """
    import boto3  # imported lazily so local dev never pays for it

    required = {
        "secret_key": f"{prefix}/django/secret-key",
        "github_pem": f"{prefix}/github/app-pem",
    }

    # Optional because each one turns a feature on rather than keeping the
    # process alive. A backend that cannot sign an OIDC token is a backend
    # without GitHub sign-in; a backend with no SECRET_KEY is not meaningfully
    # running at all. Refusing to boot over an unconfigured optional feature
    # would mean the app could never start before every integration existed.
    optional = {
        "oidc_signing_key": f"{prefix}/oidc/signing-key",
        "oidc_client_secret": f"{prefix}/oidc/client-secret",
        "github_oauth_client_secret": f"{prefix}/github/oauth-client-secret",
    }

    names = {**required, **optional}
    client = boto3.client("ssm", region_name=_region())
    response = client.get_parameters(
        Names=list(names.values()), WithDecryption=True
    )

    invalid = set(response.get("InvalidParameters") or [])
    missing_required = invalid & set(required.values())
    if missing_required:
        raise ImproperlyConfigured(
            "Missing SSM parameters: "
            + ", ".join(sorted(missing_required))
            + " — populate them with infrastructure/scripts/put-secrets.sh"
        )

    by_name = {p["Name"]: p["Value"] for p in response["Parameters"]}
    return {key: by_name.get(path, "") for key, path in names.items()}


def _fetch_db_password(secret_arn: str) -> str:
    import boto3  # imported lazily so local dev never pays for it

    client = boto3.client("secretsmanager", region_name=_region())
    return client.get_secret_value(SecretId=secret_arn)["SecretString"]


def _build_database_url(password: str) -> str:
    """Assemble the libpq URL settings.py expects from its non-secret parts.

    The password is percent-encoded with an empty `safe` set: the generated RDS
    passwords contain `$`, `&` and `%`, every one of which silently corrupts a
    URL-parsed DSN if passed through raw.
    """
    missing = [
        name
        for name in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")
        if not os.environ.get(name)
    ]
    if missing:
        raise ImproperlyConfigured(
            "CLYRO_DB_PASSWORD_SECRET_ARN is set but these are not: "
            + ", ".join(missing)
        )

    return (
        "postgres://"
        f"{urllib.parse.quote(os.environ['DB_USER'], safe='')}:"
        f"{urllib.parse.quote(password, safe='')}@"
        f"{os.environ['DB_HOST']}:{os.environ['DB_PORT']}/"
        f"{os.environ['DB_NAME']}"
    )


def load_into_environ() -> None:
    """Resolve deployed secrets into os.environ. No-op outside AWS.

    Called from settings.py before any setting is read, so every entrypoint —
    the API handler, the migration handler, the admin bootstrap handler, the
    celery worker and beat, and manage.py — is covered by construction rather
    than by remembering to wire each one up.

    Idempotent, and never overwrites a value that is already set.
    """
    prefix = os.environ.get("CLYRO_SSM_PREFIX")
    if prefix:
        parameters = _fetch_ssm_parameters(prefix.rstrip("/"))

        os.environ.setdefault("SECRET_KEY", parameters["secret_key"])

        # settings.GITHUB_APP_PRIVATE_KEY_PATH reads a PEM file from disk, so
        # the fetched key has to be materialised before settings computes it.
        # This replaces the identical snippet that used to be duplicated at the
        # top of lambda_handler.py and celery_entrypoint.py.
        if not os.environ.get("GITHUB_APP_PRIVATE_KEY_PATH"):
            with open(_PEM_PATH, "w") as handle:
                handle.write(parameters["github_pem"])
            os.chmod(_PEM_PATH, 0o600)
            os.environ["GITHUB_APP_PRIVATE_KEY_PATH"] = _PEM_PATH

        # setdefault throughout, so anything already in the environment wins
        # and a local override keeps working.
        for key, name in (
            ("oidc_signing_key", "OIDC_SIGNING_KEY"),
            ("oidc_client_secret", "OIDC_CLIENT_SECRET"),
            ("github_oauth_client_secret", "GITHUB_OAUTH_CLIENT_SECRET"),
        ):
            if parameters.get(key):
                os.environ.setdefault(name, parameters[key])

    db_password_arn = os.environ.get("CLYRO_DB_PASSWORD_SECRET_ARN")
    if db_password_arn and not os.environ.get("DATABASE_URL"):
        os.environ["DATABASE_URL"] = _build_database_url(
            _fetch_db_password(db_password_arn)
        )
