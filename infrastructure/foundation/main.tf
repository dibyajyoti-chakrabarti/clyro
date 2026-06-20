module "networking" {
  source = "../modules/networking"

  project              = var.project
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_app_cidrs    = var.private_app_cidrs
  private_data_cidrs   = var.private_data_cidrs
  availability_zones   = var.availability_zones
}

module "monitoring" {
  source = "../modules/monitoring"

  project     = var.project
  environment = var.environment
  account_id  = var.account_id
  aws_region  = var.aws_region
}

module "ecr" {
  source = "../modules/ecr"

  project     = var.project
  environment = var.environment
  repos       = ["backend", "mcp-pricing", "mcp-cfn", "mcp-docs"]
}

# Route53 — create first; zone_id feeds ACM validation
module "route53" {
  source = "../modules/route53"
  domain = var.domain
}

# ACM cert for CloudFront — must be in us-east-1
module "acm_cloudfront" {
  source = "../modules/acm"
  providers = {
    aws = aws.useast1
  }

  domain          = var.domain
  sans            = ["*.${var.domain}"]
  route53_zone_id = module.route53.zone_id
}

# ACM cert for API Gateway custom domain — ap-south-1
module "acm_apigw" {
  source = "../modules/acm"

  domain          = "api.${var.domain}"
  sans            = []
  route53_zone_id = module.route53.zone_id
}

module "frontend" {
  source = "../modules/frontend"

  project             = var.project
  environment         = var.environment
  domain              = var.domain
  acm_certificate_arn = module.acm_cloudfront.certificate_arn
  route53_zone_id     = module.route53.zone_id
}

module "cognito" {
  source = "../modules/cognito"

  project               = var.project
  environment           = var.environment
  domain                = var.domain
  aws_region            = var.aws_region
  google_client_id      = var.google_client_id
  google_client_secret  = var.google_client_secret
  pre_signup_lambda_zip = local.pre_signup_zip

  callback_urls = [
    "https://${var.domain}/auth/callback",
    "http://localhost:5173/auth/callback",
  ]

  logout_urls = [
    "https://${var.domain}/",
    "http://localhost:5173/",
  ]
}

module "api_gateway" {
  source = "../modules/api_gateway"

  project                   = var.project
  environment               = var.environment
  domain                    = var.domain
  acm_certificate_arn       = module.acm_apigw.certificate_arn
  route53_zone_id           = module.route53.zone_id
  vpc_id                    = module.networking.vpc_id
  private_subnet_ids        = module.networking.private_app_subnet_ids
  api_gateway_log_group_arn = module.monitoring.api_gateway_log_group_arn
}

module "lambda_mcp" {
  source = "../modules/lambda"

  project     = var.project
  environment = var.environment
  account_id  = var.account_id
  aws_region  = var.aws_region
  enabled     = var.deploy_mcp_lambdas

  ecr_repo_urls = {
    "mcp-pricing" = module.ecr.repo_urls["mcp-pricing"]
    "mcp-cfn"     = module.ecr.repo_urls["mcp-cfn"]
    "mcp-docs"    = module.ecr.repo_urls["mcp-docs"]
  }
}
