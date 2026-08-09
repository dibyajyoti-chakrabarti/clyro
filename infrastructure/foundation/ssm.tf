locals {
  ssm_base = "/${var.project}/${var.environment}"
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "${local.ssm_base}/cognito/user_pool_id"
  type  = "String"
  value = module.cognito.user_pool_id
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "${local.ssm_base}/cognito/client_id"
  type  = "String"
  value = module.cognito.client_id
}

resource "aws_ssm_parameter" "cognito_domain" {
  name  = "${local.ssm_base}/cognito/domain"
  type  = "String"
  value = module.cognito.domain
}

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

resource "aws_ssm_parameter" "ecr_backend_url" {
  name  = "${local.ssm_base}/ecr/backend_url"
  type  = "String"
  value = module.ecr.repo_urls["backend"]
}

# ── Runtime secrets (SecureString) ──────────────────────────────────────────
#
# Read at cold start by backend/config/aws_secrets.py. They live here rather
# than in Secrets Manager because only the application consumes them, and
# standard Parameter Store parameters are free where Secrets Manager bills
# $0.40/secret/month. (The RDS master password stays in Secrets Manager: it is
# the `password` argument of the aws_db_instance itself, so relocating it would
# rotate the master password on a live database.)
#
# Terraform owns the parameter, NOT its value — `ignore_changes` means an apply
# will never overwrite what is actually stored. This is why the placeholder
# below is safe, unlike the "REPLACE_ME" default that used to sit on the Cognito
# Google client_id: that one had no ignore_changes, so every apply really did
# write it over the live value.
#
# Populate both, once, with:
#   infrastructure/scripts/migrate-secrets-to-ssm.sh
resource "aws_ssm_parameter" "django_secret_key" {
  name        = "${local.ssm_base}/django/secret-key"
  description = "Django SECRET_KEY — value managed out-of-band, not by Terraform"
  type        = "SecureString"
  value       = "PENDING_MIGRATION"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "github_app_pem" {
  name        = "${local.ssm_base}/github/app-pem"
  description = "GitHub App private key PEM — value managed out-of-band, not by Terraform"
  type        = "SecureString"
  value       = "PENDING_MIGRATION"

  lifecycle {
    ignore_changes = [value]
  }
}
