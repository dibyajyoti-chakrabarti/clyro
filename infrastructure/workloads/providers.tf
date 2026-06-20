provider "aws" {
  region  = "ap-south-1"
  profile = "clyro"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
      Layer       = "workloads"
    }
  }
}
