# Celery worker + beat — the async consumer side of the SQS broker the
# backend Lambda publishes to. Before this, every `.delay()` call in the app
# (scan, canvas chat, IaC generate/refine, provisioning, recreate, build,
# warmup, and the AWS-state reconciliation sweep) had no consumer at all in
# production: the Lambda's env had no CELERY_BROKER_URL, so it fell back to
# settings.py's redis:// default, a hostname that doesn't resolve inside the
# Lambda's VPC. SQS was chosen over ElastiCache Redis since it's cheaper and
# this app doesn't need Celery's own result backend (AgentJob rows already
# carry results/state).
#
# One Fargate task runs both processes (worker + beat) rather than two
# services — beat only ever needs a single, non-scaling replica, and running
# it as a second lightweight container in the same task avoids paying for a
# second always-on task just to fire a schedule every 15 minutes.

# The three `aws_secretsmanager_secret_version` data sources that used to sit
# here are gone for the same reason as in modules/lambda_backend: they wrote
# the Django SECRET_KEY, the GitHub App private key and the RDS password in
# plaintext into the ECS task definition (readable via
# ecs:DescribeTaskDefinition) and into the workloads state file. The worker
# resolves them itself at startup now — see backend/config/aws_secrets.py,
# which settings.py calls on the way in, so the exec'd celery process picks
# them up without celery_entrypoint.py having to prepare anything.

# Poison-message sink. Without it a task the worker can't handle — e.g. one
# whose name isn't registered because the worker is running an older image —
# is redelivered every visibility timeout for the full retention period and
# then silently vanishes. Found live: a run_delete_project_task message at
# ApproximateReceiveCount 87, with the user's AgentJob row still showing
# 'pending' and no failure surfaced anywhere.
resource "aws_sqs_queue" "celery_dlq" {
  name                      = "${local.prefix}-celery-dlq"
  message_retention_seconds = 1209600 # 14 days — long enough to notice and inspect
}

resource "aws_sqs_queue" "celery_broker" {
  name                       = "${local.prefix}-celery"
  visibility_timeout_seconds = 1000 # > CELERY_TASK_TIME_LIMIT (900s) + margin
  message_retention_seconds  = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.celery_dlq.arn
    # 3 gives a genuinely stuck task two retries (tasks here are long and
    # idempotent-ish) without letting a poison message loop for a day.
    maxReceiveCount = 3
  })
}

resource "aws_cloudwatch_log_group" "celery_worker" {
  name              = "/ecs/${local.prefix}-celery-worker"
  retention_in_days = 14
}

