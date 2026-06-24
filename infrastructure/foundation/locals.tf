locals {
  prefix = "${var.project}-${var.environment}"

  # Path to pre-signup Lambda zip (relative to this directory)
  pre_signup_zip = "${path.module}/../modules/cognito/pre_signup.zip"
}
