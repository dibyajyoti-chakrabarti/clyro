output "state_bucket" {
  description = "S3 bucket name for Terraform remote state"
  value       = aws_s3_bucket.state.bucket
}

output "lock_table" {
  description = "DynamoDB table name for Terraform state locking"
  value       = aws_dynamodb_table.locks.name
}
