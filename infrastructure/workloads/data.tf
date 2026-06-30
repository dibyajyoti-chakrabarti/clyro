# Read all always-up outputs from the foundation layer
data "terraform_remote_state" "foundation" {
  backend = "s3"

  config = {
    bucket       = "clyro-terraform-state-prod"
    key          = "foundation/terraform.tfstate"
    region       = "ap-south-1"
    profile      = "clyro"
    use_lockfile = true
  }
}

locals {
  f = data.terraform_remote_state.foundation.outputs
}
