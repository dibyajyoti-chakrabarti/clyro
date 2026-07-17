locals {
  iam_prefix = "${var.project}-${var.environment}"
}

# ── Backend Lambda Execution Role ─────────────────────────────────────────────
# Runtime permissions for the Django container image (VPC-attached, so it can
# reach RDS) plus the same Bedrock/AgentCore/Cognito/secrets access the ECS
# task role used to carry.

resource "aws_iam_role" "backend_lambda" {
  name = "${local.iam_prefix}-backend-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backend_lambda_basic" {
  role       = aws_iam_role.backend_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC ENI management so the Lambda can attach to the private app subnets
resource "aws_iam_role_policy_attachment" "backend_lambda_vpc" {
  role       = aws_iam_role.backend_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "backend_lambda_runtime" {
  name = "bedrock-agentcore-and-secrets"
  role = aws_iam_role.backend_lambda.id

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
      },
      {
        # Publish side of the Celery/SQS broker (infrastructure/workloads/
        # celery_worker.tf creates the queue itself) — the API Lambda enqueues
        # every long-running agent invocation (scan, canvas chat, IaC
        # generate/refine, provisioning) via `.delay()`; the ECS Celery worker
        # (celery_worker.tf's own task role) consumes them. ARN is
        # constructed rather than cross-referenced from workloads' state,
        # since foundation is applied independently and the queue name is
        # fixed (${local.iam_prefix}-celery).
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueUrl",
          "sqs:GetQueueAttributes",
        ]
        Resource = "arn:aws:sqs:${var.aws_region}:${var.account_id}:${local.iam_prefix}-celery"
      },
      {
        # Found live: Kombu's SQS transport calls list_queues(QueueNamePrefix=...)
        # on every connection, including the publish side — ListQueues has no
        # resource-level scoping in AWS's IAM model, so it needs Resource: "*"
        # even though every other SQS action above is scoped to the one queue.
        Effect   = "Allow"
        Action   = ["sqs:ListQueues"]
        Resource = "*"
      }
    ]
  })
}
