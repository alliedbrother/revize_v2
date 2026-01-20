# Revize v2 - Auto-Scaling Implementation Plan

## Goal
Implement automatic horizontal scaling with load balancing - more instances when traffic is high, fewer when low.

---

## Recommended Approach: ECS Fargate

After comparing EC2 Auto Scaling, ECS Fargate, and ECS with EC2, **ECS Fargate** is the best fit because:

| Factor | ECS Fargate Advantage |
|--------|----------------------|
| **Scaling Speed** | 30-60 seconds (vs 2-5 min for EC2) |
| **Operations** | Zero server management |
| **Docker Fit** | Existing Dockerfiles work as-is |
| **Cost** | Pay only for running tasks |
| **CI/CD** | Simple: push image → update service |

---

## New Architecture

```
Internet
    ↓
Application Load Balancer (ALB)
    ├── HTTPS:443 (SSL termination via ACM)
    ├── /api/* → Backend Target Group
    ├── /admin/* → Backend Target Group
    └── /* → Frontend Target Group
         ↓
    ┌────────────────────────────────────┐
    │         ECS Cluster (Fargate)       │
    │                                     │
    │  Backend Service    Frontend Service │
    │  ┌─────────────┐   ┌─────────────┐  │
    │  │ Task 1      │   │ Task 1      │  │
    │  │ Task 2      │   │ Task 2      │  │
    │  │ (auto-scale)│   │ (auto-scale)│  │
    │  └─────────────┘   └─────────────┘  │
    └────────────────────────────────────┘
         ↓                    ↓
    AWS RDS PostgreSQL    S3 (static/media)
```

---

## Implementation Phases

### Phase 1: S3 Storage Setup
- Create S3 bucket for static files and media uploads
- Enable `USE_S3=TRUE` (already configured in settings.py)
- Migrate existing media files to S3
- Optional: Add CloudFront CDN

### Phase 2: ECR Setup
- Create ECR repositories for backend and frontend
- Push Docker images to ECR
- Tag images with git SHA for versioning

### Phase 3: Networking
- Create VPC with public subnets in 2 AZs
- Configure security groups for ALB → ECS → RDS
- Skip NAT Gateway (use public subnets to save ~$32/month)

### Phase 4: ECS Cluster & Task Definitions
- Create ECS cluster with Fargate capacity
- Define backend task (0.5 vCPU, 1GB RAM)
- Define frontend task (0.25 vCPU, 0.5GB RAM)
- Configure secrets via AWS Secrets Manager

### Phase 5: Application Load Balancer
- Request ACM certificate for revize.live (free)
- Create ALB with HTTPS listener
- Configure path-based routing rules
- Set up health checks

### Phase 6: ECS Services & Auto-Scaling
- Create backend service (min: 1, max: 10 tasks)
- Create frontend service (min: 1, max: 5 tasks)
- Configure target tracking scaling:
  - Scale out: CPU > 70%
  - Scale in: CPU < 30%

### Phase 7: CI/CD Pipeline Update
- Replace SSH-based deployment with ECR push
- Use `aws ecs update-service --force-new-deployment`
- Wait for service stability before completing

### Phase 8: DNS & Cutover
- Update Route 53 to point to ALB
- Test thoroughly
- Decommission old EC2 instance

---

## Files to Modify

| File | Changes |
|------|---------|
| `.github/workflows/deploy.yml` | Replace SSH deployment with ECR push + ECS update |
| `spaced-repetition/backend/spaced_repetition/settings.py` | Add proxy headers for ALB |
| `spaced-repetition/frontend/nginx.conf` | Remove SSL (ALB handles it) |

---

## New GitHub Secrets Needed

| Secret | Purpose |
|--------|---------|
| `AWS_ACCOUNT_ID` | ECR registry URL |
| `AWS_ACCESS_KEY_ID` | IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | IAM credentials |

---

## Auto-Scaling Configuration

| Service | Min | Max | Scale Out | Scale In | Cooldown |
|---------|-----|-----|-----------|----------|----------|
| Backend | 1 | 10 | CPU > 70% | CPU < 30% | 60s out / 300s in |
| Frontend | 1 | 5 | CPU > 70% | CPU < 30% | 60s out / 300s in |

---

## Cost Comparison

| Traffic Level | Current (EC2) | New (ECS Fargate) |
|--------------|---------------|-------------------|
| **Low** | ~$35/mo | ~$45-55/mo |
| **Moderate** | ~$35/mo (struggling) | ~$55-70/mo |
| **High** | Would fail | ~$80-120/mo (auto-scales) |

The ~$15-20/mo increase provides:
- Automatic scaling to handle traffic spikes
- High availability across 2 AZs
- Zero-downtime deployments
- No server management overhead

---

## Database Considerations

- RDS already externalized - works with multiple instances
- Add connection pooling: `CONN_MAX_AGE=60`
- RDS db.t3.micro supports ~100 connections (sufficient)
- Run migrations as one-off ECS task before deployment

---

## Verification Plan

1. **After S3 setup**: Verify static files load from S3 bucket
2. **After ECR setup**: Verify images push successfully
3. **After ECS deployment**:
   - Check health endpoints via ALB
   - Verify `/api/health/` returns 200
   - Verify frontend loads correctly
4. **Auto-scaling test**:
   - Use load testing tool (k6 or locust)
   - Observe task count increase under load
   - Verify scale-in after load subsides
5. **CI/CD test**: Push to main, verify automatic deployment

---

## Rollback Strategy

ECS maintains old tasks until new ones pass health checks. Manual rollback:
```bash
aws ecs update-service --cluster revize-cluster \
  --service revize-backend \
  --task-definition revize-backend:PREVIOUS_REVISION
```
