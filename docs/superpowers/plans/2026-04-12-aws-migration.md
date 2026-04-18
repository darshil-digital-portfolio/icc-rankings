# AWS Migration for ICC Rankings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy ICC Rankings to AWS + Vercel at ~$0/month using Lambda, DynamoDB, ECR, and Neon (serverless PostgreSQL), while demonstrating real AWS infrastructure skills.

**Architecture:**
- Next.js 14 SSR → **Vercel** (hobby plan, free, native Next.js support, monorepo-aware)
- Rust API → **AWS Lambda** container + Lambda Function URL (Rust cold start ~50ms; always-free tier)
- Python chatbot → **AWS Lambda** container + Lambda Function URL (1GB RAM; always-free tier)
- PostgreSQL → **Neon** (serverless PostgreSQL, free tier, 100% compatible with existing migrations)
- MongoDB → **AWS DynamoDB** on-demand (always-free tier, replaces MongoDB)
- Lambda warmed up by a silent `/health` ping fired from `WelcomeBanner` on every sign-in
- **No VPC, no EC2, no RDS, no NAT Gateway** — not needed for Lambda + DynamoDB + Neon

**AWS skills showcased:** Lambda container images, ECR, DynamoDB, IAM least-privilege roles, Lambda Function URLs, CloudWatch Logs — a modern serverless stack.

**Tech Stack:** Terraform ≥1.5, AWS provider ~5.0, Lambda Web Adapter 1.0.0 (aws-lambda-adapter), aioboto3, Neon (PostgreSQL), Vercel

---

## Cost Summary

| Service | Free tier type | Monthly cost |
|---|---|---|
| Vercel (Next.js) | Hobby plan — always free | $0 |
| Lambda (API) | 1M req + 400K GB-sec — **always free** | $0 |
| Lambda (chatbot) | Same always-free pool | $0 |
| ECR (Docker images) | 50GB/account — **always free** | $0 |
| DynamoDB | 25GB + 25WCU/RCU — **always free** | $0 |
| Neon (PostgreSQL) | 0.5GB storage — **genuinely free** | $0 |
| IAM, CloudWatch logs | Always free | $0 |
| **Total** | | **$0/mo** |

> **DNS:** Route 53 skipped — DNS is managed at the domain registrar. Vercel provides a CNAME value when you add the custom domain; add it directly at your registrar. Lambda Function URLs are called via Vercel env vars, no DNS record needed.

> **Reality check for hobby usage:** 300 chatbot req/month × 10s × 1GB = 3,000 GB-seconds vs 400,000 free → $0. 3,000 API requests × 0.1s × 0.25GB = 75 GB-seconds → $0. This is not a "first N are free" trap — these limits genuinely cover hobby-scale usage with room to spare.

> **If it goes viral:** Lambda scales automatically; you'd only start paying beyond ~40,000 chatbot requests/month. At that point you'd want a different architecture anyway.

---

## Lambda Warm-Up Strategy

Lambda goes cold after ~5–15 minutes of inactivity. For this project:
- **On sign-in:** `WelcomeBanner` fires a background `fetch` to `GET /health` on the chatbot Lambda. User spends 5–10 seconds on the home page → chatbot is warm by the time they open the tab.
- **During active session:** Each chatbot message resets the warm window. Cold starts only happen after the user is idle for 15+ minutes.
- **No EventBridge heartbeat:** Letting it go cold when no user is active is the right call. It's a hobby project.

---

## File Structure

**New files:**
```
infrastructure/
  terraform/
    main.tf                        # Provider config
    variables.tf                   # Input variables
    outputs.tf                     # Outputs (Lambda URLs, ECR URLs)
    ecr.tf                         # ECR repos for API and chatbot images
    iam.tf                         # IAM roles for Lambda functions
    lambda.tf                      # Lambda functions + Function URLs
    dynamodb.tf                    # conversations + users tables
    # route53.tf                   # Skipped — DNS managed at domain registrar
    terraform.tfvars.example       # Example var file (no secrets)
  scripts/
    migrate-postgres-to-neon.sh    # pg_dump local → pg_restore to Neon
    migrate-mongo-to-dynamodb.py   # MongoDB export → DynamoDB import

docs/aws/
  00-account-setup.md             # AWS account + billing + IAM setup
  01-neon-setup.md                # Neon PostgreSQL setup (new!)
  02-terraform-quickstart.md      # Terraform install + first run
  03-vercel-setup.md              # Vercel + monorepo config (new!)
  04-architecture.md              # Architecture overview + rationale
  05-cost-breakdown.md            # Detailed cost analysis
  06-deployment-runbook.md        # End-to-end deployment steps
```

**Modified files:**
```
docker/Dockerfile.api                          # Add Lambda Web Adapter layer
docker/Dockerfile.chatbot                      # Add Lambda Web Adapter layer
apps/chatbot/app/db/dynamo.py                  # NEW: DynamoDB adapter (replaces mongo.py)
apps/chatbot/app/db/users_dynamo.py            # NEW: DynamoDB users adapter
apps/chatbot/app/config.py                     # Add DynamoDB + Neon config
apps/chatbot/app/main.py                       # Swap to DynamoDB in production
apps/chatbot/requirements.txt                  # Add aioboto3
apps/web/src/components/home/welcome-banner.tsx # Add chatbot warm-up ping
```

---

## Phase 0 — Setup Guides

### Task 1: AWS Account Setup Guide

**Files:**
- Create: `docs/aws/00-account-setup.md`

- [ ] **Step 1: Write the guide**

```markdown
# AWS Account Setup Guide

## 1. Sign In to Your Existing AWS Account

Go to https://console.aws.amazon.com and sign in.
You already have an account. The 12-month free tier has expired, but the services
we use (Lambda, DynamoDB, ECR) have **always-free** tiers with no expiry.

## 2. Enable MFA on Root Account (if not done)

Console → top-right account menu → **Security credentials**
→ Multi-factor authentication → **Assign MFA device** → Authenticator app.

## 3. Set Up Billing Alerts (do this first — prevents surprise bills)

1. Console → search **Billing** → **Billing and Cost Management**
2. Left sidebar → **Budgets** → **Create budget**
3. **Monthly cost budget** → Amount: **$5**
4. Alert at 80% → your email address
5. Also enable: **Billing preferences** → **Receive Free Tier Usage Alerts**

## 4. Create an IAM User for Terraform (programmatic access)

1. IAM → **Users** → **Create user**
2. Username: `terraform-deployer`
3. Do NOT enable console access
4. Permissions: attach **AdministratorAccess** (simplest for initial setup)
5. After creation → **Security credentials** tab → **Create access key**
6. Choose **Command Line Interface (CLI)** → download the CSV

## 5. Configure AWS CLI

```bash
# Install AWS CLI (Linux)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure with terraform-deployer credentials
aws configure
# AWS Access Key ID:     <from CSV>
# AWS Secret Access Key: <from CSV>
# Default region:        us-east-1
# Output format:         json

# Verify
aws sts get-caller-identity
# Should show your account ID and "terraform-deployer"
```
```

- [ ] **Step 2: Commit**
```bash
git add docs/aws/00-account-setup.md
git commit -m "docs(aws): add account setup guide"
```

---

### Task 2: Neon PostgreSQL Setup Guide

**Files:**
- Create: `docs/aws/01-neon-setup.md`

- [ ] **Step 1: Write the guide**

