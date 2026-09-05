# Bootstrap: the S3 bucket that holds every other layer's remote state.
#
# This layer keeps its state on local disk, because it is the thing that
# creates the remote backend. It is applied once and then left alone.
#
# Credentials come from the AWS_PROFILE environment variable, not a hardcoded
# `profile` argument. The previous version pinned profile = "clyro", which does
# not exist on any current machine, so every plan failed before it started.
# Run this layer as:
#
#   export AWS_PROFILE=home
#   terraform -chdir=infrastructure/bootstrap apply

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
  region = local.region
}

data "aws_caller_identity" "current" {}

locals {
  project = "clyro"
  env     = "prod"
  region  = "ap-south-1"

  # Account 469465348250 also hosts an unrelated product (Structra), so every
  # name this project creates carries the clyro- prefix. The account id and
  # region are in the bucket name because S3 names are globally unique.
  bucket = "${local.project}-tfstate-${data.aws_caller_identity.current.account_id}-${local.region}"

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "Terraform"
    Layer       = "bootstrap"
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

# Versioning is on so a corrupted state can be rolled back, but every applied
# change writes a new version and nothing ever removes the old ones. Without
# this rule the bucket grows without limit; 90 days is far longer than any
# realistic "roll back the state file" window.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# The DynamoDB lock table that used to live here is gone. Terraform 1.10+
# supports S3-native state locking via `use_lockfile = true`, which the
# foundation backend already sets, so the table was a second billed resource
# doing a job S3 now does by itself.
