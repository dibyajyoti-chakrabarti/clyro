provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
      Layer       = "foundation"
    }
  }
}

# ACM certificates used by CloudFront must live in us-east-1, regardless of
# where everything else runs. The Cognito custom domain has the same
# constraint, because it is itself fronted by CloudFront.
provider "aws" {
  alias  = "useast1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
      Layer       = "foundation"
    }
  }
}