```markdown
# Neon PostgreSQL Setup Guide

## What is Neon?

Neon is serverless PostgreSQL. It's the same database engine as PostgreSQL —
every query, data type, extension, and migration you wrote for local PostgreSQL
works identically on Neon. The difference: Neon pauses the compute after
5 minutes of inactivity (the database itself stays intact), then wakes up in
~1–2 seconds on the next connection. No server to manage. No monthly minimum.

## Is it actually free?

Yes, for this project. Free tier includes:
- **0.5 GB storage** (the full ICC dataset 1973–2025 is ~5–10 MB)
- **191.9 compute hours/month** (auto-suspend means you use maybe 5 min/month for hobby)
- **No credit card required**
- 1 project, 3 branches (use branches for dev/prod separation)

## Setup Steps

### 1. Create Account

Go to https://neon.tech → **Sign Up** (use GitHub or Google — no credit card needed).

### 2. Create a Project

- Click **New Project**
- Name: `icc-rankings`
- PostgreSQL version: **16**
- Region: **US East (us-east-1)** ← matches your AWS region
- Click **Create Project**

### 3. Get Your Connection Strings

After creation, Neon shows your connection details. You need two:

**Direct connection** (for migrations and the Rust API):
```
postgresql://icc_owner:<password>@<host>.neon.tech/icc_ranking?sslmode=require
```

**Pooled connection** (for Lambda — avoids connection exhaustion):
```
postgresql://icc_owner:<password>@<host>-pooler.neon.tech/icc_ranking?sslmode=require
```

> Lambda creates many short-lived connections. Always use the pooled URL for
> Lambda functions. The Neon pooler handles connection reuse automatically.

Save both strings — you'll add them to `terraform.tfvars`.

### 4. Create the Database and Read-Only User

In the Neon Console → **SQL Editor**, run:

```sql
-- Create the main database (Neon creates one by default named after the project)
-- If it's not called icc_ranking, rename it:
-- ALTER DATABASE neondb RENAME TO icc_ranking;

-- Create read-only role for the chatbot (mirrors docker/init-readonly-user.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'icc_readonly') THEN
    CREATE ROLE icc_readonly LOGIN PASSWORD 'icc_readonly_secret';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE icc_ranking TO icc_readonly;
GRANT USAGE ON SCHEMA public TO icc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO icc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO icc_readonly;
```

### 5. Neon Branches (Optional but Recommended)

Neon lets you create database branches — like git branches for your data.
- `main` branch → production
- Create a `dev` branch for local development (uses same schema, independent data)

Console → **Branches** → **New Branch** → name: `dev`
Get the `dev` branch connection string for your local `.env` files.

### 6. Connection String for the Read-Only User

Build the read-only pooled URL manually:
```
postgresql://icc_readonly:icc_readonly_secret@<host>-pooler.neon.tech/icc_ranking?sslmode=require
```
This goes into `DYNAMO_READONLY_DATABASE_URL` in Terraform vars (used by the chatbot).

### 7. Why sslmode=require?

Neon requires SSL on all connections. The `?sslmode=require` parameter is already
supported by both `sqlx` (Rust) and `psycopg` (Python). No code changes needed —
just include it in the connection string.

## What Happens When Neon Suspends?

After 5 minutes of no queries, Neon pauses compute. The data is safe (persisted to
S3-backed storage). The next connection wakes it up in ~1–2 seconds. For the Rust API,
this means the very first API call after a long idle might be 1–2 seconds slower.
For a hobby project, this is acceptable.
```

- [ ] **Step 2: Commit**
```bash
git add docs/aws/01-neon-setup.md
git commit -m "docs(aws): add Neon PostgreSQL setup guide"
```

---

### Task 3: Terraform Quickstart + Vercel Setup Guides

**Files:**
- Create: `docs/aws/02-terraform-quickstart.md`
- Create: `docs/aws/03-vercel-setup.md`

- [ ] **Step 1: Write terraform-quickstart.md**

```markdown
# Terraform Quickstart

## What is Terraform?

Terraform is Infrastructure as Code — you write `.tf` files describing AWS resources
and Terraform creates/updates/destroys them. Think of it as a recipe for your cloud.

- **Provider**: Plugin for a cloud (we use `hashicorp/aws`)
- **Resource**: A thing to create (e.g. `aws_lambda_function`, `aws_dynamodb_table`)
- **State**: Terraform records what it created in `terraform.tfstate` — treat this like a database
- **Plan**: `terraform plan` previews changes (safe, no charges)
- **Apply**: `terraform apply` makes actual changes

## Install

```bash
# Via tfenv (manages multiple versions)
git clone --depth=1 https://github.com/tfutils/tfenv.git ~/.tfenv
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
tfenv install 1.9.0 && tfenv use 1.9.0
terraform --version  # 1.9.0
```

## First Run

```bash
cd infrastructure/terraform

cp terraform.tfvars.example terraform.tfvars
# Fill in your secrets (never commit terraform.tfvars!)

terraform init      # Downloads AWS provider
terraform plan      # Preview — safe, no charges
terraform apply     # Creates resources — will prompt for confirmation
terraform output    # Shows Lambda URLs and other values
```

## Important Files

- `terraform.tfvars` — your secrets — **never commit this**
- `terraform.tfstate` — Terraform's memory — **never delete, never commit**
- Both are in `.gitignore` already

## Common Commands

```bash
terraform plan             # Preview changes
terraform apply            # Apply changes
terraform output           # Show output values (Lambda URLs etc.)
terraform destroy          # Destroy everything (careful!)
terraform fmt              # Format .tf files
terraform state list       # List all managed resources
```
```

- [ ] **Step 2: Write vercel-setup.md**

```markdown
# Vercel Setup Guide

## Monorepo + Vercel

Vercel handles monorepos natively. You tell it which subdirectory contains the
Next.js app and it ignores everything else (Rust, Python, Docker files).

## Setup Steps

### 1. Create Account

Go to https://vercel.com → **Sign Up with GitHub** (free Hobby plan).

### 2. Import the Repository

1. Dashboard → **Add New → Project**
2. Import your `icc-rankings` GitHub repository
3. Vercel auto-detects Next.js

### 3. Configure Root Directory (critical for monorepo)

In the project configuration:
- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js (auto-detected)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)

### 4. Set Environment Variables

In Vercel project → **Settings → Environment Variables**, add:

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `<API Lambda Function URL>` | Production |
| `NEXT_PUBLIC_CHATBOT_URL` | `<Chatbot Lambda Function URL>` | Production |
| `INTERNAL_CHATBOT_URL` | `<Chatbot Lambda Function URL>` | Production |
| `NEXTAUTH_URL` | `https://icc-rankings.darshil-ai.com` | Production |
| `NEXTAUTH_SECRET` | `<openssl rand -base64 32>` | Production |
| `GOOGLE_CLIENT_ID` | `<from Google Cloud Console>` | Production |
| `GOOGLE_CLIENT_SECRET` | `<from Google Cloud Console>` | Production |
| `SERVICE_API_TOKEN` | `<openssl rand -hex 32>` | Production |

> You get the Lambda Function URLs after running `terraform output`.
> Add them to Vercel after the Terraform apply step.

### 5. Custom Domain

