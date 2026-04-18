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

# Authenticate Docker to public ECR (required for Lambda Web Adapter base image)
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

# Authenticate Docker to your private ECR (use eval — $() does not interpret pipes)
eval "$(cd infrastructure/terraform && terraform output -raw ecr_login_command)"

# Get ECR URLs
API_ECR=$(cd infrastructure/terraform && terraform output -raw api_ecr_url)
CHATBOT_ECR=$(cd infrastructure/terraform && terraform output -raw chatbot_ecr_url)

# Build and push API image
# --platform linux/amd64  : Lambda requires amd64 images
# --provenance=false       : prevents BuildKit wrapping the image in an OCI manifest index,
#                            which Lambda rejects (it only accepts Docker Manifest V2 Schema 2)
docker build --platform linux/amd64 --provenance=false \
  -f docker/Dockerfile.api apps/api/ -t "${API_ECR}:latest"
docker push "${API_ECR}:latest"

# Build and push chatbot image (takes longer — Python packages)
docker build --platform linux/amd64 --provenance=false \
  -f docker/Dockerfile.chatbot apps/chatbot/ -t "${CHATBOT_ECR}:latest"
docker push "${CHATBOT_ECR}:latest"
```

## Step 3: Migrate PostgreSQL to Neon

```bash
# Set env vars (use Neon's direct connection string — NOT the pooled one)
# LOCAL_DB_URL defaults to postgresql://icc:icc_secret@localhost:5432/icc_ranking
# Make sure LOCAL_DB_URL is NOT set in your shell (unset LOCAL_DB_URL) unless overriding
export NEON_DB_URL="postgresql://neondb_owner:<pass>@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

bash infrastructure/scripts/migrate-postgres-to-neon.sh
# The script pauses and asks you to run the API against Neon to apply sqlx migrations.
# Once the API logs "Listening on 0.0.0.0:7429", Ctrl+C it and press ENTER.
# Row counts are shown at the end — verify they match local counts.
# Note: data is owned by neondb_owner on Neon (not a custom icc user).
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

## Step 5a: Add Lambda Public Access Permissions (Console — required)

Terraform creates the Function URLs but this account requires **two** resource-based
policy statements before public requests are accepted. The second one can only be
added via the console (AWS CLI does not support the `lambda:InvokedViaFunctionUrl`
condition key via `add-permission`).

For **both** `icc-rankings-api` and `icc-rankings-chatbot`:

1. AWS Console → Lambda → select function → **Configuration → Permissions**
2. Click **Add permissions** and add these two statements:

**Statement 1** (CLI can do this automatically via Terraform — verify it exists):
- Statement ID: `FunctionURLAllowPublicAccess`
- Principal: `*`
- Action: `lambda:InvokeFunctionUrl`
- Condition key: `lambda:FunctionUrlAuthType` = `NONE`

**Statement 2** (must be added manually via console):
- Statement ID: `FunctionURLAllowInvokeAction`
- Principal: `*`
- Action: `lambda:InvokeFunction`
- Condition key: `lambda:InvokedViaFunctionUrl` = `true`

Without Statement 2, every request returns `403 Forbidden` regardless of auth settings.

## Step 5b: Fix Neon Schema Permissions

The API runs `sqlx` migrations on startup. On a fresh Neon project the `neondb_owner`
role may lack `CREATE` on the public schema. Run once in **Neon Console → SQL Editor**:

```sql
GRANT ALL ON SCHEMA public TO neondb_owner;
```

Also verify your `terraform.tfvars` has the **owner** URL (not readonly) for `neon_database_url`:

```
neon_database_url = "postgresql://neondb_owner:<pass>@<host>-pooler.neon.tech/neondb?sslmode=require"
```

Using the `icc_readonly` URL here causes migration failures at Lambda startup.

## Step 6: Configure Vercel

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add the following variables:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_API_URL` | `cd infrastructure/terraform && terraform output -raw api_lambda_url` |
| `NEXT_PUBLIC_CHATBOT_URL` | `cd infrastructure/terraform && terraform output -raw chatbot_lambda_url` |
| `INTERNAL_CHATBOT_URL` | same as `NEXT_PUBLIC_CHATBOT_URL` (no internal network on Vercel) |
| `NEXTAUTH_URL` | your Vercel domain, e.g. `https://icc-rankings.darshil-ai.com` |
| `NEXTAUTH_SECRET` | run `openssl rand -hex 32` (or reuse from `apps/web/.env.local`) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → your OAuth app → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → your OAuth app → Credentials |
| `SERVICE_API_TOKEN` | `service_api_token` value in `infrastructure/terraform/terraform.tfvars` |

   > `SERVICE_API_TOKEN` is a shared secret between Next.js and the chatbot Lambda. The Lambda already has it set (from `terraform.tfvars`); Vercel must have the **same value**.

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

# Test chatbot health — note: use ${CHAT_URL%/} to strip trailing slash
# CHAT_URL from terraform output ends with /, so curl "${CHAT_URL}/health" becomes //health (404)
curl "${CHAT_URL%/}/health"

# Test web app (use Vercel preview URL if custom domain not propagated yet)
# Find preview URL in Vercel dashboard
```

> **New account Lambda concurrency limit:** Fresh AWS accounts start with a
> concurrent execution limit of 10 (vs the default 1000). This causes
> `ConcurrentInvocationLimitExceeded` on the Rankings page which makes ~30
> parallel API calls. The limit auto-increases to 1000 within 24–48 hours.
> In the meantime the batched fetch in `apps/web/src/app/rankings/page.tsx`
> (batches of 5) prevents throttling.

> **Google OAuth redirect URI:** Add `https://<your-domain>/api/auth/callback/google`
> to **Authorized redirect URIs** in Google Cloud Console → APIs & Services →
> Credentials → your OAuth client. Also add `https://<your-domain>` to
> Authorized JavaScript origins.

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
