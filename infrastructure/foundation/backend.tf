# Remote state. The bucket is created by infrastructure/bootstrap, which must
# be applied first.
#
# `profile` is deliberately absent: credentials come from AWS_PROFILE. The
# previous value, profile = "clyro", named a profile that does not exist, so
# `terraform init` failed on every machine.
#
#   export AWS_PROFILE=home
#   terraform -chdir=infrastructure/foundation init
terraform {
  backend "s3" {
    bucket       = "clyro-tfstate-190084967282-ap-south-1"
    key          = "foundation/terraform.tfstate"
    region       = "ap-south-1"
    use_lockfile = true
    encrypt      = true
  }
}
