output "function_arns" {
  description = "Map of function key → Lambda ARN"
  value       = { for k, v in aws_lambda_function.mcp : k => v.arn }
}

output "function_names" {
  description = "Map of function key → Lambda function name"
  value       = { for k, v in aws_lambda_function.mcp : k => v.function_name }
}
