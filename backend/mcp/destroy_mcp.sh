#!/usr/bin/env bash
#
# destroy_mcp.sh — tear down everything deploy_mcp.sh created: the 3 MCP Lambda
# functions, their IAM roles, and their ECR repos (images included). Idempotent:
# anything already gone is skipped. Also removes the local arns.env.
#
# This only deletes the crylo-mcp-{pricing,cfn,docs} resources by exact name —
# it never touches anything else in the account.
#
# Usage:
#   ./destroy_mcp.sh           # prompts for confirmation
#   ./destroy_mcp.sh -y        # skip the prompt (or: FORCE=1 ./destroy_mcp.sh)
#   AWS_REGION=us-east-1 ./destroy_mcp.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
NAMES=(pricing cfn docs)

ASSUME_YES="${FORCE:-0}"
[[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]] && ASSUME_YES=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARNS_OUT="${SCRIPT_DIR}/arns.env"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ACCOUNT_MASKED="********${ACCOUNT_ID: -4}"
mask() { printf '%s' "$1" | sed "s/${ACCOUNT_ID}/${ACCOUNT_MASKED}/g"; }

echo "==> Account ${ACCOUNT_MASKED}  Region ${AWS_REGION}"
echo "==> Will DELETE these resources (Lambda + role + ECR repo each):"
for name in "${NAMES[@]}"; do
  echo "      crylo-mcp-${name}  /  crylo-mcp-${name}-role  /  ecr:crylo-mcp-${name}"
done

if [[ "$ASSUME_YES" != "1" ]]; then
  read -r -p "Proceed? type 'yes' to confirm: " reply
  [[ "$reply" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

# delete_role <role_name> — detach managed + delete inline policies, then delete.
delete_role() {
  local role="$1"
  aws iam get-role --role-name "$role" >/dev/null 2>&1 || { echo "    role ${role} not found"; return 0; }
  # detach managed policies
  for parn in $(aws iam list-attached-role-policies --role-name "$role" \
                  --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
    aws iam detach-role-policy --role-name "$role" --policy-arn "$parn" || true
  done
  # delete inline policies
  for pname in $(aws iam list-role-policies --role-name "$role" \
                   --query 'PolicyNames[]' --output text 2>/dev/null); do
    aws iam delete-role-policy --role-name "$role" --policy-name "$pname" || true
  done
  aws iam delete-role --role-name "$role" && echo "    deleted role ${role}"
}

for name in "${NAMES[@]}"; do
  fn="crylo-mcp-${name}"
  role="crylo-mcp-${name}-role"
  repo="crylo-mcp-${name}"

  echo ""
  echo "==> [${name}] teardown"

  # 1. Lambda function
  if aws lambda get-function --function-name "$fn" >/dev/null 2>&1; then
    aws lambda delete-function --function-name "$fn" && echo "    deleted function ${fn}"
  else
    echo "    function ${fn} not found"
  fi

  # 2. IAM role
  delete_role "$role"

  # 3. ECR repo (force removes any images)
  if aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1; then
    aws ecr delete-repository --repository-name "$repo" --force >/dev/null \
      && echo "    deleted ecr repo ${repo}"
  else
    echo "    ecr repo ${repo} not found"
  fi
done

# Local artifact
if [[ -f "$ARNS_OUT" ]]; then
  rm -f "$ARNS_OUT" && echo ""
  echo "==> removed ${ARNS_OUT}"
fi

echo ""
echo "==> Teardown complete. Re-run ./deploy_mcp.sh to recreate."
