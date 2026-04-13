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

## 4. Create an IAM User Group

Rather than attaching policies directly to users, attach them to a group — then add
users to the group. One policy change updates everyone in the group.

1. IAM → **User groups** → **Create group**
2. Group name: `Administrators`
3. Attach policy: **AdministratorAccess**
4. Click **Create group**

> **AdministratorAccess vs root:** Not the same. Root bypasses IAM entirely and can
> close the account, change payment details, and cannot be restricted by any policy.
> `AdministratorAccess` is a normal IAM policy — full service access, but it goes
> through IAM, can be revoked, and is logged in CloudTrail. Always prefer IAM users
> over root for day-to-day work.

> **Terraform and AdministratorAccess:** Ideally `terraform-deployer` would have a
> least-privilege policy listing only Lambda, ECR, DynamoDB, and IAM. In practice,
> getting that right requires iterating through `AccessDenied` errors. For now,
> `Administrators` is fine — once the infra is stable you can scope it down.

## 5. Create an Admin IAM User (for console access)

This user is for you — to browse CloudWatch logs, inspect DynamoDB, check Lambda
invocations, etc. It has console access but no long-lived CLI keys.

1. IAM → **Users** → **Create user**
2. Username: `darshil` (or any name you prefer)
3. Enable **AWS Management Console access** → choose **I want to create an IAM user** → set a password
4. Add to group: `Administrators`
5. After creation → **Security credentials** tab → **Assign MFA device** → Authenticator app

From now on, use this user — not root — whenever you log into the console.

## 6. Create an IAM User for Terraform (programmatic access)

This user is CLI-only — no console login. Terraform uses its access keys to create
and manage AWS resources.

1. IAM → **Users** → **Create user**
2. Username: `terraform-deployer`
3. Do NOT enable console access
4. Add to group: `Administrators`
5. After creation → **Security credentials** tab → **Create access key**
6. Choose **Command Line Interface (CLI)** → download the CSV

> **Why separate users?** If `terraform-deployer` credentials ever leak, the attacker
> can't log into the console (no password set). Your console user has no long-lived
> access keys. Neither account is root. This is the AWS-recommended pattern.

## 7. Configure AWS CLI

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
