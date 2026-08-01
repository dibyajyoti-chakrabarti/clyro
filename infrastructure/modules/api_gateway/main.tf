locals {
  prefix = "${var.project}-${var.environment}"
}

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["https://${var.domain}", "https://www.${var.domain}", "https://admin.${var.domain}", "http://localhost:5173"]
    allow_methods  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers  = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"]
    expose_headers = ["Content-Type", "Authorization"]
    max_age        = 300
  }

  tags = { Name = "${local.prefix}-api" }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = var.api_gateway_log_group_arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }
}

# Custom domain for api.clyro.cloud
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.${var.domain}"

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = "api.${var.domain}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
