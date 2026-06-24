output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "name_servers" {
  description = "AWS nameservers to configure in GoDaddy"
  value       = aws_route53_zone.main.name_servers
}
