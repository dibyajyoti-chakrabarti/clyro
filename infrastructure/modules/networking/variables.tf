variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_cidrs" {
  description = "One CIDR per availability zone"
  type        = list(string)
}

variable "availability_zones" {
  type = list(string)
}
