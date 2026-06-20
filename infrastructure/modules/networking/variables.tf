variable "project" {
  description = "Project name used in resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
}

variable "private_app_cidrs" {
  description = "CIDR blocks for private app-tier subnets (ECS)"
  type        = list(string)
}

variable "private_data_cidrs" {
  description = "CIDR blocks for private data-tier subnets (RDS)"
  type        = list(string)
}

variable "availability_zones" {
  description = "Availability zones to deploy into"
  type        = list(string)
}
