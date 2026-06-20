terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
  # No remote backend — this IS the bootstrap.
}

provider "aws" {
  region  = "ap-south-1"
  profile = "clyro"
}

locals {
  project = "clyro"
  env     = "prod"
  bucket  = "${local.project}-terraform-state-${local.env}"
  table   = "${local.project}-terraform-locks-${local.env}"

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket" "state" {
  bucket        = local.bucket
  force_destroy = false
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "locks" {
  name         = local.table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = local.tags
}
