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

# nonsensitive() because this is derived from the client id, which arrives from
# an SSM parameter and is therefore marked sensitive, which would taint every
# output containing it. Whether Google sign-in is switched on is not a secret;
# the credential behind it stays sensitive and is never output.
output "google_enabled" {
  value = nonsensitive(local.google_enabled)
}
