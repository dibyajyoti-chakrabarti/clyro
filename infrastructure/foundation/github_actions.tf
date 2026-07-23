# GitHub Actions OIDC — lets workflows assume an IAM role without static credentials.
# Trust policy is scoped to a single repo; no AWS_ACCESS_KEY_ID stored in GitHub Secrets.

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea6"]
  tags            = { Name = "github-actions-oidc" }
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${local.prefix}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
  tags               = { Name = "${local.prefix}-github-actions" }
}

# ── Frontend deploy: S3 sync + CloudFront invalidation ──────────────────────
data "aws_iam_policy_document" "github_actions_frontend" {
  statement {
    sid    = "S3FrontendDeploy"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::${var.project}-${var.environment}-frontend",
      "arn:aws:s3:::${var.project}-${var.environment}-frontend/*",
      "arn:aws:s3:::${var.project}-${var.environment}-frontend-admin",
      "arn:aws:s3:::${var.project}-${var.environment}-frontend-admin/*",
    ]
  }

  statement {
    sid    = "CloudFrontInvalidate"
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
    ]
    resources = ["arn:aws:cloudfront::${var.account_id}:distribution/*"]
  }
}

resource "aws_iam_role_policy" "github_actions_frontend" {
  name   = "frontend-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_frontend.json
}

# ── Backend deploy: ECR push + Lambda update + migration handler swap ───────
data "aws_iam_policy_document" "github_actions_backend" {
  statement {
    sid       = "ECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [
      "arn:aws:ecr:${var.aws_region}:${var.account_id}:repository/${var.project}-backend",
    ]
  }

  statement {
    sid    = "LambdaDeployBackend"
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:InvokeFunction",
    ]
    resources = [
      "arn:aws:lambda:${var.aws_region}:${var.account_id}:function:${var.project}-${var.environment}-backend",
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_backend" {
  name   = "backend-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_backend.json
}

# ── Workloads control: NAT instance + RDS stop/start (cron + manual) ───────
data "aws_iam_policy_document" "github_actions_workloads" {
  statement {
    sid       = "NATInstanceDescribe"
    effect    = "Allow"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    sid    = "NATInstanceControl"
    effect = "Allow"
    actions = [
      "ec2:StopInstances",
      "ec2:StartInstances",
    ]
    resources = [
      "arn:aws:ec2:${var.aws_region}:${var.account_id}:instance/${module.networking.nat_instance_id}",
    ]
  }

  statement {
    sid    = "RDSControl"
    effect = "Allow"
    actions = [
      "rds:StopDBInstance",
      "rds:StartDBInstance",
      "rds:DescribeDBInstances",
    ]
    resources = [
      "arn:aws:rds:${var.aws_region}:${var.account_id}:db:${var.project}-${var.environment}-rds",
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_workloads" {
  name   = "workloads-control"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_workloads.json
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "IAM role ARN to set as GH_ACTIONS_ROLE_ARN repo secret"
}
