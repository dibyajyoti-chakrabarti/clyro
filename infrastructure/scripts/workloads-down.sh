#!/usr/bin/env bash
# Shut down workloads layer — two modes:
#   DEFAULT: scale ECS to 0 (preserves RDS, faster, safer for prod)
#   FULL:    terraform destroy (use FULL=1 for dev/cost savings that include RDS)
set -euo pipefail

PROFILE="${AWS_PROFILE:-clyro}"
REGION="${AWS_REGION:-ap-south-1}"
CLUSTER="${ECS_CLUSTER:-clyro-prod-cluster}"
SERVICE="${ECS_SERVICE:-clyro-prod-backend-service}"

if [[ "${FULL:-0}" == "1" ]]; then
  echo "[$(date -u)] Full destroy of workloads layer..."
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR/../workloads"
  terraform init -reconfigure
  # Must disable deletion_protection before destroy if set to true
  terraform apply -auto-approve -var="deletion_protection=false" -var="skip_final_snapshot=true"
  terraform destroy -auto-approve
  echo "[$(date -u)] Workloads destroyed."
else
  echo "[$(date -u)] Scaling ECS service to 0 (RDS stays up)..."
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --desired-count 0 \
    --profile "$PROFILE" \
    --region "$REGION"
  echo "[$(date -u)] ECS scaled to 0. RDS is still running."
fi
