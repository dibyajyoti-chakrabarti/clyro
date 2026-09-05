resource "aws_acm_certificate" "main" {
  domain_name               = var.domain
  subject_alternative_names = var.sans
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { ManagedBy = "Terraform" }
}

# A wildcard SAN and its base domain ("*.clyro.cloud" and "clyro.cloud")
# validate through one and the same DNS record, so iterating every validation
# option produces two resources fighting over a single record name.
#
# The wildcards are filtered out rather than deduplicated by record name,
# because resource_record_name is a hash ACM only computes once the certificate
# exists. Using it as a for_each key fails at plan time with "Invalid for_each
# argument": the keys must be known before anything is created. domain_name
# comes straight from this module's own inputs, so it always is.
#
# This is correct only while every wildcard on the certificate has its base
# domain on the certificate too, which is what supplies the shared record.
resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options :
    dvo.domain_name => dvo
    if !startswith(dvo.domain_name, "*.")
  }

  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}
