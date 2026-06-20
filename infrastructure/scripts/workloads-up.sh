#!/usr/bin/env bash
# Bring workloads layer up (RDS + ECS Fargate)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKLOADS_DIR="$SCRIPT_DIR/../workloads"

IMAGE_TAG="${BACKEND_IMAGE_TAG:-latest}"

echo "[$(date -u)] Starting workloads (image: $IMAGE_TAG)..."
cd "$WORKLOADS_DIR"
terraform init -reconfigure
terraform apply -auto-approve \
  -var="backend_image_tag=$IMAGE_TAG"
echo "[$(date -u)] Workloads are up."
