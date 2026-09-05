variable "project" {
  description = "Name prefix for every resource this project creates"
  type        = string
  default     = "clyro"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "domain" {
  type    = string
  default = "clyro.cloud"
}

# Account 469465348250. This account is shared with an unrelated product
# (Structra), which is why every resource here is prefixed and why the VPC CIDR
# below deliberately avoids Structra's 10.0.0.0/16.
variable "account_id" {
  type    = string
  default = "469465348250"
}

# ACM issues a certificate only after it can resolve the DNS validation record
# on the public internet, which cannot happen until the registrar's nameservers
# point at this zone. Leave this false for the first apply, copy the nameservers
# from the route53_name_servers output into the registrar, wait for the
# delegation to propagate, then set it true and apply again.
#
# Without the gate, the first apply parks on aws_acm_certificate_validation for
# its full timeout and then fails, leaving a half-built layer.
variable "dns_delegated" {
  description = "Set true once the registrar's NS records point at this hosted zone"
  type        = bool
  default     = false
}

# ── Networking (consumed in the next phase, when the EC2 box lands) ──────────
#
# 10.20.0.0/16, not the 10.0.0.0/16 the old design used: Structra's VPC in this
# same account already occupies 10.0.0.0/16. Two VPCs may legally overlap, but
# overlapping ranges rule out peering later and make every VPC flow log
# ambiguous when reading them side by side.
variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.1.0/24", "10.20.2.0/24"]
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
}

variable "github_repo" {
  description = "GitHub repo in owner/name format, used to scope the OIDC role trust policy"
  type        = string
  default     = "dibyajyoti-chakrabarti/clyro"
}
