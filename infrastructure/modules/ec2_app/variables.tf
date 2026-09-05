variable "project" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "account_id" { type = string }

variable "vpc_id" { type = string }
variable "subnet_id" { type = string }

variable "instance_type" {
  description = "Graviton. 2 GB is tight for postgres, redis, gunicorn and two celery processes together, which is why cloud-init adds swap; move to t4g.medium if it thrashes."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_size" {
  type    = number
  default = 30
}

variable "data_volume_size" {
  description = "Postgres data volume, separate from the root disk so it survives instance replacement"
  type        = number
  default     = 20
}

variable "backend_image" {
  description = "Fully qualified ECR image reference for the Django container"
  type        = string
}

variable "ecr_repository_arns" {
  type = list(string)
}

variable "cognito_user_pool_arn" {
  type = string
}

variable "api_domain" {
  description = "Hostname nginx terminates TLS for, e.g. api.clyro.cloud"
  type        = string
}

variable "letsencrypt_email" {
  description = "Contact address for the ACME account; Let's Encrypt uses it for expiry warnings"
  type        = string
}

variable "backup_retention_days" {
  type    = number
  default = 30
}

variable "snapshot_retention_count" {
  type    = number
  default = 7
}
