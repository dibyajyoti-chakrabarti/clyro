# The single box that runs Clyro: nginx, gunicorn, celery worker, celery beat,
# redis and postgres, all under docker compose, matching the service set the
# team already runs locally.

locals {
  prefix = "${var.project}-${var.environment}"
}

# Amazon Linux 2023 on arm64, resolved rather than pinned so a rebuild picks up
# a patched image. Graviton because it is roughly 20% cheaper than the x86
# equivalent for the same size, and every container here has an arm64 build.
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-arm64"]
  }
}

# ── Security group ───────────────────────────────────────────────────────────
#
# 80 and 443 inbound, nothing else. Port 22 is deliberately absent: shell access
# is through SSM Session Manager, which needs no inbound rule, no key material
# on anyone's laptop, and leaves an auditable trail in CloudTrail.
resource "aws_security_group" "app" {
  name        = "${local.prefix}-app-sg"
  description = "Public HTTP and HTTPS to the application instance"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP, redirected to HTTPS by nginx and used for ACME challenges"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound: ECR pulls, Bedrock, customer account APIs, ACME"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.prefix}-app-sg" }
}

# ── Instance role ────────────────────────────────────────────────────────────
resource "aws_iam_role" "app" {
  name = "${local.prefix}-app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "${local.prefix}-app" }
}

# Session Manager. This is what replaces SSH, and it is also how the deploy
# workflow runs "docker compose pull && up" without opening a port.
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "ECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = var.ecr_repository_arns
  }

  # The application resolves its own secrets at start up rather than having
  # them baked into the environment, where anything that can describe the
  # instance could read them.
  statement {
    sid       = "ReadOwnParameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.aws_region}:${var.account_id}:parameter/${var.project}/${var.environment}/*"]
  }

  # SecureString values are encrypted with the AWS-managed aws/ssm key, so
  # decryption needs kms:Decrypt alongside the reads above. ViaService pins it
  # to decryption performed by SSM, so this cannot be turned on another key.
  statement {
    sid       = "DecryptThroughSSMOnly"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }

  statement {
    sid    = "Bedrock"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock-agentcore:*",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "CognitoUserLinking"
    effect    = "Allow"
    actions   = ["cognito-idp:ListUsers", "cognito-idp:AdminLinkProviderForUser"]
    resources = [var.cognito_user_pool_arn]
  }

  # GetObject as well as PutObject. A role that can write backups but not read
  # them can back up and cannot restore, which is the one operation the backups
  # exist for. The restore drill would have found this; better to not need it to.
  statement {
    sid       = "Backups"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/*"]
  }

  # This is the interesting permission, and the one worth being ready to defend.
  #
  # Clyro provisions infrastructure inside customers' own AWS accounts by
  # assuming a role they create for it, so a compromise of this box reaches
  # further than this account. The mitigations are on the customer side, where
  # they belong: a required external id per connection, a least-privilege role,
  # and a short session duration. Consolidating onto one box genuinely raises
  # the value of that box to an attacker, which is a real cost of the
  # simplification rather than something to wave away.
  statement {
    sid       = "AssumeCustomerProvisioningRoles"
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "runtime"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.prefix}-app"
  role = aws_iam_role.app.name
}
