variable "project" {
  default = "clyro"
}

variable "environment" {
  default = "prod"
}

variable "aws_region" {
  default = "ap-south-1"
}

variable "domain" {
  default = "clyro.cloud"
}

variable "account_id" {
  default = "321613317660"
}

# google_client_id / google_client_secret used to live here with a "REPLACE_ME"
# default. They are deliberately gone: the credentials now come from the
# clyro-prod/cognito/google-oauth secret (see secrets.tf). Keeping the variables
# around would just let someone pass -var and silently have it ignored, or
# re-introduce the placeholder that overwrote the live IdP.

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_app_cidrs" {
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "private_data_cidrs" {
  default = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "availability_zones" {
  default = ["ap-south-1a", "ap-south-1b"]
}

variable "deploy_mcp_lambdas" {
  description = "Set to true once MCP Docker images have been pushed to ECR"
  default     = false
}

variable "github_repo" {
  description = "GitHub repo in owner/name format — used to scope the OIDC role trust policy"
  default     = "dibyajyoti-chakrabarti/clyro"
}
