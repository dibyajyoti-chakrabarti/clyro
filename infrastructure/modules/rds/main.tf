locals {
  prefix = "${var.project}-${var.environment}"
}

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = var.db_password_secret_arn
}

resource "aws_db_subnet_group" "main" {
  name        = "${local.prefix}-rds-subnet-group"
  description = "RDS subnet group for ${local.prefix}"
  subnet_ids  = var.subnet_ids

  tags = { Name = "${local.prefix}-rds-subnet-group" }
}

resource "aws_db_parameter_group" "pg16" {
  name        = "${local.prefix}-pg16"
  family      = "postgres16"
  description = "PostgreSQL 16 parameter group for ${local.prefix}"

  parameter {
    name  = "client_encoding"
    value = "UTF8"
  }

  tags = { Name = "${local.prefix}-pg16" }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.prefix}-rds"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.db_username
  password = data.aws_secretsmanager_secret_version.db_password.secret_string

  allocated_storage     = var.allocated_storage
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.pg16.name
  vpc_security_group_ids = [var.security_group_id]

  multi_az                = false
  publicly_accessible     = false
  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.prefix}-rds-final-snapshot"

  apply_immediately = false

  tags = { Name = "${local.prefix}-rds" }
}
