#!/usr/bin/env bash
# Deploy the Rust API to AWS Lambda via ECR.
# Run from the project root after merging to develop.
set -euo pipefail

AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/icc-rankings/icc-api"
FUNCTION_NAME="icc-rankings-api"

echo "→ Authenticating to public ECR (for lambda-adapter base image)..."
aws ecr-public get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin public.ecr.aws

echo "→ Authenticating to private ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "→ Building image (linux/amd64, no provenance)..."
docker build --platform linux/amd64 --provenance=false \
  -f docker/Dockerfile.api \
  -t icc-api:latest \
  apps/api/

echo "→ Pushing to ECR..."
docker tag icc-api:latest "${ECR_REPO}:latest"
docker push "${ECR_REPO}:latest"

echo "→ Updating Lambda function code..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --image-uri "${ECR_REPO}:latest" \
  --region "$AWS_REGION" \
  --output text --query 'LastUpdateStatus'

echo "✓ Deploy triggered. Check status with:"
echo "  aws lambda get-function --function-name $FUNCTION_NAME --region $AWS_REGION --query 'Configuration.LastUpdateStatus'"
