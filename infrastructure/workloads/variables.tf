variable "project" { default = "clyro" }
variable "environment" { default = "prod" }
variable "aws_region" { default = "ap-south-1" }
variable "domain" { default = "clyro.cloud" }

variable "rds_instance_class" { default = "db.t3.micro" }
variable "deletion_protection" { default = true }
variable "skip_final_snapshot" { default = false }

variable "desired_count" {
  description = "Number of ECS tasks to run (set to 0 to scale down)"
  default     = 1
}

variable "backend_image_tag" {
  description = "Docker image tag for the backend container"
  default     = "latest"
}
