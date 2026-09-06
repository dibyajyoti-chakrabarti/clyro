# The CloudFormation execution policy for CDK deploys.
#
# The AgentCore runtimes are the one part of the estate CDK owns rather than
# Terraform, and `cdk deploy` does not call AWS as the caller. It assumes the
# roles `cdk bootstrap` creates, and CloudFormation then makes every resource
# call as cdk-hnb659fds-cfn-exec-role. That role is granted AdministratorAccess
# by a default bootstrap.
#
# Which would quietly undo the point of github_oidc.tf. The CI role's IAM is
# name-scoped to clyro-* so that CI cannot mint an admin role; letting it
# assume an admin execution role reaches the same place by a longer route. So
# the account is bootstrapped against this policy instead:
#
#   cdk bootstrap aws://<account>/ap-south-1 \
#     --cloudformation-execution-policies arn:aws:iam::<account>:policy/clyro-cdk-exec
#
# The contents are not guesswork. Both CDK apps were synthesized and their
# templates read: between them they create a Runtime, a Gateway, four
# GatewayTargets, a Memory, and five IAM roles, all auto-named by
# CloudFormation from the stack names AgentCore-CryloIac-prod and
# AgentCore-CryloCanvas-prod, and all trusting bedrock-agentcore.amazonaws.com.
# That is what AgentCore-* below is scoped against.

data "aws_iam_policy_document" "cdk_exec" {
  # The resources the two stacks exist to create: runtimes, gateways, gateway
  # targets and one memory. bedrock-agentcore has no resource-level ARN scheme
  # worth scoping to before the resources exist, and this role can reach
  # nothing else, so the wildcard is bounded by everything around it.
  statement {
    sid       = "AgentCoreResources"
    effect    = "Allow"
    actions   = ["bedrock-agentcore:*"]
    resources = ["*"]
  }

  # The five execution roles the L3 constructs create. None of them sets
  # RoleName, so CloudFormation names them from the stack: AgentCore-CryloIac-*
  # and AgentCore-CryloCanvas-*. Scoping to AgentCore-* keeps this role away
  # from every clyro-* role, including the one CI runs as.
  statement {
    sid    = "ScopedIAMForAgentCoreRoles"
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
    ]
    resources = ["arn:aws:iam::${local.account_id}:role/AgentCore-*"]
  }

  # Handing a role to a service is how a scoped policy becomes an unscoped one,
  # so the only roles this can pass are the ones it just created, and the only
  # service it can pass them to is the one that runs them.
  statement {
    sid       = "PassAgentCoreRolesOnly"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.account_id}:role/AgentCore-*"]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["bedrock-agentcore.amazonaws.com"]
    }
  }

  # The runtime code ships as a CodeZip staged in the CDK assets bucket, and
  # the template itself is read from there on anything but the smallest stack.
  statement {
    sid    = "ReadStagedAssets"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::cdk-hnb659fds-assets-${local.account_id}-${local.region}",
      "arn:aws:s3:::cdk-hnb659fds-assets-${local.account_id}-${local.region}/*",
    ]
  }

  # Every synthesized template carries a BootstrapVersion parameter that reads
  # this, so a deploy fails at parameter resolution without it.
  statement {
    sid       = "BootstrapVersionParameter"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = ["arn:aws:ssm:${local.region}:${local.account_id}:parameter/cdk-bootstrap/*"]
  }

  statement {
    sid    = "StackReads"
    effect = "Allow"
    actions = [
      "cloudformation:DescribeStacks",
      "cloudformation:DescribeStackEvents",
      "cloudformation:DescribeStackResource",
      "cloudformation:DescribeStackResources",
      "cloudformation:GetTemplate",
    ]
    resources = ["*"]
  }

  # An explicit Deny for the two shapes that would turn the grants above back
  # into an admin path: attaching a managed admin policy to an AgentCore-* role
  # this can also pass, and creating a user with a long-lived access key that
  # outlives the deploy.
  statement {
    sid       = "DenyBroadManagedPolicies"
    effect    = "Deny"
    actions   = ["iam:AttachRolePolicy"]
    resources = ["*"]

    condition {
      test     = "ArnLike"
      variable = "iam:PolicyARN"
      values = [
        "arn:aws:iam::aws:policy/AdministratorAccess",
        "arn:aws:iam::aws:policy/PowerUserAccess",
        "arn:aws:iam::aws:policy/IAMFullAccess",
      ]
    }
  }

  statement {
    sid    = "DenyUserAndKeyCreation"
    effect = "Deny"
    actions = [
      "iam:*User*",
      "iam:*AccessKey*",
      "iam:*LoginProfile*",
      "organizations:*",
      "account:*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "cdk_exec" {
  name        = "${local.project}-cdk-exec"
  description = "CloudFormation execution policy for CDK deploys, in place of AdministratorAccess"
  policy      = data.aws_iam_policy_document.cdk_exec.json
  tags        = local.tags
}

output "cdk_bootstrap_command" {
  description = "Run once, by hand, before the first agentcore deploy"
  value = join(" ", [
    "cdk bootstrap aws://${local.account_id}/${local.region}",
    "--cloudformation-execution-policies ${aws_iam_policy.cdk_exec.arn}",
  ])
}
