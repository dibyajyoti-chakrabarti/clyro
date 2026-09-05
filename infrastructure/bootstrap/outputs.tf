output "state_bucket" {
  description = "S3 bucket name for Terraform remote state — must match the bucket in each layer's backend.tf"
  value       = aws_s3_bucket.state.bucket
}
