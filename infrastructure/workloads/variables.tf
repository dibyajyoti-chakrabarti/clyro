variable "project" { default = "clyro" }
variable "environment" { default = "prod" }
variable "aws_region" { default = "ap-south-1" }
variable "domain" { default = "clyro.cloud" }
variable "account_id" { default = "321613317660" }

variable "rds_instance_class" { default = "db.t3.micro" }
variable "deletion_protection" { default = true }
variable "skip_final_snapshot" { default = false }

variable "backend_image_tag" {
  description = "Docker image tag for the backend container"
  default     = "latest"
}
