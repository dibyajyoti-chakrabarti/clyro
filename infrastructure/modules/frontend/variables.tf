variable "project" { type = string }
variable "environment" { type = string }
variable "domain" { type = string }
variable "acm_certificate_arn" { type = string }
variable "route53_zone_id" { type = string }

variable "account_id" {
  description = "Suffixed onto the bucket name, since S3 names are globally unique"
  type        = string
}

# Distinguishes bucket/distribution names between multiple invocations of this
# module in the same account (e.g. the main site vs the admin panel) — without
# it, a second instance would collide on "<prefix>-frontend".
variable "app_name" {
  type    = string
  default = "frontend"
}

# The admin subdomain has no "www.admin.<domain>" alias — only the apex site
# gets a www redirect.
variable "include_www" {
  type    = bool
  default = true
}
