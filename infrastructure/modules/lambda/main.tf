locals {
  prefix = "${var.project}-${var.environment}"

  mcp_functions = {
    "mcp-pricing" = {
      description  = "AWS Pricing API MCP tool"
      ecr_key      = "mcp-pricing"
      extra_policy = true
    }
    "mcp-cfn" = {
      description  = "CloudFormation validation MCP tool"
      ecr_key      = "mcp-cfn"
      extra_policy = false
    }
    "mcp-docs" = {
      description  = "AWS documentation search MCP tool"
      ecr_key      = "mcp-docs"
      extra_policy = false
    }
  }
}

# ── IAM roles ────────────────────────────────────────────────────────────────

resource "aws_iam_role" "mcp" {
  for_each = local.mcp_functions

  name = "${var.project}-${each.key}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "mcp_basic" {
  for_each = local.mcp_functions

  role       = aws_iam_role.mcp[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "mcp_pricing_extra" {
  name = "pricing-api-access"
  role = aws_iam_role.mcp["mcp-pricing"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["pricing:GetProducts", "pricing:DescribeServices"]
      Resource = "*"
    }]
  })
}

# ── CloudWatch log groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "mcp" {
  for_each = local.mcp_functions

  name              = "/aws/lambda/${var.project}-${each.key}-${var.environment}"
  retention_in_days = 30
}

# ── Lambda functions (image-based) ───────────────────────────────────────────

resource "aws_lambda_function" "mcp" {
  for_each = local.mcp_functions

  function_name = "${var.project}-${each.key}-${var.environment}"
  role          = aws_iam_role.mcp[each.key].arn
  package_type  = "Image"
  image_uri     = "${var.ecr_repo_urls[each.value.ecr_key]}:latest"
  architectures = ["x86_64"]
  timeout       = 60
  memory_size   = 1024

  environment {
    variables = {
      FASTMCP_LOG_LEVEL = "WARNING"
    }
  }

  lifecycle {
    # Image URI is managed by CI/CD after initial deploy
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_iam_role_policy_attachment.mcp_basic,
    aws_cloudwatch_log_group.mcp,
  ]
}

# ── Permissions (allow AgentCore to invoke MCP Lambdas) ──────────────────────

resource "aws_lambda_permission" "agentcore" {
  for_each = local.mcp_functions

  statement_id  = "AllowAgentCoreInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mcp[each.key].function_name
  principal     = "bedrock-agentcore.amazonaws.com"
  source_arn    = "arn:aws:bedrock-agentcore:${var.aws_region}:${var.account_id}:*"
}
