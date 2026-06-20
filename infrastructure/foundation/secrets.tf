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
  name                    = "${local.secret_prefix}/cognito/google-oauth"
  description             = "Google OAuth client_id and client_secret for Cognito (reference only)"
  recovery_window_in_days = 7
}
