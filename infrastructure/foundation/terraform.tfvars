project     = "clyro"
environment = "prod"
domain      = "clyro.cloud"
account_id  = "321613317660"

# Leave as REPLACE_ME until you create the Google OAuth app in Google Cloud Console
# Then run: terraform apply -var='google_client_id=xxx' -var='google_client_secret=yyy'
google_client_id     = "REPLACE_ME"
google_client_secret = "REPLACE_ME"

vpc_cidr            = "10.0.0.0/16"
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
private_app_cidrs   = ["10.0.10.0/24", "10.0.11.0/24"]
private_data_cidrs  = ["10.0.20.0/24", "10.0.21.0/24"]
availability_zones  = ["ap-south-1a", "ap-south-1b"]
