variable "project" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "alb_sg_id" { type = string }
variable "ecs_sg_id" { type = string }
variable "task_execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "ecr_image_uri" { type = string }

variable "cognito_user_pool_id" { type = string }
variable "cognito_region" { default = "ap-south-1" }

variable "db_host" { type = string }
variable "db_port" { default = "5432" }
variable "db_name" { default = "clyro_db" }
variable "db_username" { default = "clyro" }

variable "db_password_secret_arn" { type = string }
variable "django_secret_key_secret_arn" { type = string }
variable "github_app_pem_secret_arn" { type = string }

variable "desired_count" { default = 1 }
variable "cpu" { default = 512 }
variable "memory" { default = 1024 }
variable "container_port" { default = 8000 }
variable "domain" { type = string }
variable "log_group_name" { type = string }
variable "github_app_id" { default = "3955174" }
variable "github_app_name" { default = "crylo-github" }
