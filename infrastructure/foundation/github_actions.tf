# The role GitHub Actions assumes to deploy the application.
#
# Separate from the Terraform role in the bootstrap layer, and much smaller.
# That role can rebuild the estate; this one can push one image and restart the
# containers. Splitting them means a compromise of the application deploy path
# cannot rewrite infrastructure, and it is why the deploy role is safe to
# create from Terraform while the Terraform role is not.

# The provider ARN is constructed, not looked up.
#
# An account holds exactly one OIDC provider per issuer URL, and this one
# belongs to a neighbouring product: it is tagged Project=jan-saathi. The
# Terraform role's guardrails deny reading it three times over, by that tag, by
# the foreign-resource rule, and by the rule protecting shared bootstrap
# resources. All three are right. Clyro consumes this provider; it does not own
# it and has no business enumerating IAM providers in a shared account.
#
# Since the ARN is fully determined by the account id and the issuer, a data
# source bought nothing but a permission this role should not hold. A first
# apply from a laptop worked and the CI plan then failed, which is exactly the
# kind of gap running it in CI is supposed to surface.
locals {
  github_oidc_provider_arn = "arn:aws:iam::${var.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "deploy_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # No "repo:owner/name:*". That would let a workflow on any pushed branch
    # deploy to production.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_repo}:environment:prod",
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.prefix}-github-deploy"
  description        = "Assumed by GitHub Actions to push images and restart the app"
  assume_role_policy = data.aws_iam_policy_document.deploy_assume.json
  tags               = { Name = "${local.prefix}-github-deploy" }
}

data "aws_iam_policy_document" "deploy" {
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
    resources = [module.ecr.repo_arns["backend"]]
  }

  # The deploy is "run the bring-up script on the box", not "ssh in". Scoped to
  # the one instance and the one document, so this role cannot run arbitrary
  # commands on anything else in a shared account.
  statement {
    sid       = "RunDeployOnInstance"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ec2:${var.aws_region}:${var.account_id}:instance/${module.app.instance_id}"]
  }

  statement {
    sid       = "RunShellScriptDocument"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"]
  }

  # Reading back the result. Neither action supports resource-level scoping.
  statement {
    sid       = "ReadCommandResult"
    effect    = "Allow"
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommands"]
    resources = ["*"]
  }

  # Stop and start for the out-of-hours schedule. Resolving the instance by id
  # from Terraform rather than from a repository secret: a hardcoded
  # EC2_INSTANCE_ID went stale when the old instance was replaced and silently
  # broke the nightly shutdown for weeks.
  statement {
    sid       = "StopStartInstance"
    effect    = "Allow"
    actions   = ["ec2:StopInstances", "ec2:StartInstances"]
    resources = ["arn:aws:ec2:${var.aws_region}:${var.account_id}:instance/${module.app.instance_id}"]
  }

  statement {
    sid       = "DescribeInstances"
    effect    = "Allow"
    actions   = ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "app-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "github_deploy_role_arn" {
  description = "Set as the GH_DEPLOY_ROLE_ARN repository secret"
  value       = aws_iam_role.deploy.arn
}
