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
