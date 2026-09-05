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

  # Cognito lands in the next slice. Until the pool exists, the user-linking
  # statement is scoped to a pool ARN that resolves to nothing, which grants
  # nothing rather than granting everything.
  cognito_user_pool_arn = "arn:aws:cognito-idp:${var.aws_region}:${var.account_id}:userpool/none"

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
