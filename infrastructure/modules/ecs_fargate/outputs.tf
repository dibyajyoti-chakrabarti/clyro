output "alb_listener_arn" {
  description = "ALB listener ARN — used by API Gateway VPC Link integration"
  value       = aws_lb_listener.http.arn
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "service_name" {
  value = aws_ecs_service.backend.name
}
