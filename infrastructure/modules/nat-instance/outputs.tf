output "instance_id" {
  value = aws_instance.nat.id
}

# Route tables for the private subnets target THIS ENI for 0.0.0.0/0.
output "primary_eni_id" {
  value = aws_instance.nat.primary_network_interface_id
}

output "security_group_id" {
  value = aws_security_group.nat.id
}

output "public_ip" {
  description = "Auto-assigned public IP (changes on stop/start)"
  value       = aws_instance.nat.public_ip
}
