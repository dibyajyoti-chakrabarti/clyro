variable "project" { type = string }
variable "environment" { type = string }
variable "domain" { type = string }
variable "aws_region" { type = string }

# Empty means "Google sign-in is not configured", and creates no identity
# provider at all. See the note in main.tf: a placeholder can no longer
# overwrite a live provider, because a placeholder builds nothing.
variable "google_client_id" {
  description = "Google OAuth client id; empty or PENDING disables the Google IdP"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "acm_certificate_arn" {
  description = "Wildcard certificate in us-east-1, covering auth.<domain>"
  type        = string
}

variable "route53_zone_id" {
  type = string
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
