#!/usr/bin/env bash
#
# deploy_mcp.sh — build & deploy the 3 Crylo Step-3 MCP servers as
# container-image Lambda functions, each fronted by the AgentCore Gateway as a
# Lambda target. Idempotent: safe to re-run (creates on first run, updates
# thereafter). Prints the 3 Lambda ARNs at the end and writes them to arns.env.
#
# Targets (curated tool subset per each dir's tools.json):
#   pricing  -> get_pricing                          (IAM: pricing:GetProducts)
#   cfn      -> validate_cloudformation_template      (IAM: none; offline cfn-lint)
#   docs     -> search/read_documentation, recommend  (IAM: none; public HTTP)
#
# Prereqs: awscli v2, docker, and credentials with permission to create ECR
# repos, IAM roles, and Lambda functions. You (not the build) run this.
#
# Usage:
#   ./deploy_mcp.sh                      # defaults AWS_REGION to ap-south-1
#   AWS_REGION=us-east-1 ./deploy_mcp.sh # override region
set -euo pipefail

# ---- config -----------------------------------------------------------------
# ap-south-1 (Mumbai) verified to support Lambda, ECR, Bedrock, AgentCore, and
# the Pricing GetProducts API — so the MCP Lambdas, the gateway/agents, and the
# pricing tool's live calls all work there.
AWS_REGION="${AWS_REGION:-ap-south-1}"
LAMBDA_TIMEOUT="${LAMBDA_TIMEOUT:-60}"
LAMBDA_MEMORY="${LAMBDA_MEMORY:-1024}"
# AgentCore Gateway invokes Lambda targets; allow that service principal.
GATEWAY_PRINCIPAL="bedrock-agentcore.amazonaws.com"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ARNS_OUT="${SCRIPT_DIR}/arns.env"
: > "$ARNS_OUT"

# ECR registry host — see the README note on fully filtering a shared log.)
ACCOUNT_MASKED="********${ACCOUNT_ID: -4}"
mask() { printf '%s' "$1" | sed "s/${ACCOUNT_ID}/${ACCOUNT_MASKED}/g"; }

echo "==> Account ${ACCOUNT_MASKED}  Region ${AWS_REGION}"

# ---- ECR login (once) -------------------------------------------------------
echo "==> Logging in to ECR $(mask "$ECR_REGISTRY")"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# ---- helpers ----------------------------------------------------------------
lambda_trust_policy() {
  cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
JSON
}

# ensure_role <role_name> <inline_policy_json_or_empty>
ensure_role() {
  local role_name="$1" inline_policy="$2" role_arn
  if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    echo "    role ${role_name} exists"
  else
    echo "    creating role ${role_name}"
    aws iam create-role --role-name "$role_name" \
      --assume-role-policy-document "$(lambda_trust_policy)" >/dev/null
    aws iam attach-role-policy --role-name "$role_name" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    # New roles need a moment before Lambda can assume them.
    sleep 10
  fi
  if [[ -n "$inline_policy" ]]; then
    aws iam put-role-policy --role-name "$role_name" \
      --policy-name "${role_name}-inline" \
      --policy-document "$inline_policy"
  fi
  role_arn="$(aws iam get-role --role-name "$role_name" --query Role.Arn --output text)"
  echo "$role_arn"
}

