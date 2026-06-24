variable "project" { type = string }
variable "environment" { type = string }
variable "domain" { type = string }
variable "aws_region" { type = string }

variable "google_client_id" {
  description = "Google OAuth client ID — update after creating Google OAuth app"
  type        = string
  default     = "REPLACE_ME"
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = "REPLACE_ME"
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
