variable "project" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "account_id" { type = string }
variable "domain" { type = string }

variable "role_arn" { type = string }
variable "ecr_image_uri" { type = string }

variable "private_subnet_ids" { type = list(string) }
variable "lambda_sg_id" { type = string }

variable "timeout" {
  type    = number
  default = 30
}

variable "memory_size" {
  type    = number
  default = 1024
}

variable "cognito_user_pool_id" { type = string }

variable "db_host" { type = string }
variable "db_port" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password_secret_arn" { type = string }

# Base path of the SecureString parameters the function resolves at cold start.
# Replaces django_secret_key_secret_arn / github_app_pem_secret_arn: those two
# values moved from Secrets Manager to Parameter Store and are no longer read
# by Terraform at all, so the module needs the prefix rather than the ARNs.
variable "ssm_prefix" { type = string }
variable "github_app_id" {
  type    = string
  default = "3955174"
}
variable "github_app_name" {
  type    = string
  default = "crylo-github"
}

variable "api_gateway_id" { type = string }
variable "api_gateway_execution_arn" { type = string }
