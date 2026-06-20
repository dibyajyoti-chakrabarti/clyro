locals {
  prefix = "${var.project}-${var.environment}"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "pre_signup" {
  name               = "${local.prefix}-pre-signup-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "pre_signup_basic" {
  role       = aws_iam_role.pre_signup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "pre_signup_cognito" {
  name = "cognito-link"
  role = aws_iam_role.pre_signup.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminLinkProviderForUser",
      ]
      Resource = aws_cognito_user_pool.main.arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/aws/lambda/${local.prefix}-pre-signup"
  retention_in_days = 30
}

resource "aws_lambda_function" "pre_signup" {
  function_name    = "${local.prefix}-pre-signup"
  role             = aws_iam_role.pre_signup.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  timeout          = 10
  filename         = var.pre_signup_lambda_zip
  source_code_hash = filebase64sha256(var.pre_signup_lambda_zip)

  environment {
    variables = {
      AWS_REGION = var.aws_region
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.pre_signup_basic,
    aws_cloudwatch_log_group.pre_signup,
  ]
}

resource "aws_lambda_permission" "cognito_invoke" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