Vercel → Project → **Settings → Domains** → Add `icc-rankings.darshil-ai.com`
Vercel shows you a CNAME record to add at your domain registrar.
SSL is automatic (Let's Encrypt, managed by Vercel).

### 6. Auto-Deploy

Every push to `develop` branch triggers a Vercel build automatically.
No manual steps needed after initial setup.

### 7. Local Development (unchanged)

Nothing changes for local dev — you still run `npm run dev:web` from the project root.
Vercel only builds when you push to GitHub.
```

- [ ] **Step 3: Commit**
```bash
git add docs/aws/02-terraform-quickstart.md docs/aws/03-vercel-setup.md
git commit -m "docs(aws): add terraform quickstart and vercel setup guides"
```

---

## Phase 1 — Terraform Infrastructure

### Task 4: Terraform Project Skeleton

**Files:**
- Create: `infrastructure/terraform/main.tf`
- Create: `infrastructure/terraform/variables.tf`
- Create: `infrastructure/terraform/outputs.tf`
- Create: `infrastructure/terraform/terraform.tfvars.example`
- Update: `.gitignore`

- [ ] **Step 1: Create directories**
```bash
mkdir -p infrastructure/terraform infrastructure/scripts
```

- [ ] **Step 2: Write main.tf**

```hcl
# infrastructure/terraform/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # State is stored locally. Never commit terraform.tfstate.
  # For a team setup, migrate to S3 backend — see terraform-quickstart.md.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "icc-rankings"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
```

- [ ] **Step 3: Write variables.tf**

```hcl
# infrastructure/terraform/variables.tf

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "icc-rankings"
}

variable "domain_name" {
  description = "Root domain (e.g. darshil-ai.com) — used for CORS allowed origins"
  type        = string
  default     = "darshil-ai.com"
}

variable "neon_database_url" {
  description = "Neon PostgreSQL pooled connection URL (for Rust API Lambda)"
  type        = string
  sensitive   = true
  # Format: postgresql://icc_owner:<pass>@<host>-pooler.neon.tech/icc_ranking?sslmode=require
}

variable "neon_readonly_database_url" {
  description = "Neon PostgreSQL pooled connection URL for read-only user (for chatbot Lambda)"
  type        = string
  sensitive   = true
  # Format: postgresql://icc_readonly:icc_readonly_secret@<host>-pooler.neon.tech/icc_ranking?sslmode=require
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Twelfth Man chatbot"
  type        = string
  sensitive   = true
}

variable "service_api_token" {
  description = "Internal PSK between Next.js and chatbot (run: openssl rand -hex 32)"
  type        = string
  sensitive   = true
}
```

- [ ] **Step 4: Write outputs.tf**

```hcl
# infrastructure/terraform/outputs.tf

output "api_lambda_url" {
  description = "Rust API Lambda Function URL — set as NEXT_PUBLIC_API_URL in Vercel"
  value       = aws_lambda_function_url.api.function_url
}

output "chatbot_lambda_url" {
  description = "Chatbot Lambda Function URL — set as NEXT_PUBLIC_CHATBOT_URL and INTERNAL_CHATBOT_URL in Vercel"
  value       = aws_lambda_function_url.chatbot.function_url
}

output "api_ecr_url" {
  description = "ECR repository URL for the Rust API image"
  value       = aws_ecr_repository.api.repository_url
}

output "chatbot_ecr_url" {
  description = "ECR repository URL for the chatbot image"
  value       = aws_ecr_repository.chatbot.repository_url
}

output "conversations_table_name" {
  description = "DynamoDB conversations table name"
  value       = aws_dynamodb_table.conversations.name
}

output "users_table_name" {
  description = "DynamoDB users table name"
  value       = aws_dynamodb_table.users.name
}

output "aws_account_id" {
  description = "Your AWS account ID (needed for ECR login command)"
  value       = data.aws_caller_identity.current.account_id
}

output "ecr_login_command" {
  description = "Run this to authenticate Docker to ECR before pushing images"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}
```

- [ ] **Step 5: Write terraform.tfvars.example**

```hcl
# infrastructure/terraform/terraform.tfvars.example
# Copy to terraform.tfvars and fill in. NEVER commit terraform.tfvars.

aws_region   = "us-east-1"
project_name = "icc-rankings"
domain_name  = "darshil-ai.com"

# From Neon Console → your project → Connection Details
# Use the POOLED connection string for Lambda
neon_database_url          = "postgresql://icc_owner:CHANGE_ME@ep-xxx-pooler.us-east-1.aws.neon.tech/icc_ranking?sslmode=require"
neon_readonly_database_url = "postgresql://icc_readonly:icc_readonly_secret@ep-xxx-pooler.us-east-1.aws.neon.tech/icc_ranking?sslmode=require"

# From console.anthropic.com → API Keys
anthropic_api_key = "sk-ant-CHANGE_ME"

# Generate: openssl rand -hex 32
service_api_token = "CHANGE_ME"
```

- [ ] **Step 6: Update .gitignore** (add to project root `.gitignore`):

```
# Terraform
infrastructure/terraform/terraform.tfvars
infrastructure/terraform/terraform.tfstate
infrastructure/terraform/terraform.tfstate.backup
infrastructure/terraform/.terraform/
infrastructure/terraform/.terraform.lock.hcl
```

- [ ] **Step 7: Commit**
```bash
git add infrastructure/ docs/
git commit -m "chore(terraform): scaffold terraform project skeleton"
```

---

### Task 5: ECR Repositories

**Files:**
- Create: `infrastructure/terraform/ecr.tf`

- [ ] **Step 1: Write ecr.tf**

```hcl
# infrastructure/terraform/ecr.tf

resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}/icc-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true  # Allows destroy even if images exist

  image_scanning_configuration {
    scan_on_push = true  # Free security scan on every push
  }

  tags = { Name = "${var.project_name}-api-repo" }
}

resource "aws_ecr_repository" "chatbot" {
  name                 = "${var.project_name}/icc-chatbot"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project_name}-chatbot-repo" }
}

# Keep only last 3 images to stay well within the 50GB always-free limit
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "chatbot" {
  repository = aws_ecr_repository.chatbot.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}
```

- [ ] **Step 2: Commit**
```bash
git add infrastructure/terraform/ecr.tf
git commit -m "feat(terraform): add ECR repositories for API and chatbot images"
```

---

### Task 6: IAM Roles for Lambda

**Files:**
- Create: `infrastructure/terraform/iam.tf`

- [ ] **Step 1: Write iam.tf**

```hcl
# infrastructure/terraform/iam.tf

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── API Lambda Role ────────────────────────────────────────────────────────────
# The Rust API only needs to write logs. No DynamoDB access (API reads PostgreSQL via Neon).

