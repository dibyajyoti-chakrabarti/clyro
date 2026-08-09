locals {
  prefix = "${var.project}-${var.environment}"
}

# The three `aws_secretsmanager_secret_version` data sources that used to sit
# here are gone on purpose. They resolved the Django SECRET_KEY, the GitHub App
# private key and the RDS password at plan time and wrote them, in plaintext,
# into this function's environment — readable by anyone with
# lambda:GetFunctionConfiguration, and copied verbatim into the Terraform state
# file. The function now receives only pointers and resolves the values itself
# at cold start; see backend/config/aws_secrets.py.

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
      CORS_ALLOWED_ORIGINS = "https://${var.domain},https://www.${var.domain},https://admin.${var.domain}"
      COGNITO_REGION       = var.aws_region
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      CLYRO_AWS_ACCOUNT_ID = var.account_id

      # Publish side of the Celery/SQS broker — infrastructure/workloads/
      # celery_worker.tf creates the queue + the ECS worker/beat that consume
      # it. Must match that file's queue_name_prefix exactly, or this Lambda
      # publishes to a different SQS queue name than the one it's IAM-scoped
      # to reach (queue_name_prefix + Celery's default queue name "celery").
      CELERY_BROKER_URL       = "sqs://"
      CELERY_RESULT_BACKEND   = "cache+memory://"
      CELERY_SQS_QUEUE_PREFIX = "${local.prefix}-"

      # Secret *pointers*, not secrets. aws_secrets.load_into_environ() reads
      # the SecureStrings under this prefix and assembles DATABASE_URL from the
      # non-secret parts below plus the password behind this ARN.
      CLYRO_SSM_PREFIX             = var.ssm_prefix
      CLYRO_DB_PASSWORD_SECRET_ARN = var.db_password_secret_arn

      # Non-secret halves of the DSN. Django settings wants one DATABASE_URL
      # (django-environ), which the loader builds once the password resolves.
      DB_HOST = var.db_host
      DB_PORT = var.db_port
      DB_NAME = var.db_name
      DB_USER = var.db_username

      GITHUB_APP_ID   = var.github_app_id
      GITHUB_APP_NAME = var.github_app_name
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
