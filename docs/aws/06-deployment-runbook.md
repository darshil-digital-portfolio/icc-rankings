# Deployment Runbook

## Prerequisites Checklist

- [ ] AWS CLI configured (`aws sts get-caller-identity` works)
- [ ] Terraform installed (`terraform --version`)
- [ ] Docker installed and running
- [ ] Neon project created, connection strings ready
- [ ] Vercel account linked to GitHub repo
- [ ] `infrastructure/terraform/terraform.tfvars` filled in

## Step 1: Create ECR Repositories (Terraform partial apply)

Lambda needs the Docker image to exist before the Lambda function can be created.
So we create ECR first, push images, then apply everything else.

```bash
cd infrastructure/terraform
terraform init
terraform apply -target=aws_ecr_repository.api -target=aws_ecr_repository.chatbot
# Confirm with "yes"

# Verify
terraform output api_ecr_url
terraform output chatbot_ecr_url
```

## Step 2: Build and Push Docker Images to ECR

```bash
cd /path/to/icc-rankings  # project root

# Authenticate Docker to ECR (run the command from terraform output)
$(cd infrastructure/terraform && terraform output -raw ecr_login_command)

# Get ECR URLs
API_ECR=$(cd infrastructure/terraform && terraform output -raw api_ecr_url)
CHATBOT_ECR=$(cd infrastructure/terraform && terraform output -raw chatbot_ecr_url)

# Build and push API image (builds from apps/api/ using docker/Dockerfile.api)
docker build -f docker/Dockerfile.api apps/api/ -t "${API_ECR}:latest"
docker push "${API_ECR}:latest"

# Build and push chatbot image (takes longer — Python packages)
docker build -f docker/Dockerfile.chatbot apps/chatbot/ -t "${CHATBOT_ECR}:latest"
docker push "${CHATBOT_ECR}:latest"
```

## Step 3: Migrate PostgreSQL to Neon

```bash
# Make sure local PostgreSQL is running
npm run docker:up

# Set env vars (use your Neon direct connection string — NOT pooled for migrations)
export LOCAL_DB_URL="postgresql://icc:icc_secret@localhost:54321/icc_ranking"
export NEON_DB_URL="postgresql://icc_owner:<pass>@ep-xxx.ap-south-1.aws.neon.tech/icc_ranking?sslmode=require"

bash infrastructure/scripts/migrate-postgres-to-neon.sh
# Should show row counts at the end — verify they match local counts
```

## Step 4: Migrate MongoDB to DynamoDB

Run AFTER Step 5 (DynamoDB tables must exist first).

```bash
# Local MongoDB must be running
pip install pymongo boto3

export MONGO_URL="mongodb://localhost:47017"
export CONVERSATIONS_TABLE="icc-rankings-conversations"
export USERS_TABLE="icc-rankings-users"

python infrastructure/scripts/migrate-mongo-to-dynamodb.py
```

## Step 5: Deploy Everything with Terraform

```bash
cd infrastructure/terraform
terraform apply
# Confirm with "yes" — creates Lambda functions, DynamoDB, IAM roles, etc.

# Note the outputs — you'll need these for Vercel
terraform output
```

## Step 6: Configure Vercel

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add (using values from `terraform output`):
   - `NEXT_PUBLIC_API_URL` = `api_lambda_url` value
   - `NEXT_PUBLIC_CHATBOT_URL` = `chatbot_lambda_url` value
   - `INTERNAL_CHATBOT_URL` = `chatbot_lambda_url` value
   - `NEXTAUTH_URL` = `https://icc-rankings.darshil-ai.com`
   - `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SERVICE_API_TOKEN`
3. Go to **Settings → Domains** → Add `icc-rankings.darshil-ai.com`
4. Add the CNAME record Vercel shows you at your domain registrar
5. Trigger a build: push a commit to `develop` or click **Redeploy**

## Step 7: Test Everything

```bash
# Get Lambda URLs from Terraform
API_URL=$(cd infrastructure/terraform && terraform output -raw api_lambda_url)
CHAT_URL=$(cd infrastructure/terraform && terraform output -raw chatbot_lambda_url)

# Test API (first call may take 1-2s due to Neon wake-up)
curl "${API_URL}/health"
curl "${API_URL}/api/v1/rankings" | head -100

# Test chatbot health
curl "${CHAT_URL}/health"

# Test web app (use Vercel preview URL if custom domain not propagated yet)
# Find preview URL in Vercel dashboard
```

## Updating After Code Changes

**API or chatbot update:**
```bash
# Rebuild and push new image
docker build -f docker/Dockerfile.api apps/api/ -t "${API_ECR}:latest"
docker push "${API_ECR}:latest"

# Update Lambda to use the new image
aws lambda update-function-code \
  --function-name icc-rankings-api \
  --image-uri "${API_ECR}:latest" \
  --region ap-south-1
```

**Next.js update:**
```bash
git push origin develop  # Vercel auto-builds on push
```
