project     = "clyro"
environment = "prod"
domain      = "clyro.cloud"
account_id  = "190084967282"
aws_region  = "ap-south-1"

# Flip to true after the registrar's nameservers point at the hosted zone
# created by this layer. See the variable's comment for why the gate exists.
dns_delegated = true

vpc_cidr            = "10.20.0.0/16"
public_subnet_cidrs = ["10.20.1.0/24", "10.20.2.0/24"]
availability_zones  = ["ap-south-1a", "ap-south-1b"]

# Google sign-in is configured and live.
google_enabled = true

# GitHub sign-in, via the OIDC shim the backend serves.
github_enabled = true
