locals {
  prefix = "${var.project}-${var.environment}"
}

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = var.db_password_secret_arn
}

data "aws_secretsmanager_secret_version" "django_secret_key" {
  secret_id = var.django_secret_key_secret_arn
}

data "aws_secretsmanager_secret_version" "github_app_pem" {
  secret_id = var.github_app_pem_secret_arn
}

resource "aws_lambda_function" "backend" {
  function_name = "${local.prefix}-backend"
  role          = var.role_arn
  package_type  = "Image"
  image_uri     = var.ecr_image_uri
  architectures = ["x86_64"]
  timeout       = var.timeout
  memory_size   = var.memory_size

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_sg_id]
  }

  environment {
    variables = {
      # AWS_REGION is a Lambda-reserved env var set automatically — do not
      # declare it here, Lambda rejects the deployment if you do.
      ENVIRONMENT          = "production"
      DEBUG                = "False"
      ALLOWED_HOSTS        = "api.${var.domain}"
      CORS_ALLOWED_ORIGINS = "https://${var.domain},https://www.${var.domain}"
      COGNITO_REGION       = var.aws_region
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      CLYRO_AWS_ACCOUNT_ID = var.account_id

      # Publish side of the Celery/SQS broker — infrastructure/workloads/
      # celery_worker.tf creates the queue + the ECS worker/beat that consume
      # it. Must match that file's queue_name_prefix exactly, or this Lambda
      # publishes to a different SQS queue name than the one it's IAM-scoped
      # to reach (queue_name_prefix + Celery's default queue name "celery").
      CELERY_BROKER_URL      = "sqs://"
      CELERY_RESULT_BACKEND  = "cache+memory://"
      CELERY_SQS_QUEUE_PREFIX = "${local.prefix}-"

      # Django settings reads a single DATABASE_URL (django-environ), not
      # discrete DB_* vars.
      DATABASE_URL = "postgres://${var.db_username}:${urlencode(data.aws_secretsmanager_secret_version.db_password.secret_string)}@${var.db_host}:${var.db_port}/${var.db_name}"

      SECRET_KEY = data.aws_secretsmanager_secret_version.django_secret_key.secret_string

      # settings.GITHUB_APP_PRIVATE_KEY_PATH only reads a PEM *file*, not an
      # env var directly — lambda_handler.py writes this content to /tmp on
      # cold start and points the path env var at it before Django loads.
      GITHUB_APP_PRIVATE_KEY = data.aws_secretsmanager_secret_version.github_app_pem.secret_string
      GITHUB_APP_ID          = var.github_app_id
      GITHUB_APP_NAME        = var.github_app_name
    }
  }

  # Image is managed by CI/CD after the initial apply; migrations also swap
  # this temporarily and revert it, so Terraform shouldn't fight either.
  lifecycle {
    ignore_changes = [image_uri]
  }
}

# ── API Gateway integration (direct Lambda proxy, no VPC Link needed) ───────

resource "aws_apigatewayv2_integration" "backend" {
  api_id                 = var.api_gateway_id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy_all" {
  api_id    = var.api_gateway_id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = var.api_gateway_id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
