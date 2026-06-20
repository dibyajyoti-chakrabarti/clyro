variable "project" { type = string }
variable "environment" { type = string }
variable "account_id" { type = string }
variable "aws_region" { type = string }

variable "ecr_repo_urls" {
  description = "Map of MCP function key → ECR repo URL"
  type        = map(string)
}