resource "aws_iam_role" "lambda_api" {
  name               = "${var.project_name}-lambda-api-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_api_logs" {
  role       = aws_iam_role.lambda_api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ── Chatbot Lambda Role ────────────────────────────────────────────────────────
# The chatbot needs: logs + DynamoDB (conversations + users tables).

resource "aws_iam_role" "lambda_chatbot" {
  name               = "${var.project_name}-lambda-chatbot-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_chatbot_logs" {
  role       = aws_iam_role.lambda_chatbot.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_chatbot_dynamodb" {
  name = "${var.project_name}-chatbot-dynamodb"
  role = aws_iam_role.lambda_chatbot.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "DynamoDBTableAccess"
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
      ]
      Resource = [
        aws_dynamodb_table.conversations.arn,
        "${aws_dynamodb_table.conversations.arn}/index/*",
        aws_dynamodb_table.users.arn,
      ]
    }]
  })
}
```

- [ ] **Step 2: Commit**
```bash
git add infrastructure/terraform/iam.tf
git commit -m "feat(terraform): add IAM roles for API and chatbot Lambda functions"
```

---

### Task 7: Lambda Functions + Function URLs

**Files:**
- Create: `infrastructure/terraform/lambda.tf`

> **Ordering note:** Lambda container functions require the Docker image to exist in ECR before `terraform apply` can create them. The deployment runbook (Task 19) handles this with a two-step apply. In the Terraform config, `lifecycle { ignore_changes = [image_uri] }` ensures future image pushes (from CI/CD) don't get reverted by Terraform.

- [ ] **Step 1: Write lambda.tf**

```hcl
# infrastructure/terraform/lambda.tf

# ── Rust API Lambda ────────────────────────────────────────────────────────────

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  role          = aws_iam_role.lambda_api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:latest"

  memory_size = 256   # MB — Rust is very lean
  timeout     = 30    # seconds — API requests should be fast

  environment {
    variables = {
      DATABASE_URL    = var.neon_database_url
      API_HOST        = "0.0.0.0"
      API_PORT        = "7429"
      RUST_LOG        = "info"
      SEED_ON_STARTUP = "false"  # Data already in Neon after migration
      PORT            = "7429"   # Lambda Web Adapter reads this
    }
  }

  lifecycle {
    # Image URI is managed by CI/CD (docker push + lambda update-function-code)
    # Terraform only sets the initial image; subsequent deploys bypass Terraform
    ignore_changes = [image_uri]
  }

  tags = { Name = "${var.project_name}-api" }
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"  # Public API — anyone can call it

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization"]
    max_age           = 86400
  }
}

# ── Python Chatbot Lambda ──────────────────────────────────────────────────────

resource "aws_lambda_function" "chatbot" {
  function_name = "${var.project_name}-chatbot"
  role          = aws_iam_role.lambda_chatbot.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.chatbot.repository_url}:latest"

  memory_size = 1024  # MB — Python + LangGraph + pandas needs headroom
  timeout     = 300   # 5 minutes — LangGraph multi-agent calls can take time

  environment {
    variables = {
      DATABASE_URL               = var.neon_readonly_database_url
      DYNAMO_CONVERSATIONS_TABLE = aws_dynamodb_table.conversations.name
      DYNAMO_USERS_TABLE         = aws_dynamodb_table.users.name
      AWS_DEFAULT_REGION         = var.aws_region
      ANTHROPIC_API_KEY          = var.anthropic_api_key
      SERVICE_API_TOKEN          = var.service_api_token
      APP_ENV                    = "production"
      HOST                       = "0.0.0.0"
      PORT                       = "8100"  # Lambda Web Adapter reads this
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = { Name = "${var.project_name}-chatbot" }
}

resource "aws_lambda_function_url" "chatbot" {
  function_name      = aws_lambda_function.chatbot.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins = [
      "https://icc-rankings.${var.domain_name}",
      "https://*.vercel.app",  # Vercel preview deploy URLs
    ]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Service-Token"]
    max_age       = 86400
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add infrastructure/terraform/lambda.tf
git commit -m "feat(terraform): add Lambda functions and Function URLs for API and chatbot"
```

---

### Task 8: DynamoDB Tables

**Files:**
- Create: `infrastructure/terraform/dynamodb.tf`

- [ ] **Step 1: Write dynamodb.tf**

```hcl
# infrastructure/terraform/dynamodb.tf

# ── Conversations table ────────────────────────────────────────────────────────
# Replaces MongoDB `conversations` collection.
# PK: session_id (UUID, unique per conversation)
# GSI: user_id → updated_at (list a user's sessions newest first)
# TTL: DynamoDB auto-deletes items after 90 days (replaces manual cleanup job)

resource "aws_dynamodb_table" "conversations" {
  name         = "${var.project_name}-conversations"
  billing_mode = "PAY_PER_REQUEST"  # $0 for hobby; no capacity planning needed
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "updated_at"
    type = "S"  # ISO 8601 string — sorts lexicographically = chronologically
  }

  global_secondary_index {
    name            = "user_id-updated_at-index"
    hash_key        = "user_id"
    range_key       = "updated_at"
    projection_type = "INCLUDE"
    non_key_attributes = ["session_id", "messages", "created_at"]
  }

  ttl {
    attribute_name = "ttl"  # Unix timestamp; DynamoDB deletes expired items automatically
    enabled        = true
  }

  tags = { Name = "${var.project_name}-conversations" }
}

# ── Users table ────────────────────────────────────────────────────────────────
# Replaces MongoDB `users` collection.
# PK: google_sub (unique Google account identifier)

resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "google_sub"

  attribute {
    name = "google_sub"
    type = "S"
  }

  tags = { Name = "${var.project_name}-users" }
}
```

- [ ] **Step 2: Commit**
```bash
git add infrastructure/terraform/dynamodb.tf
git commit -m "feat(terraform): add DynamoDB conversations and users tables"
```

---

### ~~Task 9: Route 53~~ — SKIPPED

**Decision:** DNS is managed at the domain registrar instead. Route 53 costs $0.50/month with no free tier. Lambda Function URLs are configured directly in Vercel env vars; the web subdomain CNAME is set at the registrar using the value Vercel provides.

- [x] **Step 1: Write route53.tf** — skipped

```hcl
# infrastructure/terraform/route53.tf
# Cost: $0.50/month for the hosted zone.
# If you prefer free DNS: skip this file and add records at your domain registrar instead.

resource "aws_route53_zone" "main" {
  name = var.domain_name
  tags = { Name = "${var.project_name}-hosted-zone" }
}

# icc-rankings.darshil-ai.com → Vercel
# Vercel gives you a CNAME value when you add the domain in their dashboard.
# Replace the value below with what Vercel provides.
resource "aws_route53_record" "web" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "icc-rankings.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["cname.vercel-dns.com"]  # Replace with actual Vercel CNAME value
}

output "route53_nameservers" {
  description = "Update these at your domain registrar to activate Route 53 DNS"
  value       = aws_route53_zone.main.name_servers
}
```

> **If skipping Route 53:** Go to your domain registrar → DNS settings:
> - Add CNAME: `icc-rankings` → Vercel CNAME value (Vercel provides this)
> - Lambda Function URLs don't need DNS records — the web app calls them directly via env vars

- [ ] **Step 2: Commit**
```bash
git add infrastructure/terraform/route53.tf
git commit -m "feat(terraform): add optional Route 53 hosted zone"
```

---

## Phase 2 — Dockerfile Changes (Lambda Web Adapter)

Lambda Web Adapter is a thin layer from AWS that translates Lambda events into HTTP requests. It means your existing Axum and FastAPI apps run on Lambda with **zero application code changes** — just two lines added to the Dockerfile.

### Task 10: Update Dockerfile.api for Lambda

**Files:**
- Modify: `docker/Dockerfile.api`

- [ ] **Step 1: Read current file** (already read at plan creation — content confirmed above)

- [ ] **Step 2: Update Dockerfile.api**

```dockerfile
# docker/Dockerfile.api

# ── Builder stage (unchanged) ──────────────────────────────────────────────────
FROM rust:1.88-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

COPY src ./src
COPY migrations ./migrations
RUN touch src/main.rs && cargo build --release

