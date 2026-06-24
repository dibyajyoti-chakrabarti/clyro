provider "aws" {
  region  = "ap-south-1"
  profile = "clyro"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
      Layer       = "foundation"
    }
  }
}

# CloudFront ACM certificates must live in us-east-1
provider "aws" {
  alias   = "useast1"
  region  = "us-east-1"
  profile = "clyro"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
      Layer       = "foundation"
    }
  }
}
