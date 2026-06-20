#!/usr/bin/env bash
# Quick ECS scale helper: ecs-scale.sh <count>
# Example: ./ecs-scale.sh 0   (pause)
#          ./ecs-scale.sh 1   (resume)
set -euo pipefail

COUNT="${1:?Usage: $0 <desired-count>}"
PROFILE="${AWS_PROFILE:-clyro}"
REGION="${AWS_REGION:-ap-south-1}"
CLUSTER="${ECS_CLUSTER:-clyro-prod-cluster}"
SERVICE="${ECS_SERVICE:-clyro-prod-backend-service}"

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --desired-count "$COUNT" \
  --profile "$PROFILE" \
  --region "$REGION"

echo "[$(date -u)] ECS service $SERVICE scaled to $COUNT."
