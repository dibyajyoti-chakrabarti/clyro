# ── The customer-facing CloudFormation bootstrap template ────────────────────
#
# Wizard Step 2 hands the user a CloudFormation quick-create link so they can
# create the cross-account role Clyro assumes to provision their infrastructure.
# The link carries a templateURL, and CloudFormation fetches that URL from
# inside the *customer's* account, so it has to be readable by anyone.
#
# This exists because the URL was hardcoded to a bucket in the previous AWS
# account. That account is closed, so the bucket answers AllAccessDisabled and
# every quick-create link opened a CloudFormation page that could not load its
# template. Step 2 was unreachable for every user, and nothing pointed at the
# cause because the failure happened in the customer's console rather than in
# anything Clyro logs.
#
# Terraform owns the object as well as the bucket. The template is a real file
# in this repository (backend/cfn-templates/bootstrap.yaml), so keeping the
# upload here means editing that file and applying is the whole publish step,
# and there is no drift between what the repo says the role grants and what a
# customer actually creates.

resource "aws_s3_bucket" "cfn_bootstrap" {
  bucket = "${local.prefix}-cfn-bootstrap-${var.account_id}"
}

# Public read is the requirement, not an oversight: CloudFormation in an account
# Clyro has no access to must be able to GET this object. The bucket holds one
# world-readable template and nothing else, which is why the policy grants
# s3:GetObject on a single key rather than on the bucket.
resource "aws_s3_bucket_public_access_block" "cfn_bootstrap" {
  bucket = aws_s3_bucket.cfn_bootstrap.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "cfn_bootstrap_public_read" {
  statement {
    sid       = "PublicReadBootstrapTemplate"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.cfn_bootstrap.arn}/bootstrap.yaml"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "cfn_bootstrap" {
  bucket = aws_s3_bucket.cfn_bootstrap.id
  policy = data.aws_iam_policy_document.cfn_bootstrap_public_read.json

  # The access block has to be relaxed before a policy with Principal "*" is
  # accepted, so the ordering is explicit rather than incidental.
  depends_on = [aws_s3_bucket_public_access_block.cfn_bootstrap]
}

resource "aws_s3_bucket_versioning" "cfn_bootstrap" {
  bucket = aws_s3_bucket.cfn_bootstrap.id
  versioning_configuration {
    status = "Enabled"
  }
}

# etag on the file contents, so editing the template and applying republishes
# it. Without it Terraform would consider the object unchanged forever.
resource "aws_s3_object" "cfn_bootstrap_template" {
  bucket       = aws_s3_bucket.cfn_bootstrap.id
  key          = "bootstrap.yaml"
  source       = "${path.module}/../../backend/cfn-templates/bootstrap.yaml"
  etag         = filemd5("${path.module}/../../backend/cfn-templates/bootstrap.yaml")
  content_type = "text/yaml"
}

# Read by backend/app/provisioning/cfn_bootstrap.py. Published rather than
# hardcoded so the URL cannot go stale against the account again: if the bucket
# moves, the parameter moves with it in the same apply.
resource "aws_ssm_parameter" "cfn_bootstrap_template_url" {
  name  = "${local.ssm_base}/env/CFN_BOOTSTRAP_TEMPLATE_URL"
  type  = "String"
  value = "https://${aws_s3_bucket.cfn_bootstrap.bucket}.s3.${var.aws_region}.amazonaws.com/bootstrap.yaml"
}
