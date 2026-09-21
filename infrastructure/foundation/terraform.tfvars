project     = "clyro"
environment = "prod"
domain      = "clyro.cloud"
account_id  = "042743439363"
aws_region  = "ap-south-1"

# Flip to true after the registrar's nameservers point at the hosted zone
# created by this layer. See the variable's comment for why the gate exists.
dns_delegated = true

vpc_cidr            = "10.20.0.0/16"
public_subnet_cidrs = ["10.20.1.0/24", "10.20.2.0/24"]
availability_zones  = ["ap-south-1a", "ap-south-1b"]

# Both off for the first apply into account 042743439363: their data sources
# read SSM parameters that this layer creates and put-secrets.sh fills, so on a
# fresh account there is nothing to read yet. Flip Google on once its client is
# stored, and GitHub once the backend (which serves the OIDC issuer) is up.
google_enabled = false
github_enabled = false
