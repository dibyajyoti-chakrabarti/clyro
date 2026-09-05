output "bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.frontend.arn
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "alias_names" {
  description = "Hostnames this distribution should serve, whether or not they are currently attached"
  value       = local.alias_names
}
