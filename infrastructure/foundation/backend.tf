terraform {
  backend "s3" {
    bucket         = "clyro-terraform-state-prod"
    key            = "foundation/terraform.tfstate"
    region         = "ap-south-1"
    profile        = "clyro"
    dynamodb_table = "clyro-terraform-locks-prod"
    encrypt        = true
  }
}
