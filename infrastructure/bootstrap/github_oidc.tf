# The IAM role GitHub Actions assumes to run Terraform.
#
# Why this lives in bootstrap rather than foundation
# --------------------------------------------------
# Two reasons, and both matter.
#
# 1. Chicken and egg. If the role that lets CI run Terraform were itself
#    created by the Terraform that CI runs, there would be no way to create it
#    the first time. Bootstrap is already the layer that is applied by hand,
#    once, from a laptop, so it is the natural home.
#
# 2. Privilege escalation. A role that can modify itself can grant itself
#    anything, which makes every other restriction below decorative. Keeping
#    the role out of the CI-managed layers, and denying CI the ability to touch
#    it (see the guardrails policy), closes that path.
#
# Apply this layer locally:
#   export AWS_PROFILE=home
#   terraform -chdir=infrastructure/bootstrap apply
#
# then set the role ARN as the GH_TERRAFORM_ROLE_ARN repository secret.

locals {
  github_repo = "dibyajyoti-chakrabarti/clyro"
  account_id  = data.aws_caller_identity.current.account_id

  # This account also runs Structra. Both projects tag every resource with
  # Project, which is what the tag-based guardrail below keys on.
  other_project = "structra"

  # Structra's hosted zone and Cognito pool, denied by ARN because neither
  # route53 nor cognito-idp evaluates resource tags on every relevant action.
  structra_zone_id = "Z06774172J4OPAI03JK8V"
  structra_pool_id = "ap-south-1_UXnuuw7VV"
}

# Adopted, not created. An AWS account may hold exactly one OIDC provider per
# issuer URL, and Structra already created this one. Declaring it as a resource
# here would fail with EntityAlreadyExists.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "terraform_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Deliberately narrower than "repo:owner/name:*". That wildcard would let a
    # workflow running on any branch of the repo assume this role, so anyone who
    # can push a branch could apply arbitrary Terraform. Only three contexts are
    # trusted: a pull request (plan only, enforced by the workflow), the main
    # branch, and the protected prod environment that gates apply.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${local.github_repo}:pull_request",
        "repo:${local.github_repo}:ref:refs/heads/main",
        "repo:${local.github_repo}:environment:prod",
      ]
    }
  }
}

resource "aws_iam_role" "terraform" {
  name               = "${local.project}-${local.env}-github-terraform"
  description        = "Assumed by GitHub Actions to plan and apply Terraform"
  assume_role_policy = data.aws_iam_policy_document.terraform_assume.json

  # An apply that hangs on a slow CloudFront distribution can outlast the
  # default hour. Six is the longest a GitHub Actions job can run anyway.
  max_session_duration = 21600

  tags = merge(local.tags, { Name = "${local.project}-${local.env}-github-terraform" })
}

