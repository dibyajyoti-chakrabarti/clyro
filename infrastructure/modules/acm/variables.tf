variable "domain" {
  description = "Primary domain for the certificate"
  type        = string
}

variable "sans" {
  description = "Subject alternative names for the certificate"
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS validation"
  type        = string
}
