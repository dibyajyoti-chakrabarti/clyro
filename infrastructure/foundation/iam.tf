locals {
  iam_prefix = "${var.project}-${var.environment}"
}

# ── ECS Task Execution Role ───────────────────────────────────────────────────
# Allows Fargate to pull images from ECR and write logs to CloudWatch

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.iam_prefix}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow task execution role to read secrets for container startup
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.django_secret_key.arn,
          aws_secretsmanager_secret.github_app_pem.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters", "ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${var.account_id}:parameter/${var.project}/${var.environment}/*"
        ]
      }
    ]
  })
}

# ── ECS Task Role ─────────────────────────────────────────────────────────────
# Runtime permissions for the Django container

resource "aws_iam_role" "ecs_task" {
  name = "${local.iam_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_bedrock" {
  name = "bedrock-and-agentcore"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock-agentcore:*"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminLinkProviderForUser",
        ]
        Resource = module.cognito.user_pool_arn
      },
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.django_secret_key.arn,
          aws_secretsmanager_secret.github_app_pem.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters", "ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${var.account_id}:parameter/${var.project}/${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudformation:*",
          "sts:AssumeRole",
        ]
        Resource = "*"
      }
    ]
  })
}
