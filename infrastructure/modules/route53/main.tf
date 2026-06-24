resource "aws_route53_zone" "main" {
  name = var.domain
  tags = { ManagedBy = "Terraform" }
}
