locals {
  prefix   = "${var.project}-${var.environment}"
  ssm_base = "/${var.project}/${var.environment}"
}
