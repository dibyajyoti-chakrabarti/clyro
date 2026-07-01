variable "project" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "db_password_secret_arn" { type = string }
variable "instance_class" { default = "db.t3.micro" }
variable "engine_version" { default = "16.14" }
variable "db_name" { default = "clyro_db" }
variable "db_username" { default = "clyro" }
variable "allocated_storage" { default = 20 }
variable "deletion_protection" { default = true }
variable "skip_final_snapshot" { default = false }
variable "backup_retention_period" {
  description = "Days to retain automated backups (this account's free tier caps this at 1)"
  default     = 1
}
