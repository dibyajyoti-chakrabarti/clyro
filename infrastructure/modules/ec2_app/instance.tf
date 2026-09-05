# ── Backups ──────────────────────────────────────────────────────────────────
#
# Postgres shares this box rather than living in RDS, which saves about $15 a
# month and one managed service to reason about. This section is what makes
# that a defensible choice instead of a reckless one: without it, a lost
# instance is a lost database.
#
# Two independent mechanisms, because they fail differently. An EBS snapshot
# restores the whole machine but is only as good as whatever was mid-write when
# it was taken. A pg_dump is transactionally consistent and restorable onto any
# Postgres, but has to be driven by a job that could silently stop running.

resource "aws_s3_bucket" "backups" {
  bucket = "${local.prefix}-backups-${var.account_id}"
  tags   = { Name = "${local.prefix}-backups" }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-dumps"
    status = "Enabled"
    filter {}

    expiration {
      days = var.backup_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# ── Nightly EBS snapshots ────────────────────────────────────────────────────
resource "aws_iam_role" "dlm" {
  name = "${local.prefix}-dlm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "dlm.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "daily" {
  description        = "${local.prefix} nightly root volume snapshot"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["INSTANCE"]

    # Targets by tag rather than by instance id, so replacing the instance does
    # not silently leave the schedule pointing at something that no longer
    # exists. A hardcoded id going stale is exactly how the old nightly
    # shutdown broke for weeks without anyone noticing.
    target_tags = {
      Backup = "daily"
    }

    schedule {
      name = "nightly"

      create_rule {
        # 19:30 UTC is 01:00 IST, comfortably outside any demo window.
        cron_expression = "cron(30 19 * * ? *)"
      }

      retain_rule {
        count = var.snapshot_retention_count
      }

      copy_tags = true
    }
  }
}

# ── The instance ─────────────────────────────────────────────────────────────

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # IMDSv2 only. With IMDSv1 a single server-side request forgery in the
  # application is enough to read this instance's role credentials, and this
  # role can assume into customer accounts.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2 # containers are one hop further out than the host
  }

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    aws_region        = var.aws_region
    ssm_prefix        = "/${var.project}/${var.environment}"
    backend_image     = var.backend_image
    api_domain        = var.api_domain
    backups_bucket    = aws_s3_bucket.backups.bucket
    letsencrypt_email = var.letsencrypt_email
  })

  # Changing user_data on a running box does nothing, since cloud-init only
  # runs on first boot. Making it replace the instance keeps the code and the
  # running machine honest with each other.
  user_data_replace_on_change = true

  tags = {
    Name   = "${local.prefix}-app"
    Backup = "daily"
  }
}

# A static address, so the DNS record does not have to be rewritten every time
# the box stops and starts. An Elastic IP is free while attached to a running
# instance and billed only when idle.
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "${local.prefix}-app" }
}
