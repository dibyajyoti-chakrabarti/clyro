# ── Route53 ──────────────────────────────────────────────────────────────────
output "route53_zone_id" {
  value = module.route53.zone_id
}

output "route53_name_servers" {
  description = "Set these four as the custom nameservers on the clyro.cloud registration, then set dns_delegated = true"
  value       = module.route53.name_servers
}

# ── ACM ──────────────────────────────────────────────────────────────────────
output "acm_certificate_arn" {
  description = "Wildcard certificate in us-east-1, for CloudFront and the Cognito custom domain. Null until dns_delegated is true."
  value       = one(module.acm_wildcard[*].certificate_arn)
}

# ── SSM ──────────────────────────────────────────────────────────────────────
# Only the prefix crosses the layer boundary. The values never enter state:
# backend/config/aws_secrets.py resolves them at start up from CLYRO_SSM_PREFIX.
output "ssm_prefix" {
  value = local.ssm_base
}

output "ssm_secret_names" {
  description = "Parameters whose values must be populated out of band"
  value       = sort([for p in aws_ssm_parameter.runtime_secret : p.name])
}
