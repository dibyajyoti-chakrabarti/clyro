output "ecs_backend_log_group" {
  value = aws_cloudwatch_log_group.ecs_backend.name
}

output "api_gateway_log_group_arn" {
  value = aws_cloudwatch_log_group.api_gateway.arn
}
