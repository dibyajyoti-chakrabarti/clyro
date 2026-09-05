output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "domain" {
  description = "Cognito hosted UI domain, no scheme. The custom domain, not the amazoncognito.com one."
  value       = aws_cognito_user_pool_domain.main.domain
}

output "google_enabled" {
  value = local.google_enabled
}
