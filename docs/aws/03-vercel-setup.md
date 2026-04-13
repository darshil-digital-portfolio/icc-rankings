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
