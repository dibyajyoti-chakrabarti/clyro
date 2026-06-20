output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_host" {
  value = module.rds.host
}

output "alb_dns_name" {
  value = module.ecs_fargate.alb_dns_name
}

output "ecs_cluster_name" {
  value = module.ecs_fargate.cluster_name
}

output "ecs_service_name" {
  value = module.ecs_fargate.service_name
}
