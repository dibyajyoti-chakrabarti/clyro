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