# ── Lambda runtime stage ───────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# Lambda Web Adapter: translates Lambda invocation events → HTTP → your Axum app
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 \
     /lambda-adapter /opt/extensions/lambda-adapter

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/api ./api
COPY --from=builder /app/migrations ./migrations

EXPOSE 7429
ENV RUST_LOG=info
# PORT tells Lambda Web Adapter which port to forward to
ENV PORT=7429

CMD ["./api"]
```

- [ ] **Step 3: Verify the change builds**
```bash
cd /home/darshil/Desktop/data/projects/icc-rankings
docker build -f docker/Dockerfile.api apps/api/ -t icc-api-test
# Should complete without errors
docker rmi icc-api-test
```

- [ ] **Step 4: Commit**
```bash
git add docker/Dockerfile.api
git commit -m "feat(docker): add Lambda Web Adapter to Rust API image"
```

---

### Task 11: Update Dockerfile.chatbot for Lambda

**Files:**
- Modify: `docker/Dockerfile.chatbot`

- [ ] **Step 1: Update Dockerfile.chatbot**

```dockerfile
# docker/Dockerfile.chatbot

FROM python:3.12-slim

# Lambda Web Adapter: translates Lambda invocation events → HTTP → your FastAPI app
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 \
     /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app

# Install system dependencies for psycopg binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8100
# PORT tells Lambda Web Adapter which port to forward to
ENV PORT=8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
```

- [ ] **Step 2: Verify the change builds**
```bash
cd /home/darshil/Desktop/data/projects/icc-rankings
docker build -f docker/Dockerfile.chatbot apps/chatbot/ -t icc-chatbot-test
# Should complete — will take a few minutes (downloading Python packages)
docker rmi icc-chatbot-test
```

- [ ] **Step 3: Commit**
```bash
git add docker/Dockerfile.chatbot
git commit -m "feat(docker): add Lambda Web Adapter to Python chatbot image"
```

---

## Phase 3 — Application Code Changes

### Task 12: DynamoDB Adapter for Chatbot

**Files:**
- Create: `apps/chatbot/app/db/dynamo.py`
- Create: `apps/chatbot/app/db/users_dynamo.py`

These replace `mongo.py` and `users.py` in production. The function signatures are identical to the MongoDB versions so no callers change.

- [ ] **Step 1: Write dynamo.py**

```python
# apps/chatbot/app/db/dynamo.py
"""DynamoDB adapter — same public API as mongo.py.

Uses IAM role credentials automatically (no keys in env).
In local dev, falls back to ~/.aws/credentials.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any

import aioboto3

from app.config import settings

logger = logging.getLogger(__name__)

_session: aioboto3.Session | None = None


def _get_session() -> aioboto3.Session:
    global _session
    if _session is None:
        _session = aioboto3.Session()
    return _session


async def init_dynamo() -> None:
    _get_session()
    logger.info(
        "DynamoDB ready (conversations=%s, users=%s, region=%s)",
        settings.dynamo_conversations_table,
        settings.dynamo_users_table,
        settings.aws_region,
    )


async def close_dynamo() -> None:
    global _session
    _session = None
    logger.info("DynamoDB session closed")


def _ttl(days: int) -> int:
    """Unix timestamp N days from now — DynamoDB uses this for auto-expiry."""
    return int(time.time()) + days * 86_400


async def get_conversation(session_id: str) -> dict[str, Any] | None:
    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_conversations_table)
        resp = await table.get_item(Key={"session_id": session_id})
        return resp.get("Item")


async def append_message(
    session_id: str,
    role: str,
    text: str,
    chart: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    message: dict[str, Any] = {"role": role, "text": text, "timestamp": now}
    if chart is not None:
        message["chart"] = chart

    # Build the update expression
    update_expr = (
        "SET updated_at = :now, #ttl = :ttl, "
        "messages = list_append(if_not_exists(messages, :empty), :msg), "
        "created_at = if_not_exists(created_at, :now)"
    )
    expr_names: dict[str, str] = {"#ttl": "ttl"}
    expr_values: dict[str, Any] = {
        ":now": now,
        ":ttl": _ttl(settings.history_retention_days),
        ":empty": [],
        ":msg": [message],
    }

    # Set user_id only on insert (if_not_exists prevents overwriting)
    if user_id:
        update_expr += ", user_id = if_not_exists(user_id, :uid)"
        expr_values[":uid"] = user_id

    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_conversations_table)
        await table.update_item(
            Key={"session_id": session_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )


async def get_recent_messages(
    session_id: str, limit: int | None = None
) -> list[dict[str, Any]]:
    conv = await get_conversation(session_id)
    if not conv:
        return []
    messages = conv.get("messages", [])
    if limit:
        messages = messages[-limit:]
    return messages


async def cleanup_old_conversations() -> int:
    """No-op in production — DynamoDB TTL handles this automatically."""
    logger.info("Conversation cleanup handled by DynamoDB TTL")
    return 0


async def get_user_sessions(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Return up to `limit` sessions for a user, newest first."""
    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_conversations_table)
        resp = await table.query(
            IndexName="user_id-updated_at-index",
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id},
            ScanIndexForward=False,  # Descending — newest first
            Limit=limit,
        )
        return resp.get("Items", [])
```

- [ ] **Step 2: Write users_dynamo.py**

```python
# apps/chatbot/app/db/users_dynamo.py
"""DynamoDB adapter for users — replaces users.py in production."""

import logging
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from app.db.dynamo import _get_session
from app.config import settings

logger = logging.getLogger(__name__)


async def get_or_create_user(
    google_sub: str,
    email: str,
    name: str,
    picture: str,
) -> dict[str, Any]:
    """Upsert user by google_sub. Returns doc with synthetic `is_new_user` key."""
    now = datetime.now(timezone.utc).isoformat()

    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_users_table)

        # Attempt to insert as a new user (fails if already exists)
        try:
            await table.put_item(
                Item={
                    "google_sub": google_sub,
                    "email": email,
                    "name": name,
                    "picture": picture,
                    "preferences": {"theme": None, "event_filters": []},
                    "is_admin": False,
                    "created_at": now,
                    "updated_at": now,
                },
                ConditionExpression="attribute_not_exists(google_sub)",
            )
            resp = await table.get_item(Key={"google_sub": google_sub})
            doc = dict(resp["Item"])
            doc["is_new_user"] = True
            return doc

        except ClientError as e:
            if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise

        # Existing user — update mutable fields only
        resp = await table.update_item(
            Key={"google_sub": google_sub},
            UpdateExpression="SET email = :e, #n = :n, picture = :p, updated_at = :now",
            ExpressionAttributeNames={"#n": "name"},
            ExpressionAttributeValues={
                ":e": email, ":n": name, ":p": picture, ":now": now,
            },
            ReturnValues="ALL_NEW",
        )
        doc = dict(resp["Attributes"])
        doc["is_new_user"] = False
        return doc


async def get_user(google_sub: str) -> dict[str, Any] | None:
    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_users_table)
        resp = await table.get_item(Key={"google_sub": google_sub})
        return resp.get("Item")


