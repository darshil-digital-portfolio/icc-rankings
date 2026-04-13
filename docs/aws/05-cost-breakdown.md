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
