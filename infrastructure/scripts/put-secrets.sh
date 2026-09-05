#!/usr/bin/env bash
# Populate the SecureString parameters that infrastructure/foundation creates
# empty.
#
# Foundation owns each aws_ssm_parameter but not its value: every one carries
# lifecycle { ignore_changes = [value] } and is created holding the literal
# "PENDING". This script is what puts the real values in. Because Terraform
# ignores the value, applying afterwards never clobbers what this writes.
#
# RUN THIS AFTER the first `terraform apply` in infrastructure/foundation.
# Running it first would create the parameters outside Terraform, and the apply
# would then fail trying to create parameters that already exist.
#
# Safe to re-run. By default it skips any parameter that already holds a real
# value, so a second run only fills in what is still missing. Pass --force to
# overwrite. Values are never printed; only names and byte counts reach stdout.
#
#   export AWS_PROFILE=home
#   ./put-secrets.sh --github-pem ~/clyro-github-app.pem \
#                    --google-client-id "..." --google-client-secret "..."
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
PROJECT="${PROJECT:-clyro}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
PREFIX="/${PROJECT}/${ENVIRONMENT}"

FORCE=0
GITHUB_PEM=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)                 FORCE=1; shift ;;
    --github-pem)            GITHUB_PEM="$2"; shift 2 ;;
    --google-client-id)      GOOGLE_CLIENT_ID="$2"; shift 2 ;;
    --google-client-secret)  GOOGLE_CLIENT_SECRET="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# A parameter counts as unpopulated while it still holds the placeholder
# Terraform created it with. Reading the value is the only way to tell, so this
# does decrypt it, but it never leaves the function.
needs_value() {
  local name="$1" current
  if [[ $FORCE -eq 1 ]]; then return 0; fi
  current="$(aws ssm get-parameter --name "$name" --with-decryption \
    --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || echo "PENDING")"
  [[ "$current" == "PENDING" || -z "$current" ]]
}

put() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  skip   ${name}  (no value supplied)"
    return
  fi
  if ! needs_value "$name"; then
    echo "  keep   ${name}  (already populated, use --force to replace)"
    return
  fi
  aws ssm put-parameter --name "$name" --type SecureString \
    --value "$value" --overwrite --region "$REGION" >/dev/null
  echo "  wrote  ${name}  (${#value} bytes)"
}

echo "Populating SecureString parameters under ${PREFIX} in ${REGION}"

# Generated rather than asked for: nothing outside AWS needs to know either of
# these, so there is no reason for a human to ever see them. 50 URL-safe
# characters comfortably exceeds what Django asks of a SECRET_KEY.
put "${PREFIX}/django/secret-key" "$(python3 -c 'import secrets;print(secrets.token_urlsafe(50))')"

# No shell-metacharacter or URL-encoding hazards in the password: it is passed
# to the postgres container and into a libpq URL, and the old RDS-generated
# passwords containing $, & and % were a recurring source of corrupted DSNs.
put "${PREFIX}/db/password" "$(python3 -c 'import secrets,string;a=string.ascii_letters+string.digits;print("".join(secrets.choice(a) for _ in range(40)))')"

# Minted by hand outside AWS, so these have to be supplied.
if [[ -n "$GITHUB_PEM" ]]; then
  [[ -r "$GITHUB_PEM" ]] || { echo "cannot read ${GITHUB_PEM}" >&2; exit 1; }
  put "${PREFIX}/github/app-pem" "$(cat "$GITHUB_PEM")"
else
  echo "  skip   ${PREFIX}/github/app-pem  (pass --github-pem <file>)"
fi

put "${PREFIX}/cognito/google-client-id"     "$GOOGLE_CLIENT_ID"
put "${PREFIX}/cognito/google-client-secret" "$GOOGLE_CLIENT_SECRET"

echo "Done."
