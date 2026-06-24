terraform {
  backend "s3" {
    bucket         = "clyro-terraform-state-prod"
    key            = "workloads/terraform.tfstate"
    region         = "ap-south-1"
    profile        = "clyro"
    use_lockfile   = true
    encrypt        = true
  }
}
