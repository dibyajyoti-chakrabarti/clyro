# ── Runtime configuration and secrets ────────────────────────────────────────
#
# Everything lives in SSM Parameter Store. Standard parameters are free, where
# Secrets Manager bills $0.40 per secret per month, and the application is the
# only consumer.
#
# The old design split these across both services and kept the database
# password in Secrets Manager for a specific reason: it was the `password`
# argument of an aws_db_instance, so moving it would have rotated the master
# password on a live database. That reason is gone. Postgres now runs as a
# container on the instance, so nothing in AWS owns the password and there is
# no longer anything to keep in Secrets Manager. All four Secrets Manager
# secrets the old foundation created are deleted.
#
# Terraform owns each parameter but NOT its value. `ignore_changes` on value
# means an apply will never overwrite what is actually stored, which is what
# makes the placeholder below safe: the parameter is created empty-ish here and
# filled in out of band, once, with scripts/put-secrets.sh.

locals {
  # Secrets the application reads at start up. Terraform creates the container
  # and never the content.
  #
  # The first two paths are load-bearing: backend/config/aws_secrets.py builds
  # them by appending "/django/secret-key" and "/github/app-pem" to
  # CLYRO_SSM_PREFIX. Renaming either one breaks the backend at import time.
  runtime_secrets = {
    "django/secret-key" = "Django SECRET_KEY"
    "github/app-pem"    = "GitHub App private key, PEM encoded"

    # Consumed by the postgres container and by the Django DATABASE_URL. Under
    # the old design this was an RDS master password in Secrets Manager.
    "db/password" = "Postgres password for the containerised database"

    # Minted by hand in the Google Cloud Console, so Terraform reads these
    # rather than owning them. They were previously a single JSON blob in
    # Secrets Manager that Terraform decoded at plan time; a plan that could
    # not read it failed before it could show a diff.
    "cognito/google-client-id"     = "Google OAuth client id for the Cognito IdP"
    "cognito/google-client-secret" = "Google OAuth client secret for the Cognito IdP"
  }
}

resource "aws_ssm_parameter" "runtime_secret" {
  for_each = local.runtime_secrets

  name        = "${local.ssm_base}/${each.key}"
  description = "${each.value} — value managed out of band, not by Terraform"
  type        = "SecureString"
  value       = "PENDING"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── Non-secret configuration ─────────────────────────────────────────────────
#
# Plain String parameters, owned by Terraform value and all, because they are
# derived from settings in this repo rather than entered by a human. The
# Cognito and ECR parameters that used to sit here come back in the next phase,
# when the resources they point at exist again.

resource "aws_ssm_parameter" "aws_region" {
  name  = "${local.ssm_base}/aws/region"
  type  = "String"
  value = var.aws_region
}

resource "aws_ssm_parameter" "api_base_url" {
  name  = "${local.ssm_base}/api/base_url"
  type  = "String"
  value = "https://api.${var.domain}"
}

resource "aws_ssm_parameter" "app_url" {
  name  = "${local.ssm_base}/app/url"
  type  = "String"
  value = "https://${var.domain}"
}

# ── Application configuration ────────────────────────────────────────────────
#
# Everything under /clyro/prod/env/ is exported verbatim into the container
# environment by /opt/clyro/up.sh, so a parameter name here is a Django setting
# name there. Adding configuration later is a parameter and a redeploy, with no
# change to the instance or its Terraform.
#
# This exists because the first real deploy would have crash-looped without it.
# backend/config/settings.py reads CLYRO_AWS_ACCOUNT_ID with no default, so
# Django raises ImproperlyConfigured at import when it is missing, and
# ALLOWED_HOSTS defaults to ["localhost"], so every request arriving as
# api.clyro.cloud would have been answered with 400 DisallowedHost.

locals {
  # Values Terraform already knows. Owned here, value and all.
  app_env = {
    # Turns on SECURE_SSL_REDIRECT, secure cookies and HSTS in settings.py.
    # Safe behind nginx because SECURE_PROXY_SSL_HEADER is set and nginx sends
    # X-Forwarded-Proto; without that pairing this would redirect-loop.
    ENVIRONMENT = "production"

    ALLOWED_HOSTS        = "api.${var.domain}"
    CORS_ALLOWED_ORIGINS = "https://${var.domain},https://www.${var.domain},https://admin.${var.domain}"
    CSRF_TRUSTED_ORIGINS = "https://${var.domain},https://www.${var.domain},https://admin.${var.domain}"

    CLYRO_AWS_ACCOUNT_ID = var.account_id
    AWS_REGION           = var.aws_region
    COGNITO_REGION       = var.aws_region
  }

  # Values a human supplies out of band. Terraform owns the parameter, never the
  # value, same split as the secrets above.
  #
  # GITHUB_APP_ID is read with env.int, so its placeholder has to parse as an
  # integer. Zero is also the setting's own default, which reads as "the GitHub
  # App integration is not configured yet" rather than as a broken value.
  app_env_pending = {
    GITHUB_APP_ID   = "0"
    GITHUB_APP_NAME = "PENDING"
  }
}

resource "aws_ssm_parameter" "app_env" {
  for_each = local.app_env

  name  = "${local.ssm_base}/env/${each.key}"
  type  = "String"
  value = each.value
}

resource "aws_ssm_parameter" "app_env_pending" {
  for_each = local.app_env_pending

  name        = "${local.ssm_base}/env/${each.key}"
  description = "Supplied out of band, not by Terraform"
  type        = "String"
  value       = each.value

  lifecycle {
    ignore_changes = [value]
  }
}

# Cognito identifiers, written once the pool exists so the frontends and the
# backend can read them rather than having them pasted into a workflow file.
resource "aws_ssm_parameter" "cognito_env" {
  for_each = {
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.client_id
    COGNITO_DOMAIN       = module.cognito.domain
  }

  name  = "${local.ssm_base}/env/${each.key}"
  type  = "String"
  value = each.value
}

# Where each frontend lives, published for the deploy workflow.
#
# The workflow used to find its distribution with cloudfront:ListDistributions,
# filtering by the hostname served. That failed, and correctly: the deploy role
# has no such permission, and the action cannot be scoped to a resource, so
# granting it would let this role enumerate every distribution in an account
# shared with two other products.
#
# Publishing the ids here keeps the workflow free of hardcoded values, which is
# the property that mattered, while needing no new permission at all: the role
# can already read this path. Terraform owns them, so replacing a distribution
# updates them automatically.
resource "aws_ssm_parameter" "frontend_targets" {
  for_each = {
    "frontend/bucket"                = module.frontend.bucket_name
    "frontend/distribution_id"       = module.frontend.cloudfront_distribution_id
    "frontend/host"                  = var.domain
    "frontend-admin/bucket"          = module.frontend_admin.bucket_name
    "frontend-admin/distribution_id" = module.frontend_admin.cloudfront_distribution_id
    "frontend-admin/host"            = "admin.${var.domain}"
  }

  name  = "${local.ssm_base}/${each.key}"
  type  = "String"
  value = each.value
}
