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

variable "google_client_id" {
  description = "Google OAuth client ID — fill after creating OAuth app in Google Cloud Console"
  default     = "REPLACE_ME"
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  default     = "REPLACE_ME"
  sensitive   = true
}

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
