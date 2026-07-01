output "backend_lambda_log_group" {
  value = aws_cloudwatch_log_group.backend_lambda.name
}

output "api_gateway_log_group_arn" {
  value = aws_cloudwatch_log_group.api_gateway.arn
}