# ── Remote state ─────────────────────────────────────────────────────────────
data "aws_iam_policy_document" "terraform_state" {
  statement {
    sid       = "ListStateBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    sid    = "ReadWriteState"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      # The lock file S3-native locking creates, and deletes on release.
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.state.arn}/*"]
  }
}

resource "aws_iam_role_policy" "terraform_state" {
  name   = "terraform-state"
  role   = aws_iam_role.terraform.id
  policy = data.aws_iam_policy_document.terraform_state.json
}

# ── What Terraform is allowed to build ───────────────────────────────────────
#
# An explicit service list rather than the usual PowerUserAccess. PowerUser
# would also hand CI every service this project does not use, in an account
# that hosts someone else's production database. The list below is what the
# target architecture actually touches; adding a service is a visible one-line
# diff, which is the point.
data "aws_iam_policy_document" "terraform_build" {
  statement {
    sid    = "CoreServices"
    effect = "Allow"
    actions = [
      "ec2:*",         # VPC, subnets, security groups, the instance, EIP, EBS
      "s3:*",          # frontend and asset buckets
      "route53:*",     # hosted zone and records
      "acm:*",         # certificates
      "ssm:*",         # parameters, plus SendCommand for container deploys
      "ecr:*",         # image registry
      "cognito-idp:*", # user pool, clients, custom domain
      "cloudfront:*",  # frontend distributions
      "lambda:*",      # the Cognito pre-signup trigger
      "logs:*",        # log groups for the above
      "cloudwatch:*",  # alarms
      "dlm:*",         # nightly EBS snapshot lifecycle policy
      "kms:Describe*", # reading the aws/ssm managed key
      "tag:GetResources",
      "sts:GetCallerIdentity",
    ]
    resources = ["*"]
  }

  # Terraform reads SecureString parameter values during a plan, which needs
  # kms:Decrypt on top of ssm:GetParameters. ViaService pins this to decryption
  # performed by SSM on the caller's behalf, so the role cannot turn around and
  # decrypt anything else that happens to use the same managed key.
  statement {
    sid       = "DecryptThroughSSMOnly"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${local.region}.amazonaws.com"]
    }
  }

  # IAM is scoped by name, because IAM is how a broad role becomes an admin
  # role. Terraform creates the instance profile and the Cognito trigger's
  # execution role, and every one of them is clyro-prefixed.
  statement {
    sid    = "ScopedIAM"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRoleTags",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:CreateInstanceProfile",
      "iam:DeleteInstanceProfile",
      "iam:GetInstanceProfile",
      "iam:AddRoleToInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
      "iam:TagInstanceProfile",
    ]
    resources = [
      "arn:aws:iam::${local.account_id}:role/${local.project}-*",
      "arn:aws:iam::${local.account_id}:instance-profile/${local.project}-*",
    ]
  }

  # Read-only IAM. Terraform's plans reference the OIDC provider and AWS
  # managed policies, and refreshing an existing role reads it back.
  statement {
    sid    = "ReadOnlyIAM"
    effect = "Allow"
    actions = [
      "iam:GetOpenIDConnectProvider",
      "iam:ListOpenIDConnectProviders",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:ListRoles",
      "iam:ListInstanceProfiles",
    ]
    resources = ["*"]
  }

  # Attaching a role to the EC2 instance or to a Lambda is a PassRole, and an
  # unscoped PassRole is a direct escalation: pass an existing admin role to a
  # service you control and read its credentials back out.
  statement {
    sid       = "PassOwnRolesOnly"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.account_id}:role/${local.project}-*"]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values = [
        "ec2.amazonaws.com",
        "lambda.amazonaws.com",
        "dlm.amazonaws.com",
      ]
    }
  }
}

resource "aws_iam_role_policy" "terraform_build" {
  name   = "terraform-build"
  role   = aws_iam_role.terraform.id
  policy = data.aws_iam_policy_document.terraform_build.json
}

# ── Guardrails ───────────────────────────────────────────────────────────────
#
# An explicit Deny beats any Allow, including the wildcards above. This is the
# policy that makes sharing an account with Structra defensible: without it,
# "ec2:*" and "s3:*" on "*" would let a bad plan delete another product's
# production infrastructure.
data "aws_iam_policy_document" "terraform_guardrails" {
  # The broad net. Both projects tag every resource with Project, so anything
  # carrying Project=structra is off limits whatever the service.
  #
  # A tag condition only bites on actions that expose the tag, so this is the
  # first layer and not the only one; the ARN-specific denials below cover the
  # resources that matter most where tags are not evaluated.
  statement {
    sid       = "DenyAnythingTaggedStructra"
    effect    = "Deny"
    actions   = ["*"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = [local.other_project]
    }
  }

  statement {
    sid     = "DenyStructraBuckets"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${local.other_project}-*",
      "arn:aws:s3:::${local.other_project}-*/*",
    ]
  }

  statement {
    sid       = "DenyStructraRoles"
    effect    = "Deny"
    actions   = ["iam:*"]
    resources = ["arn:aws:iam::${local.account_id}:role/${local.other_project}-*"]
  }

  statement {
    sid       = "DenyStructraZone"
    effect    = "Deny"
    actions   = ["route53:*"]
    resources = ["arn:aws:route53:::hostedzone/${local.structra_zone_id}"]
  }

  statement {
    sid       = "DenyStructraUserPool"
    effect    = "Deny"
    actions   = ["cognito-idp:*"]
    resources = ["arn:aws:cognito-idp:${local.region}:${local.account_id}:userpool/${local.structra_pool_id}"]
  }

  # Clyro runs Postgres in a container on the instance, by design, so it has no
  # business calling RDS at all. The only RDS instance in this account is
  # structra-prod-db. Denying the whole service is both accurate and the
  # strongest possible protection for it.
  statement {
    sid       = "DenyRDSEntirely"
    effect    = "Deny"
    actions   = ["rds:*"]
    resources = ["*"]
  }

  # Self-modification. Terraform running in CI must never be able to rewrite
  # the role it is running as, or the state bucket policy, or the shared OIDC
  # provider. All three are owned by the bootstrap layer, which is applied by
  # hand.
  statement {
    sid    = "DenyEditingOwnRoleAndBootstrap"
    effect = "Deny"
    actions = [
      "iam:*Role*",
      "iam:*OpenIDConnectProvider*",
      "s3:PutBucketPolicy",
      "s3:DeleteBucketPolicy",
      "s3:DeleteBucket",
    ]
    resources = [
      aws_iam_role.terraform.arn,
      data.aws_iam_openid_connect_provider.github.arn,
      aws_s3_bucket.state.arn,
    ]
  }

  # IAM users are the classic escape hatch: create one, give it a key, and the
  # credential outlives the workflow and every condition on it. Nothing in this
  # project uses IAM users, so the whole surface is denied.
  statement {
    sid    = "DenyUserAndKeyCreation"
    effect = "Deny"
    actions = [
      "iam:*User*",
      "iam:*AccessKey*",
      "iam:*LoginProfile*",
      "iam:*SAMLProvider*",
      "iam:CreateAccountAlias",
      "organizations:*",
      "account:*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "terraform_guardrails" {
  name   = "terraform-guardrails"
  role   = aws_iam_role.terraform.id
  policy = data.aws_iam_policy_document.terraform_guardrails.json
}

output "github_terraform_role_arn" {
  description = "Set as the GH_TERRAFORM_ROLE_ARN repository secret"
  value       = aws_iam_role.terraform.arn
}
