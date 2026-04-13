# AWS Architecture — ICC Rankings

## Diagram

```
                    darshil-ai.com (domain registrar)
                           │
      ┌────────────────────┼─────────────────────────┐
      │                   │                          │
      ▼                   ▼                          ▼
icc-rankings.darshil-ai.com  (Lambda URL)       (Lambda URL)
      │                   │                          │
      ▼                   ▼                          ▼
  Vercel               Lambda                    Lambda
(Next.js SSR)        Function URL              Function URL
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
