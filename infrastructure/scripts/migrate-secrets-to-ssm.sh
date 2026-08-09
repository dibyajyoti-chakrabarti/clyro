#!/usr/bin/env bash
# One-time migration: copy the Django SECRET_KEY and the GitHub App PEM out of
# Secrets Manager into SSM Parameter Store SecureStrings.
#
# Why: those two values were only ever read by the application, but Secrets
# Manager bills $0.40/secret/month while standard Parameter Store parameters
# are free. More importantly, the values used to be baked in plaintext into the
# Lambda's environment and the ECS task definition — the backend now resolves
# them at runtime from the parameters this script populates
# (backend/config/aws_secrets.py).
#
# The RDS password is deliberately NOT migrated: it is the `password` argument
# of the aws_db_instance resource itself, so moving it would rotate the master
# password on a live database.
#
# Safe to re-run — writing a parameter with the same value is a no-op version
# bump. Values are piped between AWS APIs and never printed; only names and
# byte counts reach stdout.
#
# RUN THIS *AFTER* `terraform apply` IN infrastructure/foundation.
# Foundation owns the two aws_ssm_parameter resources (with lifecycle
# ignore_changes on value, so applying never clobbers what this script writes)
# and publishes the `ssm_prefix` output that the workloads layer consumes.
# Running this first would create the parameters outside Terraform, and the
# next foundation apply would then fail trying to create resources that
# already exist.
set -euo pipefail

PROFILE="${AWS_PROFILE:-clyro}"
REGION="${AWS_REGION:-ap-south-1}"
PROJECT="${PROJECT:-clyro}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

SM_PREFIX="${PROJECT}-${ENVIRONMENT}"
SSM_PREFIX="/${PROJECT}/${ENVIRONMENT}"

# secret-manager-id -> ssm-parameter-name
MIGRATIONS=(
  "${SM_PREFIX}/django/secret-key|${SSM_PREFIX}/django/secret-key"
  "${SM_PREFIX}/github/app-pem|${SSM_PREFIX}/github/app-pem"
)

echo "Migrating secrets to SSM Parameter Store"
echo "  profile=$PROFILE region=$REGION"
echo

for entry in "${MIGRATIONS[@]}"; do
  secret_id="${entry%%|*}"
  param_name="${entry##*|}"

  printf '  %-34s -> %s\n' "$secret_id" "$param_name"

  # Read straight into a variable; never echoed, never written to disk.
  if ! value=$(aws secretsmanager get-secret-value \
        --secret-id "$secret_id" \
        --query SecretString --output text \
        --profile "$PROFILE" --region "$REGION" 2>/dev/null); then
    echo "      ERROR: could not read $secret_id — skipping" >&2
    exit 1
  fi

  if [ -z "$value" ] || [ "$value" = "None" ]; then
    echo "      ERROR: $secret_id is empty — refusing to write an empty parameter" >&2
    exit 1
  fi

  # --overwrite so re-runs update in place instead of failing on exists.
  aws ssm put-parameter \
    --name "$param_name" \
    --type SecureString \
    --value "$value" \
    --overwrite \
    --profile "$PROFILE" --region "$REGION" \
    --query 'Version' --output text >/dev/null

  echo "      ok (${#value} bytes)"
done

echo
echo "Verifying round-trip (decrypting each parameter, comparing lengths only)…"
for entry in "${MIGRATIONS[@]}"; do
  param_name="${entry##*|}"
  read_back=$(aws ssm get-parameter --name "$param_name" --with-decryption \
    --query 'Parameter.Value' --output text \
    --profile "$PROFILE" --region "$REGION")
  printf '  %-40s %s bytes\n' "$param_name" "${#read_back}"
done

cat <<'EOF'

Done. Next steps, in this order:

  1. Deploy the backend so the new code is live. It reads these parameters but
     still prefers any environment variable that is already set, so this step
     changes nothing on its own and is safe to do first.

         gh workflow run deploy-backend.yml

  2. Apply the workloads layer to stop setting the plaintext environment
     variables. (foundation must already be applied — see the header of this
     script for why it comes before this script runs at all.)

         cd infrastructure/workloads && terraform apply

  3. Confirm no plaintext remains:

         aws lambda get-function-configuration \
           --function-name clyro-prod-backend \
           --query 'Environment.Variables' --profile clyro

     SECRET_KEY, GITHUB_APP_PRIVATE_KEY and DATABASE_URL should all be gone,
     replaced by CLYRO_SSM_PREFIX, CLYRO_DB_PASSWORD_SECRET_ARN and DB_*.

  4. ROTATE all three values. They were exposed in Lambda/ECS environment
     variables and in the Terraform state bucket for months; migrating them
     does not undo that. The GitHub App key is the urgent one — it grants
     access to customers' repositories.

  5. Once rotation is done and the deployment is healthy, delete the two now
     unused Secrets Manager secrets to actually realise the saving:

         aws secretsmanager delete-secret --secret-id clyro-prod/django/secret-key \
           --recovery-window-in-days 30 --profile clyro --region ap-south-1
         aws secretsmanager delete-secret --secret-id clyro-prod/github/app-pem \
           --recovery-window-in-days 30 --profile clyro --region ap-south-1

     Leave clyro-prod/rds/password and clyro-prod/cognito/google-oauth alone.
EOF
