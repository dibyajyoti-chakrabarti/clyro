module "rds" {
  source = "../modules/rds"

  project                = var.project
  environment            = var.environment
  vpc_id                 = local.f.vpc_id
  subnet_ids             = local.f.private_data_subnet_ids
  security_group_id      = local.f.rds_sg_id
  db_password_secret_arn = local.f.db_password_secret_arn
  instance_class         = var.rds_instance_class
  engine_version         = "16.3"
  db_name                = "clyro_db"
  db_username            = "clyro"
  deletion_protection    = var.deletion_protection
  skip_final_snapshot    = var.skip_final_snapshot
}

module "ecs_fargate" {
  source = "../modules/ecs_fargate"

  project                      = var.project
  environment                  = var.environment
  aws_region                   = var.aws_region
  domain                       = var.domain
  vpc_id                       = local.f.vpc_id
  public_subnet_ids            = local.f.public_subnet_ids
  private_subnet_ids           = local.f.private_app_subnet_ids
  alb_sg_id                    = local.f.alb_sg_id
  ecs_sg_id                    = local.f.ecs_sg_id
  task_execution_role_arn      = local.f.ecs_task_execution_role_arn
  task_role_arn                = local.f.ecs_task_role_arn
  ecr_image_uri                = "${local.f.ecr_backend_url}:${var.backend_image_tag}"
  cognito_user_pool_id         = local.f.cognito_user_pool_id
  db_host                      = module.rds.host
  db_port                      = tostring(module.rds.port)
  db_name                      = module.rds.db_name
  db_username                  = module.rds.username
  db_password_secret_arn       = local.f.db_password_secret_arn
  django_secret_key_secret_arn = local.f.django_secret_key_secret_arn
  github_app_pem_secret_arn    = local.f.github_app_pem_secret_arn
  desired_count                = var.desired_count
  log_group_name               = local.f.ecs_backend_log_group
}

# Wire ALB into API Gateway VPC Link (done here because ALB only exists in workloads)
resource "aws_apigatewayv2_integration" "ecs_alb" {
  api_id             = local.f.api_gateway_id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = module.ecs_fargate.alb_listener_arn
  connection_type    = "VPC_LINK"
  connection_id      = local.f.vpc_link_id
}

resource "aws_apigatewayv2_route" "proxy_all" {
  api_id    = local.f.api_gateway_id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.ecs_alb.id}"
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = local.f.api_gateway_id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.ecs_alb.id}"
}
