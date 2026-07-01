# ── Networking ────────────────────────────────────────────────────────────────
output "vpc_id" {
  value = module.networking.vpc_id
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "private_app_subnet_ids" {
  value = module.networking.private_app_subnet_ids
}

output "private_data_subnet_ids" {
  value = module.networking.private_data_subnet_ids
}

output "lambda_sg_id" {
  value = module.networking.lambda_sg_id
}

output "rds_sg_id" {
  value = module.networking.rds_sg_id
}

output "nat_instance_id" {
  description = "EC2 instance ID of the stoppable NAT instance — set as GitHub secret EC2_INSTANCE_ID"
  value       = module.networking.nat_instance_id
}

# ── ECR ───────────────────────────────────────────────────────────────────────
output "ecr_backend_url" {
  value = module.ecr.repo_urls["backend"]
}

output "ecr_mcp_pricing_url" {
  value = module.ecr.repo_urls["mcp-pricing"]
}

output "ecr_mcp_cfn_url" {
  value = module.ecr.repo_urls["mcp-cfn"]
}

output "ecr_mcp_docs_url" {
  value = module.ecr.repo_urls["mcp-docs"]
}

# ── Cognito ───────────────────────────────────────────────────────────────────
output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain (no https:// prefix)"
  value       = module.cognito.domain
}

output "cognito_user_pool_arn" {
  value = module.cognito.user_pool_arn
}

# ── Route53 ───────────────────────────────────────────────────────────────────
output "route53_zone_id" {
  value = module.route53.zone_id
}

output "route53_name_servers" {
  description = "Copy these 4 NS records into GoDaddy custom nameservers"
  value       = module.route53.name_servers
}

# ── API Gateway ───────────────────────────────────────────────────────────────
output "api_gateway_id" {
  value = module.api_gateway.api_id
}

output "api_gateway_execution_arn" {
  value = module.api_gateway.execution_arn
}

# ── IAM ───────────────────────────────────────────────────────────────────────
output "backend_lambda_role_arn" {
  value = aws_iam_role.backend_lambda.arn
}

# ── Secrets Manager ───────────────────────────────────────────────────────────
output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "django_secret_key_secret_arn" {
  value = aws_secretsmanager_secret.django_secret_key.arn
}

output "github_app_pem_secret_arn" {
  value = aws_secretsmanager_secret.github_app_pem.arn
}

# ── CloudFront ────────────────────────────────────────────────────────────────
output "cloudfront_domain" {
  value = module.frontend.cloudfront_domain
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}

output "frontend_bucket_name" {
  value = module.frontend.bucket_name
}

# ── Monitoring ────────────────────────────────────────────────────────────────
output "backend_lambda_log_group" {
  value = module.monitoring.backend_lambda_log_group
}
