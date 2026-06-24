locals {
  ssm_base = "/${var.project}/${var.environment}"
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "${local.ssm_base}/cognito/user_pool_id"
  type  = "String"
  value = module.cognito.user_pool_id
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "${local.ssm_base}/cognito/client_id"
  type  = "String"
  value = module.cognito.client_id
}

resource "aws_ssm_parameter" "cognito_domain" {
  name  = "${local.ssm_base}/cognito/domain"
  type  = "String"
  value = module.cognito.domain
}

resource "aws_ssm_parameter" "aws_region" {
  name  = "${local.ssm_base}/aws/region"
  type  = "String"
  value = var.aws_region
}

resource "aws_ssm_parameter" "api_base_url" {
  name  = "${local.ssm_base}/api/base_url"
  type  = "String"
  value = "https://api.${var.domain}"
}

resource "aws_ssm_parameter" "app_url" {
  name  = "${local.ssm_base}/app/url"
  type  = "String"
  value = "https://${var.domain}"
}

resource "aws_ssm_parameter" "ecr_backend_url" {
  name  = "${local.ssm_base}/ecr/backend_url"
  type  = "String"
  value = module.ecr.repo_urls["backend"]
}