async def update_preferences(
    google_sub: str,
    theme: str | None = None,
    event_filters: list[str] | None = None,
) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc).isoformat()
    set_parts = ["updated_at = :now"]
    expr_values: dict[str, Any] = {":now": now}
    expr_names: dict[str, str] = {}

    if theme is not None:
        set_parts.append("preferences.#theme = :theme")
        expr_names["#theme"] = "theme"
        expr_values[":theme"] = theme
    if event_filters is not None:
        set_parts.append("preferences.event_filters = :ef")
        expr_values[":ef"] = event_filters

    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_users_table)
        kwargs: dict[str, Any] = {
            "Key": {"google_sub": google_sub},
            "UpdateExpression": "SET " + ", ".join(set_parts),
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW",
        }
        if expr_names:
            kwargs["ExpressionAttributeNames"] = expr_names
        resp = await table.update_item(**kwargs)
        return resp.get("Attributes")
```

- [ ] **Step 3: Commit**
```bash
git add apps/chatbot/app/db/dynamo.py apps/chatbot/app/db/users_dynamo.py
git commit -m "feat(chatbot): add DynamoDB adapter replacing MongoDB for production"
```

---

### Task 13: Update Chatbot Config, main.py, and requirements

**Files:**
- Modify: `apps/chatbot/app/config.py`
- Modify: `apps/chatbot/app/main.py`
- Modify: `apps/chatbot/requirements.txt`

- [ ] **Step 1: Update config.py** — add DynamoDB settings, keep mongo for local dev

```python
# apps/chatbot/app/config.py
from pydantic import model_validator
from pydantic_settings import BaseSettings

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-20250514"


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""

    # PostgreSQL — Neon URL in production, local URL in dev
    database_url: str = (
        "postgresql://icc_readonly:icc_readonly_secret@localhost:5432/icc_ranking"
    )

    # MongoDB — local dev only; not used when app_env=production
    mongo_url: str = "mongodb://localhost:47017"
    mongo_db: str = "icc_ranking"

    # DynamoDB — production only; populated from Lambda env vars via Terraform
    dynamo_conversations_table: str = "icc-rankings-conversations"
    dynamo_users_table: str = "icc-rankings-users"
    aws_region: str = "us-east-1"

    # Server
    host: str = "0.0.0.0"
    port: int = 8100

    # Environment — controls which DB backend is used
    app_env: str = "development"  # "development" | "production"

    # LLM models
    router_model: str = ""
    sql_model: str = ""
    analytics_model: str = ""
    formatter_model: str = ""

    # Guardrails
    max_query_rows: int = 100
    query_timeout_seconds: int = 5

    # Service-to-service auth
    service_api_token: str = ""

    # Conversation
    context_window_messages: int = 10
    history_retention_days: int = 90

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def _apply_env_model_defaults(self) -> "Settings":
        is_prod = self.app_env == "production"
        if not self.router_model:
            self.router_model = HAIKU
        if not self.sql_model:
            self.sql_model = SONNET if is_prod else HAIKU
        if not self.analytics_model:
            self.analytics_model = SONNET if is_prod else HAIKU
        if not self.formatter_model:
            self.formatter_model = HAIKU
        return self


settings = Settings()
```

- [ ] **Step 2: Update main.py lifespan** — swap DB backend based on environment

In `apps/chatbot/app/main.py`, replace the `lifespan` function:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting Twelfth Man chatbot service [env=%s]...", settings.app_env)
    await init_pool()

    if settings.app_env == "production":
        from app.db.dynamo import init_dynamo, close_dynamo
        await init_dynamo()
        yield
        await close_dynamo()
    else:
        from app.db.mongo import init_mongo, close_mongo, cleanup_old_conversations
        await init_mongo()
        deleted = await cleanup_old_conversations()
        if deleted:
            logger.info("Cleaned up %d expired conversations", deleted)
        yield
        await close_mongo()

    await close_pool()
```

Also add a helper at the top of `main.py` (after imports) for route handlers that call DB functions directly:

```python
def _db():
    """Return the correct DB module based on APP_ENV."""
    if settings.app_env == "production":
        import app.db.dynamo as mod
    else:
        import app.db.mongo as mod
    return mod


def _users_db():
    """Return the correct users DB module based on APP_ENV."""
    if settings.app_env == "production":
        import app.db.users_dynamo as mod
    else:
        import app.db.users as mod
    return mod
```

Replace all direct calls to `append_message(...)`, `get_recent_messages(...)`, `get_user_sessions(...)` in `main.py` with `await _db().function_name(...)`. Replace calls to `get_or_create_user(...)`, `get_user(...)`, `update_preferences(...)` in the users router with `await _users_db().function_name(...)`.

- [ ] **Step 3: Update requirements.txt**

```
# apps/chatbot/requirements.txt
langgraph>=0.2.0
langchain-anthropic>=0.3.0
langchain-core>=0.3.0
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
psycopg[binary,pool]>=3.2.0
motor>=3.6.0
aioboto3>=13.0.0
pandas>=2.2.0
numpy>=2.0.0
sqlparse>=0.5.0
pydantic>=2.9.0
pydantic-settings>=2.6.0
python-dotenv>=1.0.0
```

- [ ] **Step 4: Install aioboto3 in local venv**
```bash
cd apps/chatbot
source env-chatbot/bin/activate
uv pip install "aioboto3>=13.0.0"
python -c "import aioboto3; print('aioboto3 OK')"
```

- [ ] **Step 5: Commit**
```bash
git add apps/chatbot/app/config.py apps/chatbot/app/main.py apps/chatbot/requirements.txt
git commit -m "feat(chatbot): wire DynamoDB for production, keep MongoDB for local dev"
```

---

### Task 14: Chatbot Warm-Up Ping on Sign-In

**Files:**
- Modify: `apps/web/src/components/home/welcome-banner.tsx`

The `WelcomeBanner` renders when `?welcome=1` is in the URL — exactly when a user has just signed in. This is the ideal place to fire the warm-up ping.

- [ ] **Step 1: Add warm-up effect to WelcomeBanner**

In `apps/web/src/components/home/welcome-banner.tsx`, add one `useEffect` inside the component:

```tsx
// Add after the existing useEffect that handles auto-dismiss:
useEffect(() => {
  if (!shouldShow) return;
  // Fire-and-forget ping to wake up the chatbot Lambda.
  // User will spend a few seconds on this page before navigating to /chat.
  const chatbotUrl = process.env.NEXT_PUBLIC_CHATBOT_URL ?? "http://localhost:8100";
  fetch(`${chatbotUrl}/health`, {
    method: "GET",
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    // Silently ignore — warm-up failure doesn't affect the user experience
  });
}, [shouldShow]);
```

