# Revize AWS Deployment Reference

## AWS Infrastructure

### EC2 Instance
| Property | Value |
|----------|-------|
| Instance Name | revize-production |
| Instance ID | i-02fa748109133c884 |
| Instance Type | t3.small |
| Elastic IP | 3.13.130.32 |
| Public DNS | ec2-3-13-130-32.us-east-2.compute.amazonaws.com |
| Private IP | 172.31.33.177 |
| Region | us-east-2 |
| VPC | vpc-0c80317712d6aabdf |
| Security Groups | ec2-rds-1, launch-wizard-1 |

### RDS PostgreSQL
| Property | Value |
|----------|-------|
| DB Identifier | revize-db |
| Endpoint | revize-db.cx82owo8yex5.us-east-2.rds.amazonaws.com |
| Port | 5432 |
| Database Name | revize_db |
| Master Username | revize_admin |
| VPC | vpc-0c80317712d6aabdf |
| Security Group | rds-ec2-1 |
| Publicly Accessible | No |
| Availability Zone | us-east-2c |

### Connection String
```
DATABASE_URL=postgresql://revize_admin:<PASSWORD>@revize-db.cx82owo8yex5.us-east-2.rds.amazonaws.com:5432/revize_db
```

---

## Security Groups Configuration

### EC2 Security Groups
- **ec2-rds-1** (sg-0b1ee4a3a92ca1da4) - Allows EC2 to connect to RDS
- **launch-wizard-1** (sg-0ddad67ba42043c41) - SSH, HTTP, HTTPS access

### RDS Security Group
- **rds-ec2-1** (sg-04016908a5d3c9ee9) - Allows inbound from EC2 on port 5432

---

## GitHub Secrets (to be configured)

| Secret | Value |
|--------|-------|
| EC2_HOST | 3.13.130.32 |
| EC2_USER | ubuntu |
| EC2_SSH_KEY | (your private key content) |
| DATABASE_URL | postgresql://revize_admin:PASSWORD@revize-db.cx82owo8yex5.us-east-2.rds.amazonaws.com:5432/revize_db |
| DJANGO_SECRET_KEY | (generate secure key) |
| ALLOWED_HOSTS | 3.13.130.32,ec2-3-13-130-32.us-east-2.compute.amazonaws.com |
| CORS_ALLOWED_ORIGINS | http://3.13.130.32,http://ec2-3-13-130-32.us-east-2.compute.amazonaws.com |
| VITE_API_URL | http://3.13.130.32/api |
| GEMINI_API_KEY | (your key) |
| OPENAI_API_KEY | (your key) |
| GOOGLE_OAUTH2_CLIENT_ID | (your OAuth client ID) |
| GOOGLE_OAUTH2_CLIENT_SECRET | (your OAuth secret) |

---

## SSH Access
```bash
ssh -i /Users/saiakhil/Documents/AWS_Related/revizeprodv1.pem ubuntu@3.133.89.88
```

### Key File Location
`/Users/saiakhil/Documents/AWS_Related/revizeprodv1.pem`

---

## Deployment Flow
```
Local → GitHub (push) → GitHub Actions → SSH to EC2 → docker compose build → docker compose up
```

---

## URLs (after deployment)
- **Frontend**: http://3.133.89.88
- **Backend API**: http://3.133.89.88/api
- **Admin**: http://3.133.89.88/admin

---

## Cost Estimate (Monthly)
| Service | Cost |
|---------|------|
| EC2 t3.small | ~$15 |
| RDS db.t3.micro | ~$15 |
| Data Transfer | ~$5 |
| **Total** | **~$35** |
