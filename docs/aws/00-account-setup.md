# AWS Account Setup Guide

## 1. Create a New AWS Account

Go to https://console.aws.amazon.com and click **Create a new AWS account**.

You will need:
- An email address (use a fresh one, or a `+alias` like `you+aws@gmail.com`)
- A credit/debit card (required by AWS for identity verification — you won't be charged for the services we use)
- A phone number for verification

Complete the sign-up flow. Choose the **Basic (free) support plan** when prompted.

> **Note:** New accounts get the full 12-month free tier on top of the always-free services
> (Lambda, DynamoDB, ECR). The 12-month tier covers things like EC2 and S3 — we don't
> use those, but it's a nice bonus.

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
