resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-users-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_signup.arn
  }

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  user_pool_add_ons {
    advanced_security_mode = "AUDIT"
  }

  # Default Cognito email (upgrade to SES for >50 emails/day in production)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = { Name = "${var.project}-users-${var.environment}" }
}

# auth.clyro.cloud, not clyro.auth.ap-south-1.amazoncognito.com.
#
# A custom domain keeps the hosted UI on the product's own name, which matters
# for a login screen users are asked to trust, and it means the OAuth endpoints
# do not move if the pool is ever rebuilt in another region.
#
# The certificate must live in us-east-1 even though the pool is in ap-south-1,
# because a Cognito custom domain is itself fronted by CloudFront. The existing
# wildcard certificate already covers auth.<domain>, so no new one is needed.
#
# AWS refuses to create this unless the PARENT domain already resolves, which
# is why the caller passes a dependency on the frontend module: that module
# creates the apex A record. This is an ordering requirement, not a preference,
# and relying on luck here fails intermittently.
resource "aws_cognito_user_pool_domain" "main" {
  domain          = "auth.${var.domain}"
  certificate_arn = var.acm_certificate_arn
  user_pool_id    = aws_cognito_user_pool.main.id
}

# Despite the attribute name, cloudfront_distribution_arn returns a CloudFront
# *domain name*. The alias zone id is the fixed global CloudFront one.
resource "aws_route53_record" "auth" {
  zone_id = var.route53_zone_id
  name    = "auth.${var.domain}"
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution_arn
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}

# Created only when credentials are actually supplied.
#
# These variables used to be required with no default, deliberately, because a
# "REPLACE_ME" default once silently rewrote the live IdP's client_id and broke
# sign-in for everyone. That danger is real but the cure was too strong: it made
# the entire user pool unappliable until someone had been to the Google console,
# so email sign-up and every other provider were blocked on Google.
#
# Gating on emptiness keeps the protection and drops the blockage. An empty
# value means "not configured yet" and creates nothing; it can never overwrite
# a live provider with a placeholder, because a placeholder creates no resource.
locals {
  # Only the caller's flag. Adding "and the credential looks real" here would
  # put a value read from SSM back into a count, which is exactly what cannot
  # be planned. The placeholder guard lives in a precondition below instead,
  # where it runs at apply time and cannot make the count unknown.
  google_enabled = var.google_enabled
}

resource "aws_cognito_identity_provider" "google" {
  count = local.google_enabled ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id                     = var.google_client_id
    client_secret                 = var.google_client_secret
    authorize_scopes              = "email openid profile"
    attributes_url                = "https://people.googleapis.com/v1/people/me?personFields="
    attributes_url_add_attributes = "true"
    authorize_url                 = "https://accounts.google.com/o/oauth2/v2/auth"
    oidc_issuer                   = "https://accounts.google.com"
    token_request_method          = "POST"
    token_url                     = "https://www.googleapis.com/oauth2/v4/token"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    picture  = "picture"
    username = "sub"
  }

  # The original failure this module guards against: a "REPLACE_ME" default
  # silently rewrote the live client_id and broke sign-in for everyone. Failing
  # the apply is the right response to being handed a placeholder, and doing it
  # here rather than in the count keeps the plan computable.
  lifecycle {
    precondition {
      condition     = var.google_client_id != "" && var.google_client_id != "PENDING"
      error_message = "google_enabled is true but no Google client id was supplied. Populate /clyro/prod/cognito/google-client-id with scripts/put-secrets.sh, or set google_enabled = false."
    }
  }
}

# ── GitHub, via the OIDC shim ────────────────────────────────────────────────
#
# Cognito has no GitHub provider type and cannot have one: GitHub speaks OAuth2
# with no ID token and no JWKS. This points at the shim in backend/app/oidc/,
# which presents GitHub as a conventional OIDC provider.
#
# The endpoints are given explicitly rather than left to discovery. Cognito can
# read them from the issuer's .well-known document, but that makes every apply
# depend on the application being up, and a provider that silently reconfigures
# itself from a remote document is harder to reason about than one whose
# addresses are written down.
resource "aws_cognito_identity_provider" "github" {
  count = var.github_enabled ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "GitHub"
  provider_type = "OIDC"

  provider_details = {
    client_id                 = var.oidc_client_id
    client_secret             = var.oidc_client_secret
    oidc_issuer               = var.oidc_issuer
    authorize_url             = "${var.oidc_issuer}/authorize"
    token_url                 = "${var.oidc_issuer}/token"
    attributes_url            = "${var.oidc_issuer}/userinfo"
    jwks_uri                  = "${var.oidc_issuer}/jwks"
    authorize_scopes          = "openid email profile"
    attributes_request_method = "GET"
  }

  # sub is "github:<numeric id>", which never changes even if the user renames
  # their GitHub account. Mapping username to the login instead would break
  # every account the first time someone renamed themselves.
  attribute_mapping = {
    email    = "email"
    name     = "name"
    picture  = "picture"
    username = "sub"
  }

  lifecycle {
    precondition {
      condition     = var.oidc_client_id != "" && var.oidc_client_secret != ""
      error_message = "github_enabled is true but the shim's client id or secret is unset. Run scripts/put-secrets.sh, or set github_enabled = false."
    }
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true
  supported_identity_providers = concat(
    ["COGNITO"],
    local.google_enabled ? ["Google"] : [],
    var.github_enabled ? ["GitHub"] : [],
  )

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  depends_on = [
    aws_cognito_identity_provider.google,
    aws_cognito_identity_provider.github,
  ]
}
