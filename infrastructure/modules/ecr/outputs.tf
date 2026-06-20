output "repo_urls" {
  description = "Map of repo suffix → repository URL"
  value       = { for k, v in aws_ecr_repository.repos : k => v.repository_url }
}

output "repo_arns" {
  description = "Map of repo suffix → repository ARN"
  value       = { for k, v in aws_ecr_repository.repos : k => v.arn }
}
