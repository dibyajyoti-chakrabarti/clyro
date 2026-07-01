output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  value = aws_subnet.private_app[*].id
}

output "private_data_subnet_ids" {
  value = aws_subnet.private_data[*].id
}

output "rds_sg_id" {
  value = aws_security_group.rds.id
}

output "lambda_sg_id" {
  value = aws_security_group.lambda.id
}

output "nat_instance_id" {
  description = "EC2 instance ID of the stoppable NAT instance (used by the cron start/stop workflows)"
  value       = module.nat.instance_id
}
