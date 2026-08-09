locals {
  secret_prefix = "${var.project}-${var.environment}"
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${local.secret_prefix}/rds/password"
  description             = "RDS PostgreSQL master password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "django_secret_key" {
  name                    = "${local.secret_prefix}/django/secret-key"
  description             = "Django SECRET_KEY"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "github_app_pem" {
  name                    = "${local.secret_prefix}/github/app-pem"
  description             = "GitHub App private key PEM"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "cognito_google" {
  name = "${local.secret_prefix}/cognito/google-oauth"
  # Description deliberately left as-is: changing it marks this resource as
  # pending, which defers the data source read below to apply time and makes
  # every plan report the Google IdP as "will be updated" with unknown values.
  description             = "Google OAuth client_id and client_secret for Cognito (reference only)"
  recovery_window_in_days = 7
}

# Source of truth for the Google IdP credentials.
#
# These are minted by hand in the Google Cloud Console, so Terraform reads them
# rather than owning them — the same split already used for rds/password and
# django/secret-key: this file creates the empty container, the value is put in
# out-of-band, and consumers read the version.
#
# Before this existed, foundation/variables.tf defaulted google_client_id and
# google_client_secret to the literal "REPLACE_ME" and *nothing* read this
# secret. Any `terraform apply` that forgot the -var overrides would happily
# rewrite the live identity provider's client_id to "REPLACE_ME" and break
# Google sign-in for every user. Reading the secret makes a bare apply
# idempotent, which is the whole point.
#
# Bootstrap ordering: put a value in this secret BEFORE the first foundation
# apply, or this data source fails with ResourceNotFoundException:
#   aws secretsmanager put-secret-value \
#     --secret-id clyro-prod/cognito/google-oauth \
#     --secret-string '{"client_id":"…","client_secret":"…"}'
data "aws_secretsmanager_secret_version" "cognito_google" {
  secret_id = aws_secretsmanager_secret.cognito_google.id
}

locals {
  google_oauth = jsondecode(data.aws_secretsmanager_secret_version.cognito_google.secret_string)
}
