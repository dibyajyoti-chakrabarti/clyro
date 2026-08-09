project     = "clyro"
environment = "prod"
domain      = "clyro.cloud"
account_id  = "321613317660"

# Google OAuth credentials are NOT set here — they are read from the
# clyro-prod/cognito/google-oauth secret at plan time. To rotate them:
#   aws secretsmanager put-secret-value \
#     --secret-id clyro-prod/cognito/google-oauth \
#     --secret-string '{"client_id":"…","client_secret":"…"}'
#   terraform apply

vpc_cidr            = "10.0.0.0/16"
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
private_app_cidrs   = ["10.0.10.0/24", "10.0.11.0/24"]
private_data_cidrs  = ["10.0.20.0/24", "10.0.21.0/24"]
availability_zones  = ["ap-south-1a", "ap-south-1b"]
