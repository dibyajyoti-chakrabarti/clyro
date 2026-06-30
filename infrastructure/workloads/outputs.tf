output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_host" {
  value = module.rds.host
}

output "rds_instance_identifier" {
  description = "RDS instance identifier — set as GitHub secret RDS_INSTANCE_ID"
  value       = module.rds.identifier
}

output "backend_lambda_function_name" {
  value = module.lambda_backend.function_name
}