# ── IAM ───────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "celery_task_execution" {
  name = "${local.prefix}-celery-task-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "celery_task_execution" {
  role       = aws_iam_role.celery_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "celery_task" {
  name = "${local.prefix}-celery-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Mirrors backend_lambda_runtime (foundation/iam.tf) — the worker runs the
# exact same task/view code the API Lambda does, just off a queue instead of
# an HTTP request.
resource "aws_iam_role_policy" "celery_task_runtime" {
  name = "bedrock-agentcore-cfn-and-sqs"
  role = aws_iam_role.celery_task.id

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
        Resource = local.f.cognito_user_pool_arn
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters", "ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${var.account_id}:parameter/${var.project}/${var.environment}/*"
        ]
      },
      {
        # SECRET_KEY and the GitHub App PEM are now SecureString parameters
        # resolved at container start; decrypting them through SSM needs
        # kms:Decrypt against the AWS-managed aws/ssm key. ViaService keeps
        # this usable only through SSM.
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      },
      {
        # The RDS password is still a Secrets Manager secret (the
        # aws_db_instance resource uses it), so the worker fetches that one
        # directly to assemble DATABASE_URL.
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [local.f.db_password_secret_arn]
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
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueUrl",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
          # Found live: the `beat` sidecar is a *producer*, not just a consumer —
          # it publishes each scheduled task onto this same queue. Without
          # SendMessage every fire died with
          #   celery.beat.SchedulingError: ... AccessDenied ... sqs:sendmessage
          # and it had failed 1344 consecutive times (the entire 14-day log
          # retention) before anyone looked, so reconcile / health-snapshot /
          # log-archive had never once run in production.
          "sqs:SendMessage",
        ]
        Resource = aws_sqs_queue.celery_broker.arn
      },
      {
        # Found live: Kombu's SQS transport calls list_queues(QueueNamePrefix=...)
        # to resolve/cache queue URLs on every connection — ListQueues has no
        # resource-level scoping in AWS's IAM model (same class as
        # ecr:GetAuthorizationToken), so it needs Resource: "*" even though
        # every other SQS action above is scoped to the one queue.
        Effect   = "Allow"
        Action   = ["sqs:ListQueues"]
        Resource = "*"
      }
    ]
  })
}

# ── Task definition ───────────────────────────────────────────────────────────

locals {
  celery_container_environment = [
    { name = "ENVIRONMENT", value = "production" },
    { name = "DEBUG", value = "False" },
    { name = "COGNITO_REGION", value = var.aws_region },
    { name = "COGNITO_USER_POOL_ID", value = local.f.cognito_user_pool_id },
    { name = "CLYRO_AWS_ACCOUNT_ID", value = var.account_id },
    # Secret pointers only — the values resolve at container start.
    { name = "CLYRO_SSM_PREFIX", value = local.f.ssm_prefix },
    { name = "CLYRO_DB_PASSWORD_SECRET_ARN", value = local.f.db_password_secret_arn },
    { name = "DB_HOST", value = module.rds.host },
    { name = "DB_PORT", value = tostring(module.rds.port) },
    { name = "DB_NAME", value = module.rds.db_name },
    { name = "DB_USER", value = module.rds.username },
    { name = "GITHUB_APP_ID", value = "3955174" },
    { name = "GITHUB_APP_NAME", value = "crylo-github" },
    { name = "CELERY_BROKER_URL", value = "sqs://" },
    { name = "CELERY_RESULT_BACKEND", value = "cache+memory://" },
    { name = "CELERY_SQS_QUEUE_PREFIX", value = "${local.prefix}-" },
  ]
}

resource "aws_ecs_cluster" "celery" {
  name = "${local.prefix}-celery-cluster"
}

resource "aws_ecs_task_definition" "celery_worker" {
  family                   = "${local.prefix}-celery-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.celery_task_execution.arn
  task_role_arn            = aws_iam_role.celery_task.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${local.f.ecr_backend_url}:${var.backend_image_tag}"
      essential = true
      # This image's own ENTRYPOINT (Dockerfile.lambda) is awslambdaric, which
      # expects a Lambda handler path, not a shell command — override it with
      # a small wrapper (celery_entrypoint.py) that does the same PEM-write
      # lambda_handler.py does, then execs the real command below.
      entryPoint        = ["python", "/var/task/celery_entrypoint.py"]
      command           = ["celery", "-A", "config", "worker", "--loglevel=info"]
      environment       = local.celery_container_environment
      cpu               = 256
      memoryReservation = 512
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.celery_worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    },
    {
      name              = "beat"
      image             = "${local.f.ecr_backend_url}:${var.backend_image_tag}"
      essential         = true
      entryPoint        = ["python", "/var/task/celery_entrypoint.py"]
      command           = ["celery", "-A", "config", "beat", "--loglevel=info"]
      environment       = local.celery_container_environment
      cpu               = 128
      memoryReservation = 256
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.celery_worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "beat"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "celery_worker" {
  name            = "${local.prefix}-celery-worker"
  cluster         = aws_ecs_cluster.celery.id
  task_definition = aws_ecs_task_definition.celery_worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.f.private_app_subnet_ids
    security_groups  = [local.f.lambda_sg_id] # already trusted by the RDS SG; no new ingress needed
    assign_public_ip = false
  }
}
