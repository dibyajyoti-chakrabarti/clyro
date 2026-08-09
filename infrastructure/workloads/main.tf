module "rds" {
  source = "../modules/rds"

  project                = var.project
  environment            = var.environment
  vpc_id                 = local.f.vpc_id
  subnet_ids             = local.f.private_data_subnet_ids
  security_group_id      = local.f.rds_sg_id
  db_password_secret_arn = local.f.db_password_secret_arn
  instance_class         = var.rds_instance_class
  engine_version         = "16.14"
  db_name                = "clyro_db"
  db_username            = "clyro"
  deletion_protection    = var.deletion_protection
  skip_final_snapshot    = var.skip_final_snapshot
}

module "lambda_backend" {
  source = "../modules/lambda_backend"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region
  account_id  = var.account_id
  domain      = var.domain

  role_arn      = local.f.backend_lambda_role_arn
  ecr_image_uri = "${local.f.ecr_backend_url}:${var.backend_image_tag}"

  private_subnet_ids = local.f.private_app_subnet_ids
  lambda_sg_id       = local.f.lambda_sg_id

  cognito_user_pool_id = local.f.cognito_user_pool_id

  db_host                = module.rds.host
  db_port                = tostring(module.rds.port)
  db_name                = module.rds.db_name
  db_username            = module.rds.username
  db_password_secret_arn = local.f.db_password_secret_arn
  ssm_prefix             = local.f.ssm_prefix

  api_gateway_id            = local.f.api_gateway_id
  api_gateway_execution_arn = local.f.api_gateway_execution_arn
}
