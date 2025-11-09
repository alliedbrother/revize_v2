# AWS Deployment Guide - Revize Application

## Table of Contents
- [Project Stack Overview](#project-stack-overview)
- [AWS Free Tier Assessment](#aws-free-tier-assessment)
- [Recommended AWS Architecture](#recommended-aws-architecture)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Database Connection](#database-connection-details)
- [Free Tier Recommendations](#free-tier-recommendation)
- [Cost Optimization](#cost-optimization-tips)
- [Quick Start Commands](#quick-start-command-summary)

---

## Project Stack Overview

### Backend
- **Framework**: Django REST Framework
- **Database**: PostgreSQL (primary)
- **Server**: Gunicorn WSGI
- **AI APIs**: OpenAI, Google Gemini
- **Features**: File uploads (PDFs, images), flashcard generation

### Frontend
- **Framework**: React + Vite
- **Build**: Static files for deployment

### AWS Services Already Configured
- ✅ AWS S3 integration (boto3, django-storages)
- ✅ Static file serving (whitenoise)

---

## AWS Free Tier Assessment

### ✅ Free Tier CAN Work (with limitations)

**What's Included FREE for 12 months:**
- **EC2**: t2.micro instance (1 vCPU, 1GB RAM) - 750 hours/month
- **RDS**: db.t2.micro PostgreSQL (1 vCPU, 1GB RAM) - 750 hours/month
- **S3**: 5GB storage, 20,000 GET requests, 2,000 PUT requests
- **Data Transfer**: 15GB outbound per month

### ⚠️ Limitations to Consider

1. **Performance**: 1GB RAM is tight for Django + AI processing
2. **AI API costs**: OpenAI/Gemini calls are NOT free (separate billing)
3. **Traffic limits**: 15GB/month outbound ≈ ~500 users/month (rough estimate)
4. **Storage**: 5GB S3 = limited file uploads

### 💰 What You'll Pay For
- OpenAI API calls ($0.002-0.03 per 1K tokens)
- Google Gemini API calls (has free tier: 15 requests/min)
- Exceeding free tier limits

---

## Recommended AWS Architecture

### Option 1: Free Tier (Development/Testing)

```
Architecture:
├── EC2 t2.micro (Django + React build)
├── RDS db.t2.micro (PostgreSQL)
└── S3 (media files)
```

**Specs:**
- **EC2**: t2.micro (1 vCPU, 1GB RAM)
- **RDS**: db.t2.micro (PostgreSQL 14+, 20GB storage)
- **S3**: Standard storage class

**Best For**: Development, testing, proof of concept

### Option 2: Production (Better Performance)

```
Architecture:
├── EC2 t3.small (2 vCPU, 2GB RAM) - $15-20/month
├── RDS db.t3.micro (2GB RAM) - $15/month
├── S3 + CloudFront (CDN)
└── Elastic Load Balancer (optional)
```

**Estimated Cost**: $30-50/month

**Best For**: Production with real users

---

## Step-by-Step Deployment

### Phase 1: Database Setup (RDS)

#### 1. Create RDS PostgreSQL Instance

```
AWS Console → RDS → Create Database
```

**Configuration:**
- **Engine**: PostgreSQL 14.x
- **Template**: Free tier
- **DB instance class**: db.t2.micro
- **DB instance identifier**: `revize-db`
- **Master username**: `postgres`
- **Master password**: `[create secure password]`
- **Public access**: No (for security)
- **VPC**: Default VPC
- **Security group**: Create new → `revize-db-sg`
- **Initial database name**: `revize`

#### 2. Configure RDS Security Group

```
EC2 → Security Groups → revize-db-sg
```

**Inbound Rules:**
- **Type**: PostgreSQL
- **Port**: 5432
- **Source**: EC2 security group (will create in Phase 2)

#### 3. Note Database Endpoint

After creation, note your RDS endpoint:
```
Example: revize-db.xxxxx.us-east-1.rds.amazonaws.com
```

---

### Phase 2: EC2 Instance Setup

#### 1. Launch EC2 Instance

```
EC2 → Launch Instance
```

**Configuration:**
- **AMI**: Ubuntu Server 22.04 LTS
- **Instance type**: t2.micro (free tier)
- **Key pair**: Create new key pair
  - Name: `revize-key`
  - Type: RSA
  - Format: .pem
  - **Download and save securely**
- **Network settings**: Create new security group → `revize-web-sg`
  - SSH (22) from your IP only
  - HTTP (80) from anywhere (0.0.0.0/0)
  - HTTPS (443) from anywhere (0.0.0.0/0)
- **Storage**: 8GB gp3 (free tier allows up to 30GB)

#### 2. Update RDS Security Group

Go back to RDS security group and add:
- **Source**: revize-web-sg (EC2 security group)

#### 3. Connect to EC2

```bash
# Make key file read-only
chmod 400 revize-key.pem

# SSH into instance
ssh -i revize-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Replace `YOUR_EC2_PUBLIC_IP` with your EC2 instance's public IP.

#### 4. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and tools
sudo apt install python3.11 python3-pip python3-venv git nginx -y

# Install Node.js (for frontend build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install PostgreSQL client
sudo apt install postgresql-client -y

# Verify installations
python3 --version
node --version
npm --version
```

---

### Phase 3: Deploy Backend

#### 1. Clone Repository

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/revize_v2.git
cd revize_v2/spaced-repetition/backend
```

#### 2. Set Up Python Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

#### 3. Create Environment Variables File

```bash
nano .env
```

**Add the following** (replace with your actual values):

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@revize-db.xxxxx.us-east-1.rds.amazonaws.com:5432/revize

# Django Settings
SECRET_KEY=your-django-secret-key-generate-a-new-one
DEBUG=False
ALLOWED_HOSTS=YOUR_EC2_PUBLIC_IP,your-domain.com

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=revize-media
AWS_S3_REGION_NAME=us-east-1

# AI API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-gemini-api-key

# Optional: CORS Settings
CORS_ALLOWED_ORIGINS=http://YOUR_EC2_PUBLIC_IP,https://your-domain.com
```

**Generate a new Django SECRET_KEY:**
```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

#### 4. Configure Django Settings

Update `spaced_repetition/settings.py` if needed:

```python
import os
from dotenv import load_dotenv

load_dotenv()

# Use environment variables
SECRET_KEY = os.environ.get('SECRET_KEY')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')
```

#### 5. Run Database Migrations

```bash
# Test database connection
python manage.py dbshell
# Type \q to exit

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

#### 6. Test Django with Gunicorn

```bash
gunicorn spaced_repetition.wsgi:application --bind 0.0.0.0:8000
```

Visit `http://YOUR_EC2_IP:8000` to test. Press Ctrl+C to stop.

#### 7. Create Systemd Service for Gunicorn

```bash
sudo nano /etc/systemd/system/gunicorn.service
```

**Add:**

```ini
[Unit]
Description=Gunicorn daemon for Revize Django application
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/revize_v2/spaced-repetition/backend
Environment="PATH=/home/ubuntu/revize_v2/spaced-repetition/backend/venv/bin"
EnvironmentFile=/home/ubuntu/revize_v2/spaced-repetition/backend/.env
ExecStart=/home/ubuntu/revize_v2/spaced-repetition/backend/venv/bin/gunicorn \
          --workers 2 \
          --bind unix:/home/ubuntu/revize_v2/spaced-repetition/backend/gunicorn.sock \
          spaced_repetition.wsgi:application

[Install]
WantedBy=multi-user.target
```

**Start and enable the service:**

```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

---

### Phase 4: Deploy Frontend

#### 1. Configure Frontend API Endpoint

```bash
cd /home/ubuntu/revize_v2/spaced-repetition/frontend
nano src/config/environment.js
```

**Update API URL:**

```javascript
const config = {
  API_BASE_URL: process.env.NODE_ENV === 'production'
    ? 'http://YOUR_EC2_PUBLIC_IP/api'  // Update this
    : 'http://localhost:8000/api'
};
```

#### 2. Build React Application

```bash
npm install
npm run build
```

The build will create a `dist` folder with optimized static files.

#### 3. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/revize
```

**Add:**

```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP your-domain.com;
    client_max_body_size 50M;

    # Frontend - Serve React build
    location / {
        root /home/ubuntu/revize_v2/spaced-repetition/frontend/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=31536000";
    }

    # Backend API
    location /api/ {
        proxy_pass http://unix:/home/ubuntu/revize_v2/spaced-repetition/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://unix:/home/ubuntu/revize_v2/spaced-repetition/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static files (CSS, JS)
    location /static/ {
        alias /home/ubuntu/revize_v2/spaced-repetition/backend/staticfiles/;
        add_header Cache-Control "public, max-age=31536000";
    }

    # Media files (if not using S3)
    location /media/ {
        alias /home/ubuntu/revize_v2/spaced-repetition/backend/media/;
    }
}
```

#### 4. Enable and Test Nginx

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/revize /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Enable on boot
sudo systemctl enable nginx
```

#### 5. Set Proper Permissions

```bash
sudo chown -R ubuntu:www-data /home/ubuntu/revize_v2
sudo chmod -R 755 /home/ubuntu/revize_v2
```

---

### Phase 5: S3 Setup for Media Files

#### 1. Create S3 Bucket

```
AWS Console → S3 → Create Bucket
```

**Configuration:**
- **Bucket name**: `revize-media` (must be globally unique)
- **Region**: us-east-1 (or your preferred region)
- **Block Public Access**: Uncheck for media files
- **Bucket Versioning**: Optional (recommended)
- **Default encryption**: AES-256

#### 2. Configure Bucket CORS

Bucket → Permissions → CORS Configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["http://YOUR_EC2_IP", "https://your-domain.com"],
        "ExposeHeaders": ["ETag"]
    }
]
```

#### 3. Create IAM User for S3 Access

```
IAM → Users → Add User
```

**Configuration:**
- **User name**: `revize-s3-user`
- **Access type**: Programmatic access
- **Permissions**: Attach policy → `AmazonS3FullAccess`
- **Download credentials** (Access Key ID and Secret Access Key)

#### 4. Update Django Settings for S3

Your backend is already configured for S3. Just ensure `.env` has:

```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_STORAGE_BUCKET_NAME=revize-media
AWS_S3_REGION_NAME=us-east-1
```

---

## Database Connection Details

### Connection String Format

```
postgresql://username:password@host:port/database
```

### Example for RDS

```
postgresql://postgres:mypassword@revize-db.abc123.us-east-1.rds.amazonaws.com:5432/revize
```

### Test Connection from EC2

```bash
# Using psql
psql -h revize-db.abc123.us-east-1.rds.amazonaws.com -U postgres -d revize

# Using Django
python manage.py dbshell
```

### Django Database Configuration

In `settings.py`:

```python
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
```

---

## Free Tier Recommendation

### ✅ Use Free Tier If:
- You're in development/testing phase
- Expecting < 100 active users initially
- Limited file uploads
- Can tolerate slower performance
- Want to minimize costs

### ❌ Upgrade to Paid Tier If:
- Production app with real users
- Heavy AI processing (many flashcard generations)
- Many concurrent users (>50 simultaneous)
- Large file storage needs (>5GB)
- Need better performance and reliability

### 🎯 Recommended Migration Path

**Phase 1: Start Free (0-3 months)**
- Use t2.micro for EC2 and RDS
- Monitor performance metrics
- Test with real users

**Phase 2: Monitor (3-6 months)**
- Check CloudWatch metrics:
  - CPU utilization > 70% consistently
  - Memory > 80%
  - Response times > 2 seconds
  - Database connections maxing out

**Phase 3: Upgrade (6+ months)**
- Move to t3.small EC2 ($15-20/month)
- Upgrade RDS to db.t3.micro ($15/month)
- Add CloudFront CDN for better performance
- Consider Auto Scaling for traffic spikes

---

## Cost Optimization Tips

### 1. Use Google Gemini Over OpenAI
- Gemini has more generous free tier (15 requests/min)
- OpenAI charges per token usage
- Implement caching for repeated queries

### 2. Optimize S3 Usage
```bash
# Enable S3 lifecycle policies
- Move old files to Glacier after 90 days (90% cheaper)
- Delete temp files after 30 days
```

### 3. Set Up Billing Alerts
```
AWS Console → CloudWatch → Billing Alarms
- Set alert at $5, $10, $20
- Receive email notifications
```

### 4. Compress Assets
```bash
# Frontend build optimization
npm run build -- --mode production

# Enable nginx gzip compression
sudo nano /etc/nginx/nginx.conf
# Add: gzip on; gzip_types text/css application/javascript;
```

### 5. Use Reserved Instances (After 12 months)
- Save 30-70% vs on-demand pricing
- Commit to 1 or 3 years
- Only after validating your usage patterns

### 6. Implement Caching
- Use Django cache framework
- Cache AI API responses
- Use Redis for session storage (optional)

### 7. Monitor and Optimize Database
```sql
-- Identify slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Add indexes for frequently queried fields
CREATE INDEX idx_topic_user ON api_topic(user_id);
```

---

## Quick Start Command Summary

### Initial Setup (One-time)

```bash
# 1. SSH into EC2
ssh -i revize-key.pem ubuntu@YOUR_EC2_IP

# 2. Clone and setup backend
cd /home/ubuntu
git clone YOUR_REPO_URL
cd revize_v2/spaced-repetition/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# 3. Configure environment
nano .env  # Add all environment variables

# 4. Run migrations
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput

# 5. Setup Gunicorn service
sudo systemctl start gunicorn
sudo systemctl enable gunicorn

# 6. Build frontend
cd ../frontend
npm install
npm run build

# 7. Configure and start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Deployment Updates (Regular)

```bash
# 1. Pull latest code
cd /home/ubuntu/revize_v2
git pull origin main

# 2. Update backend
cd spaced-repetition/backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn

# 3. Update frontend
cd ../frontend
npm install
npm run build
sudo systemctl restart nginx
```

### Monitoring and Logs

```bash
# Check Gunicorn status
sudo systemctl status gunicorn

# View Gunicorn logs
sudo journalctl -u gunicorn -f

# Check Nginx status
sudo systemctl status nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# View Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Django application logs
tail -f /home/ubuntu/revize_v2/spaced-repetition/backend/logs/django.log
```

---

## SSL Certificate Setup (Optional but Recommended)

### Using Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (certbot sets this up automatically)
sudo systemctl status certbot.timer
```

Update Nginx configuration will be automatic. Certbot will modify your nginx config to use HTTPS.

---

## Troubleshooting Common Issues

### Issue 1: Gunicorn won't start

```bash
# Check logs
sudo journalctl -u gunicorn -n 50

# Common fixes:
# - Check .env file exists and has correct values
# - Verify socket file permissions
# - Ensure Python path is correct
```

### Issue 2: Database connection fails

```bash
# Test connection
psql -h YOUR_RDS_ENDPOINT -U postgres -d revize

# Check:
# - RDS security group allows EC2 IP
# - DATABASE_URL in .env is correct
# - RDS is in "Available" state
```

### Issue 3: Static files not loading

```bash
# Re-collect static files
python manage.py collectstatic --noinput

# Check nginx permissions
sudo chown -R ubuntu:www-data /home/ubuntu/revize_v2
```

### Issue 4: 502 Bad Gateway

```bash
# Check if Gunicorn is running
sudo systemctl status gunicorn

# Restart services
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

---

## Security Best Practices

1. **Never commit `.env` files** - Use `.gitignore`
2. **Rotate AWS access keys** every 90 days
3. **Use strong database passwords** (20+ characters)
4. **Enable MFA** on AWS root account
5. **Keep security groups restrictive** - Only allow necessary ports
6. **Update system regularly**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
7. **Monitor CloudWatch** for suspicious activity
8. **Backup RDS regularly** - Enable automated backups
9. **Use environment variables** for all secrets
10. **Enable CloudTrail** for audit logging

---

## Next Steps

1. **Domain Setup**: Point your domain to EC2 IP
2. **SSL Certificate**: Install Let's Encrypt
3. **Monitoring**: Set up CloudWatch alarms
4. **Backups**: Configure RDS automated backups
5. **CI/CD**: Set up GitHub Actions for automated deployments
6. **Testing**: Load test your application
7. **Documentation**: Document your custom configurations

---

## Support Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **Django Deployment**: https://docs.djangoproject.com/en/stable/howto/deployment/
- **Nginx**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/docs/

---

## Estimated Timeline

- **Initial Setup**: 3-4 hours
- **Testing**: 1-2 hours
- **SSL & Domain**: 1 hour
- **Total**: ~6-8 hours for first deployment

After the first deployment, updates take 5-10 minutes.

---

**Last Updated**: November 2024
**Version**: 1.0
