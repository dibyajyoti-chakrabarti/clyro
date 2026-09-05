output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  description = "Elastic IP; the api A record points here"
  value       = aws_eip.app.public_ip
}

output "security_group_id" {
  value = aws_security_group.app.id
}

output "role_arn" {
  value = aws_iam_role.app.arn
}

output "backups_bucket" {
  value = aws_s3_bucket.backups.bucket
}