The full modified file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function WelcomeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);

  const shouldShow = searchParams.get("welcome") === "1";

  // Show the banner and schedule auto-dismiss.
  useEffect(() => {
    if (!shouldShow) return;
    setVisible(true);
    const timer = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  // Warm up the chatbot Lambda on every sign-in.
  // By the time the user navigates to /chat, the cold start is done.
  useEffect(() => {
    if (!shouldShow) return;
    const chatbotUrl = process.env.NEXT_PUBLIC_CHATBOT_URL ?? "http://localhost:8100";
    fetch(`${chatbotUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(30_000),
    }).catch(() => {});
  }, [shouldShow]);

  function dismiss() {
    setVisible(false);
    router.replace("/", { scroll: false });
  }

  if (!shouldShow && !visible) return null;

  const isNewUser = session?.user?.is_new_user ?? false;
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div
      className={cn(
        "pointer-events-auto transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none",
      )}
    >
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div
          className={cn(
            "relative flex items-start gap-3 rounded-xl border px-5 py-4 shadow-lg",
            isNewUser
              ? "border-gold-400/60 bg-gold-50 dark:border-gold-500/30 dark:bg-gold-950/40"
              : "border-pitch-300/60 bg-pitch-50 dark:border-pitch-700/40 dark:bg-pitch-950/50",
          )}
        >
          <span className="mt-0.5 text-2xl leading-none select-none">🏏</span>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-bold text-base",
                isNewUser
                  ? "text-gold-800 dark:text-gold-300"
                  : "text-pitch-800 dark:text-pitch-300",
              )}
            >
              {isNewUser ? `Welcome to ICC Rankings, ${name}!` : `Welcome back, ${name}!`}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm",
                isNewUser
                  ? "text-gold-700 dark:text-gold-400"
                  : "text-pitch-600 dark:text-pitch-400",
              )}
            >
              {isNewUser
                ? "Explore team rankings, tournament history, and chat with Twelfth Man — our AI cricket assistant."
                : "Good to see you again. Your chat history is waiting in Twelfth Man."}
            </p>
          </div>

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className={cn(
              "shrink-0 rounded-md p-1 transition-colors",
              isNewUser
                ? "text-gold-600 hover:bg-gold-100 dark:text-gold-400 dark:hover:bg-gold-900/40"
                : "text-pitch-500 hover:bg-pitch-100 dark:text-pitch-400 dark:hover:bg-pitch-900/40",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/home/welcome-banner.tsx
git commit -m "feat(web): ping chatbot Lambda health on sign-in for warm-up"
```

---

## Phase 4 — Database Migration Scripts

### Task 15: PostgreSQL → Neon Migration Script

**Files:**
- Create: `infrastructure/scripts/migrate-postgres-to-neon.sh`

Neon is public-facing, so there's no need for an SSH tunnel or bastion host. You run this directly from your local machine.

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# infrastructure/scripts/migrate-postgres-to-neon.sh
#
# Dumps local PostgreSQL and restores to Neon.
# Run from your local machine after completing Neon setup (Task 2).
#
# Prerequisites:
#   - Local PostgreSQL running (npm run docker:up)
#   - pg_dump and psql installed locally
#   - Neon project created and connection strings ready
#
# Usage:
#   export LOCAL_DB_URL="postgresql://icc:icc_secret@localhost:54321/icc_ranking"
#   export NEON_DB_URL="postgresql://icc_owner:<pass>@<host>.neon.tech/icc_ranking?sslmode=require"
#   bash infrastructure/scripts/migrate-postgres-to-neon.sh

set -euo pipefail

LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://icc:icc_secret@localhost:54321/icc_ranking}"
NEON_DB_URL="${NEON_DB_URL:?Set NEON_DB_URL to your Neon direct connection string}"
DUMP_FILE="/tmp/icc_ranking_$(date +%Y%m%d_%H%M%S).dump"

echo "=== Step 1: Dump local PostgreSQL ==="
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  "${LOCAL_DB_URL}" \
  -f "${DUMP_FILE}"
echo "Dump saved: ${DUMP_FILE}"

echo "=== Step 2: Restore to Neon ==="
pg_restore \
  --dburl="${NEON_DB_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose \
  "${DUMP_FILE}"

echo "=== Step 3: Create read-only user on Neon ==="
psql "${NEON_DB_URL}" << 'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'icc_readonly') THEN
    CREATE ROLE icc_readonly LOGIN PASSWORD 'icc_readonly_secret';
  END IF;
END
$$;
GRANT CONNECT ON DATABASE icc_ranking TO icc_readonly;
GRANT USAGE ON SCHEMA public TO icc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO icc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO icc_readonly;
SQL

echo "=== Step 4: Verify row counts ==="
psql "${NEON_DB_URL}" -c "
SELECT 'teams' as tbl, count(*) FROM teams
UNION ALL SELECT 'events', count(*) FROM events
UNION ALL SELECT 'event_results', count(*) FROM event_results;
"

echo "=== Migration complete! Cleanup: rm ${DUMP_FILE} ==="
```

- [ ] **Step 2: Make executable and commit**
```bash
chmod +x infrastructure/scripts/migrate-postgres-to-neon.sh
git add infrastructure/scripts/migrate-postgres-to-neon.sh
git commit -m "chore(migration): add PostgreSQL to Neon migration script"
```

---

### Task 16: MongoDB → DynamoDB Migration Script

**Files:**
- Create: `infrastructure/scripts/migrate-mongo-to-dynamodb.py`

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""infrastructure/scripts/migrate-mongo-to-dynamodb.py

Exports conversations and users from local MongoDB → DynamoDB.
Run from your local machine with both MongoDB and AWS credentials available.

Usage:
    pip install pymongo boto3
    export MONGO_URL="mongodb://localhost:47017"
    export CONVERSATIONS_TABLE="icc-rankings-conversations"
    export USERS_TABLE="icc-rankings-users"
    export AWS_DEFAULT_REGION="us-east-1"
    python infrastructure/scripts/migrate-mongo-to-dynamodb.py
"""

import os
import time
from datetime import datetime, timezone

import boto3
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:47017")
MONGO_DB = os.environ.get("MONGO_DB", "icc_ranking")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
CONVERSATIONS_TABLE = os.environ.get("CONVERSATIONS_TABLE", "icc-rankings-conversations")
USERS_TABLE = os.environ.get("USERS_TABLE", "icc-rankings-users")
RETENTION_DAYS = 90


def clean(doc: dict) -> dict:
    """Recursively convert MongoDB doc to DynamoDB-safe format."""
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, list):
            out[k] = [
                clean(i) if isinstance(i, dict) else
                i.isoformat() if isinstance(i, datetime) else i
                for i in v
            ]
        elif isinstance(v, dict):
            out[k] = clean(v)
        elif v is not None:
            out[k] = v
    return out


def ttl_from(updated_at: str | None) -> int:
    if updated_at:
        try:
            return int(datetime.fromisoformat(updated_at).timestamp()) + RETENTION_DAYS * 86400
        except (ValueError, TypeError):
            pass
    return int(time.time()) + RETENTION_DAYS * 86400


def migrate_conversations(mongo_db, dynamo):
    table = dynamo.Table(CONVERSATIONS_TABLE)
    coll = mongo_db["conversations"]
    total = coll.count_documents({})
    print(f"Migrating {total} conversations...")
    ok = err = 0
    for doc in coll.find({}):
        try:
            item = clean(doc)
            if "session_id" not in item:
                print(f"  SKIP (no session_id): {doc.get('_id')}")
                continue
            item.setdefault("updated_at", datetime.now(timezone.utc).isoformat())
            item["ttl"] = ttl_from(item.get("updated_at"))
            table.put_item(Item=item)
            ok += 1
            if ok % 10 == 0:
                print(f"  {ok}/{total}...")
        except Exception as e:
            err += 1
            print(f"  ERROR {doc.get('session_id', '?')}: {e}")
    print(f"Conversations: {ok} OK, {err} errors")
    return ok, err


def migrate_users(mongo_db, dynamo):
    table = dynamo.Table(USERS_TABLE)
    coll = mongo_db["users"]
    total = coll.count_documents({})
    print(f"Migrating {total} users...")
    ok = err = 0
    for doc in coll.find({}):
        try:
            item = clean(doc)
            if "google_sub" not in item:
                print(f"  SKIP (no google_sub): {doc.get('_id')}")
                continue
            item.pop("_is_new", None)  # Internal MongoDB sentinel — not needed in DynamoDB
            table.put_item(Item=item)
            ok += 1
        except Exception as e:
            err += 1
            print(f"  ERROR {doc.get('google_sub', '?')}: {e}")
    print(f"Users: {ok} OK, {err} errors")
    return ok, err


def main():
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    print("MongoDB connected.")

    print(f"Connecting to DynamoDB in {AWS_REGION}...")
    dynamo = boto3.resource("dynamodb", region_name=AWS_REGION)
    print("DynamoDB connected.\n")

    c_ok, c_err = migrate_conversations(client[MONGO_DB], dynamo)
    print()
    u_ok, u_err = migrate_users(client[MONGO_DB], dynamo)
    print(f"\n=== Done: {c_ok + u_ok} migrated, {c_err + u_err} errors ===")
    if c_err + u_err:
        exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**
```bash
chmod +x infrastructure/scripts/migrate-mongo-to-dynamodb.py
git add infrastructure/scripts/migrate-mongo-to-dynamodb.py
git commit -m "chore(migration): add MongoDB to DynamoDB migration script"
```

---

## Phase 5 — Final Documentation

### Task 17: Architecture + Cost + Deployment Runbook

**Files:**
- Create: `docs/aws/04-architecture.md`
- Create: `docs/aws/05-cost-breakdown.md`
- Create: `docs/aws/06-deployment-runbook.md`

- [ ] **Step 1: Write 04-architecture.md**

```markdown
# AWS Architecture — ICC Rankings

## Diagram

```
                        darshil-ai.com (domain registrar)
                               │
          ┌────────────────────┼─────────────────────────┐
          │                   │                          │
          ▼                   ▼                          ▼
icc-rankings.darshil-ai.com  api.icc-rankings.*    chat.icc-rankings.*
          │                   │                          │
          ▼                   ▼                          ▼
      Vercel               Lambda                    Lambda
   (Next.js SSR)         Function URL              Function URL
       Free               (Rust API)             (Python chatbot)
                              │                          │
                              │                     ┌────┤
                              │                     │    │
                              ▼                     ▼    ▼
                          Neon (PG)           DynamoDB   Neon (PG read-only)
                        [external SaaS]     [AWS, free]  [external SaaS]
                        Free 0.5GB                       Free 0.5GB (same DB)
```

## Why These Services?

| Service | Reason |
|---|---|
| **Vercel** | Only option that truly supports Next.js 14 App Router SSR for free. Monorepo-aware. |
| **AWS Lambda (container)** | Always-free tier covers hobby usage. Rust cold start ~50ms. Existing Dockerfiles work with 2-line change. |
| **Neon** | Serverless PostgreSQL — same engine, same queries, same migrations. Free 0.5GB. Scales to zero = $0. |
| **DynamoDB** | Always-free tier. No connection pooling concerns (managed by AWS). TTL handles conversation cleanup. |
| **No VPC/EC2/RDS** | VPC requires NAT Gateway ($32/mo) to give Lambda internet access. EC2 + RDS = $21/mo. Lambda + Neon = $0. |

## AWS Skills Demonstrated

- Lambda container images (not just zip deploys — shows Docker knowledge)
- ECR lifecycle policies
- IAM least-privilege roles (API role: logs only; chatbot role: logs + scoped DynamoDB)
- DynamoDB table design (GSI for user session queries, TTL for retention)
- Lambda Function URL CORS configuration
- Terraform IaC managing all AWS resources
```

- [ ] **Step 2: Write 05-cost-breakdown.md**

```markdown
# Cost Breakdown

## Monthly Costs (no free tier dependency)

| Service | Allowance | Hobby usage | Cost |
|---|---|---|---|
| Lambda requests | 1M/month free | ~3,300/month | $0 |
| Lambda compute | 400K GB-sec/month free | ~3,100 GB-sec/month* | $0 |
| ECR storage | 50GB/month free | ~1GB (2 images) | $0 |
| DynamoDB | 25GB + 25WCU free | <10MB, <500 req/day | $0 |
| Neon PostgreSQL | 0.5GB storage free | ~5–10MB data | $0 |
| Vercel hosting | Hobby plan free | — | $0 |
| **Total** | | | **$0** |

> DNS managed at domain registrar (free). Route 53 skipped.

*Compute breakdown: 300 chatbot req × 10s × 1GB = 3,000 GB-sec; 3,000 API req × 0.1s × 0.25GB = 75 GB-sec. Total: 3,075 of 400,000 free.

## "Always Free" vs "12-Month Free"

These AWS services have NO expiry on their free tier:
- Lambda (compute + requests) ✅
- DynamoDB (storage + throughput) ✅
- ECR (50GB storage) ✅
- IAM, CloudWatch Logs (basic) ✅

These would cost money (so we don't use them):
- EC2 t3.micro: 12-month only → $7.59/mo after
- RDS db.t3.micro: 12-month only → $13.14/mo after

## If Usage Grows

At 10,000 chatbot requests/month (10× current estimate):
- Lambda compute: 10,000 × 10s × 1GB = 100,000 GB-seconds → still free (400K limit)
- You'd need ~40,000+ chatbot requests/month before paying anything for Lambda

At that scale, reconsider architecture (persistent container, etc.).
```

- [ ] **Step 3: Write 06-deployment-runbook.md**

```markdown
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
export NEON_DB_URL="postgresql://icc_owner:<pass>@ep-xxx.us-east-1.aws.neon.tech/icc_ranking?sslmode=require"

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
  --region us-east-1
```

**Next.js update:**
```bash
git push origin develop  # Vercel auto-builds on push
```
```

- [ ] **Step 4: Commit all docs**
```bash
git add docs/aws/
git commit -m "docs(aws): add architecture, cost breakdown, and deployment runbook"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Show AWS knowledge | Lambda, DynamoDB, IAM, ECR (Tasks 5–9) |
| UI on Vercel (monorepo) | Task 3 guide, no restructuring needed |
| RDS avoided (costly) | Replaced with Neon — Task 2 guide, Task 15 migration |
| Neon instructions (new to user) | Task 2 dedicated guide |
| MongoDB → AWS NoSQL | DynamoDB (Tasks 8, 12, 16) |
| Cost breakdown | Task 17 |
| Chatbot cold start acceptable | Task 14 warm-up ping on sign-in |
| Lambda warm-up strategy | Task 14 — sign-in trigger only, no heartbeat |
| DB migration scripts | Tasks 15, 16 |
| AWS account setup | Task 1 |
| Terraform guide | Task 3 |
| Vercel guide | Task 3 |
| No EC2/RDS/VPC | Removed from all Terraform files |

### Placeholder Scan
No TBD, TODO, or placeholder code present.

### Type Consistency
- `dynamo.py` and `users_dynamo.py` signatures match `mongo.py` and `users.py` exactly
- `settings.dynamo_conversations_table` default matches `var.project_name` + `-conversations` from Terraform
- Lambda env var `DYNAMO_CONVERSATIONS_TABLE` maps to `settings.dynamo_conversations_table` via pydantic
- `PORT` env var in both Dockerfiles matches what Lambda Web Adapter expects

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-12-aws-migration.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks in this session using executing-plans

Which approach?
