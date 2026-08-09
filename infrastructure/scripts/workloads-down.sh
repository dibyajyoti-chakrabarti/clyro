#!/usr/bin/env bash
# Shut down workloads layer — two modes:
#   DEFAULT: scale ECS to 0 (preserves RDS, faster, safer for prod)
#   FULL:    terraform destroy (use FULL=1 for dev/cost savings that include RDS)
set -euo pipefail

PROFILE="${AWS_PROFILE:-clyro}"
REGION="${AWS_REGION:-ap-south-1}"
# These defaults used to be clyro-prod-cluster / clyro-prod-backend-service —
# names that have never existed. The backend is a Lambda, not an ECS service;
# the only ECS workload is the celery worker. Every non-FULL run therefore
# died with ClusterNotFoundException and saved nothing.
CLUSTER="${ECS_CLUSTER:-clyro-prod-celery-cluster}"
SERVICE="${ECS_SERVICE:-clyro-prod-celery-worker}"

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
  echo "[$(date -u)] Scaling celery worker to 0 (RDS stays up)..."
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --desired-count 0 \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'service.{name:serviceName,desired:desiredCount}'
  echo "[$(date -u)] Celery worker scaled to 0. RDS is still running."
  echo "[$(date -u)] NOTE: the backend Lambda is unaffected — the API stays up."
fi