# deploy_one <dir> <repo/function suffix> <inline_policy_json_or_empty>
deploy_one() {
  local dir="$1" name="$2" inline_policy="$3"
  local repo="clyro-mcp-${name}"
  local fn="clyro-mcp-${name}"
  local role="clyro-mcp-${name}-role"
  local image_uri="${ECR_REGISTRY}/${repo}:latest"

  echo ""
  echo "============================================================"
  echo "==> [${name}] build & deploy"
  echo "============================================================"

  # 1. ECR repo
  aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$repo" \
         --image-scanning-configuration scanOnPush=true >/dev/null
  echo "    ecr repo: ${repo}"

  # 2. build (force linux/amd64 to match Lambda x86_64) and push.
  #    --provenance=false --sbom=false: BuildKit otherwise attaches attestation
  #    manifests that wrap the image in a manifest list (OCI index), which Lambda
  #    rejects with "image manifest ... media type ... is not supported". These
  #    flags keep it a single-platform image Lambda can pull.
  echo "    building image..."
  docker build --platform linux/amd64 --provenance=false --sbom=false \
    -t "$image_uri" "${SCRIPT_DIR}/${dir}"
  echo "    pushing image..."
  docker push "$image_uri"
  # Resolve the immutable digest so the Lambda update always picks up the push.
  local digest image_ref
  digest="$(aws ecr describe-images --repository-name "$repo" \
            --image-ids imageTag=latest \
            --query 'imageDetails[0].imageDigest' --output text)"
  image_ref="${ECR_REGISTRY}/${repo}@${digest}"

  # 3. IAM role (least-priv)
  local role_arn
  role_arn="$(ensure_role "$role" "$inline_policy" | tail -n1)"
  echo "    role arn: $(mask "$role_arn")"

  # 4. create or update the function
  if aws lambda get-function --function-name "$fn" >/dev/null 2>&1; then
    echo "    updating function code..."
    aws lambda update-function-code --function-name "$fn" \
      --image-uri "$image_ref" >/dev/null
    aws lambda wait function-updated --function-name "$fn"
    aws lambda update-function-configuration --function-name "$fn" \
      --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" >/dev/null
    aws lambda wait function-updated --function-name "$fn"
  else
    echo "    creating function..."
    aws lambda create-function --function-name "$fn" \
      --package-type Image \
      --code "ImageUri=${image_ref}" \
      --role "$role_arn" \
      --architectures x86_64 \
      --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" >/dev/null
    aws lambda wait function-active --function-name "$fn"
  fi

  # 5. allow the AgentCore Gateway service to invoke this Lambda (idempotent)
  aws lambda remove-permission --function-name "$fn" \
    --statement-id agentcore-gateway-invoke >/dev/null 2>&1 || true
  aws lambda add-permission --function-name "$fn" \
    --statement-id agentcore-gateway-invoke \
    --action lambda:InvokeFunction \
    --principal "$GATEWAY_PRINCIPAL" \
    --source-account "$ACCOUNT_ID" >/dev/null 2>&1 \
    || echo "    (note: could not add ${GATEWAY_PRINCIPAL} invoke permission; the gateway execution role must allow lambda:InvokeFunction on this ARN)"

  local fn_arn
  fn_arn="$(aws lambda get-function --function-name "$fn" \
            --query Configuration.FunctionArn --output text)"
  echo "    => ${name} Lambda ARN: $(mask "$fn_arn")"
  echo "CLYRO_MCP_${name^^}_ARN=${fn_arn}" >> "$ARNS_OUT"
}

# ---- least-priv inline policies --------------------------------------------
PRICING_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["pricing:GetProducts"],
    "Resource": "*"
  }]
}'

# cfn (aws-iac-mcp-server) only runs cfn-lint locally — no AWS API access.
CFN_POLICY=''

# docs needs no AWS API access (it calls public AWS docs endpoints over HTTPS).
DOCS_POLICY=''

# ---- deploy all three -------------------------------------------------------
deploy_one pricing pricing "$PRICING_POLICY"
deploy_one cfn     cfn     "$CFN_POLICY"
deploy_one docs    docs    "$DOCS_POLICY"

echo ""
echo "============================================================"
echo "==> Done. Real ARNs written to ${ARNS_OUT} (account id masked below):"
echo "============================================================"
mask "$(cat "$ARNS_OUT")"
echo ""
echo "Real values: cat ${ARNS_OUT}  (or: source ${ARNS_OUT})"
echo "Next: register each ARN as an AgentCore Gateway Lambda target with its"
echo "tools.json (see backend/mcp/README.md, step 2)."
