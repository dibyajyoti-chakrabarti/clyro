variable "project" { type = string }
variable "environment" { type = string }
variable "domain" { type = string }
variable "aws_region" { type = string }

# Required, with no default on purpose. A "REPLACE_ME" default here is what let
# a bare `terraform apply` silently rewrite the live Google IdP's client_id and
# break sign-in; an omitted input must fail loudly at plan time instead.
variable "google_client_id" {
  description = "Google OAuth client ID (from the cognito/google-oauth secret)"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth client secret (from the cognito/google-oauth secret)"
  type        = string
  sensitive   = true
}

variable "callback_urls" {
  description = "Allowed OAuth callback URLs for the Cognito app client"
  type        = list(string)
}

variable "logout_urls" {
  description = "Allowed OAuth logout URLs for the Cognito app client"
  type        = list(string)
}

variable "pre_signup_lambda_zip" {
  description = "Path to zipped pre-signup Lambda handler"
  type        = string
}
