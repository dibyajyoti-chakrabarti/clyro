# ── Phase 1: DNS, certificates, and secret storage ───────────────────────────
#
# Everything that has to exist and be verified before any compute is worth
# building: the hosted zone, the delegation from the registrar, one wildcard
# certificate, and the parameters the application reads at start up.
#
# The EC2 box, Cognito, the frontends and the CI deploy role land in the next
# phase, against the single-instance design.

# The zone must exist before anything can validate against it, and its
# nameservers are what get pasted into the registrar.
module "route53" {
  source = "../modules/route53"
  domain = var.domain
}

# One certificate covers every hostname this project serves through CloudFront
# or Cognito: the apex, www., admin., and auth. The old design also issued a
# second certificate in ap-south-1 for the API Gateway custom domain. There is
# no API Gateway any more, and nginx on the instance gets its own certificate
# from Let's Encrypt, so that second certificate is gone.
#
# us-east-1 is not a preference. CloudFront and Cognito custom domains read
# certificates only from that region.
module "acm_wildcard" {
  source = "../modules/acm"
  count  = var.dns_delegated ? 1 : 0

  providers = {
    aws = aws.useast1
  }

  domain          = var.domain
  sans            = ["*.${var.domain}"]
  route53_zone_id = module.route53.zone_id
}

# ── Phase 2: the box ─────────────────────────────────────────────────────────

module "networking" {
  source = "../modules/networking"

  project             = var.project
  environment         = var.environment
  vpc_cidr            = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
  availability_zones  = var.availability_zones
}

module "ecr" {
  source = "../modules/ecr"

  project     = var.project
  environment = var.environment
  # One repository, not four. The three MCP Lambdas are gone with the rest of
  # the serverless estate; they run in-process on the box now.
  repos = ["backend"]
}

module "app" {
  source = "../modules/ec2_app"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region
  account_id  = var.account_id

  vpc_id    = module.networking.vpc_id
  subnet_id = module.networking.public_subnet_ids[0]

  instance_type = var.instance_type
  backend_image = "${module.ecr.repo_urls["backend"]}:latest"

  ecr_repository_arns = [module.ecr.repo_arns["backend"]]

  cognito_user_pool_arn = module.cognito.user_pool_arn

  api_domain        = "api.${var.domain}"
  letsencrypt_email = var.letsencrypt_email
}

# api.clyro.cloud resolves straight to the instance. No CloudFront in front of
# it and no load balancer: an ALB would cost more per month than the instance
# it balances, and there is exactly one target.
resource "aws_route53_record" "api" {
  zone_id = module.route53.zone_id
  name    = "api.${var.domain}"
  type    = "A"
  ttl     = 300
  records = [module.app.public_ip]
}

# ── Frontends ────────────────────────────────────────────────────────────────
#
# Two instances of the same module: the main site on the apex plus www, and the
# admin panel on its own subdomain. Separate origins on purpose, so an admin
# token never shares an origin, or a JS bundle, with the user-facing app.
#
# Both are S3 behind CloudFront, which is the specific thing the previous AWS
# account could not do and the reason Clyro moved here.

module "frontend" {
  source = "../modules/frontend"

  project             = var.project
  environment         = var.environment
  domain              = var.domain
  account_id          = var.account_id
  acm_certificate_arn = one(module.acm_wildcard[*].certificate_arn)
  route53_zone_id     = module.route53.zone_id
  enable_aliases      = var.enable_cloudfront_aliases
}

module "frontend_admin" {
  source = "../modules/frontend"

  project             = var.project
  environment         = var.environment
  domain              = "admin.${var.domain}"
  account_id          = var.account_id
  app_name            = "frontend-admin"
  include_www         = false
  enable_aliases      = var.enable_cloudfront_aliases
  acm_certificate_arn = one(module.acm_wildcard[*].certificate_arn)
  route53_zone_id     = module.route53.zone_id
}

# ── Cognito ──────────────────────────────────────────────────────────────────
module "cognito" {
  source = "../modules/cognito"

  project     = var.project
  environment = var.environment
  domain      = var.domain
  aws_region  = var.aws_region

  acm_certificate_arn = one(module.acm_wildcard[*].certificate_arn)
  route53_zone_id     = module.route53.zone_id

  # Credentials come from SSM so they never enter a tfvars file, but whether
  # the provider exists at all is an explicit variable rather than something
  # inferred from the parameter's value.
  #
  # Inferring it read the parameter and used the result in a count. That works
  # only while the parameter already exists and nothing about it is changing:
  # Terraform defers a data source read whenever it depends on a resource being
  # modified, and a deferred read makes the count unknown at plan time. Merely
  # adding an unrelated secret to the same for_each map was enough to break the
  # plan, and a fresh account would never have planned at all, since the
  # parameter does not exist before the first apply.
  google_enabled       = var.google_enabled
  google_client_id     = var.google_enabled ? one(data.aws_ssm_parameter.google_client_id[*].value) : ""
  google_client_secret = var.google_enabled ? one(data.aws_ssm_parameter.google_client_secret[*].value) : ""

  pre_signup_lambda_zip = "${path.module}/../modules/cognito/pre_signup.zip"

  callback_urls = [
    "https://${var.domain}/auth/callback",
    "https://admin.${var.domain}/auth/callback",
    "http://localhost:5173/auth/callback",
  ]

  logout_urls = [
    "https://${var.domain}/",
    "https://admin.${var.domain}/",
    "http://localhost:5173/",
  ]

  # Not decoration. AWS refuses to create a Cognito custom domain unless the
  # parent domain already resolves, and the apex A record is created by the
  # frontend module. Without this, the first apply fails or succeeds depending
  # on the order Terraform happens to pick.
  depends_on = [module.frontend]
}

# Literal paths, not references to the aws_ssm_parameter resources.
#
# Referencing the resource makes Terraform defer the read whenever anything
# about that resource is changing, and a deferred read leaves provider_details
# unknown, so every plan proposed rewriting a working identity provider with
# values it could not show. The paths are stable and owned by this same file,
# so the indirection bought nothing.
#
# Bootstrap order on a fresh account: apply with google_enabled = false, which
# creates the parameters and reads nothing; populate them with
# scripts/put-secrets.sh; then set google_enabled = true.
data "aws_ssm_parameter" "google_client_id" {
  count = var.google_enabled ? 1 : 0
  name  = "${local.ssm_base}/cognito/google-client-id"
}

data "aws_ssm_parameter" "google_client_secret" {
  count = var.google_enabled ? 1 : 0
  name  = "${local.ssm_base}/cognito/google-client-secret"
}
