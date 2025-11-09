# Production Deployment Guide - Revize on AWS

**Target Environment**: Production-ready AWS deployment
**Instance Specs**: t3.small EC2 + db.t3.micro RDS
**Estimated Cost**: $30-50/month
**Deployment Time**: 2-3 hours

---

## Pre-Deployment Checklist

Before starting, ensure you have:

z- [ ] AWS account with billing configured
- [ ] Domain name purchased (optional but recommended)
- [ ] GitHub repository with latest code
- [ ] OpenAI/Gemini API keys
- [ ] SSH key pair for secure access

**Required Environment Variables** (prepare these):
```
DATABASE_URL
SECRET_KEY (generate new for production)
ALLOWED_HOSTS
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_STORAGE_BUCKET_NAME
OPENAI_API_KEY
GOOGLE_API_KEY
```

---

## Step 1: Create RDS PostgreSQL Database

### 1.1 Launch RDS Instance

```
AWS Console → RDS → Create Database
```

**Configuration:**
```
Engine: PostgreSQL 15.x
Template: Production
DB instance class: db.t3.micro (2GB RAM)
Storage: 20GB GP3 SSD
Enable storage autoscaling: Yes (max 100GB)
```

**Instance Settings:**
```
DB instance identifier: revize-prod-db
Master username: revizeadmin
Master password: [Generate 32-char password]
```

**Connectivity:**
```
VPC: Default VPC
Public access: No
VPC security group: Create new → revize-db-prod-sg
Availability Zone: No preference (for Multi-AZ later)
```

**Additional Configuration:**
```
Initial database name: revize_prod
DB parameter group: default.postgres15
Option group: default:postgres-15
Backup retention: 7 days
Backup window: 03:00-04:00 UTC
Enable auto minor version upgrade: Yes
Deletion protection: Enable
```

**Encryption:**
```
Enable encryption: Yes
Master key: (default) aws/rds
```

### 1.2 Configure Security Group

```
EC2 → Security Groups → revize-db-prod-sg → Edit inbound rules
```

Add rule:
```
Type: PostgreSQL
Port: 5432
Source: Custom → Will add EC2 security group in Step 2
Description: Allow from EC2 production instances
```

### 1.3 Note Database Endpoint

After creation (~10 minutes), copy the endpoint:
```
revize-prod-db.xxxxx.us-east-1.rds.amazonaws.com
```

---

## Step 2: Create EC2 Instance

### 2.1 Launch EC2 Instance

```
EC2 → Launch Instance
```

**AMI:**
```
Ubuntu Server 22.04 LTS (HVM), SSD Volume Type
64-bit (x86)
```

**Instance Type:**
```
t3.small
2 vCPU, 2 GiB RAM
```

**Key Pair:**
```
Create new key pair:
  Name: revize-prod-key
  Type: RSA
  Format: .pem
Download and save securely: chmod 400 revize-prod-key.pem
```

**Network Settings:**
```
Create security group: revize-web-prod-sg
Allow SSH: Yes (from My IP only)
Allow HTTPS: Yes (from Internet)
Allow HTTP: Yes (from Internet) - will redirect to HTTPS
```

**Configure Storage:**
```
Volume: 20 GiB GP3
Delete on termination: No (for data safety)
```

**Advanced Details:**
```
IAM instance profile: None (will use access keys)
Enable termination protection: Yes
```

### 2.2 Allocate Elastic IP

```
EC2 → Elastic IPs → Allocate Elastic IP address
Associate with your EC2 instance
```

This ensures your IP doesn't change on restart.

### 2.3 Update RDS Security Group

```
Security Groups → revize-db-prod-sg → Edit inbound rules
Source: Select revize-web-prod-sg (EC2 security group)
```

---

## Step 3: Initial Server Setup

### 3.1 Connect to EC2

```bash
ssh -i revize-prod-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 3.2 Update System and Install Dependencies

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    git \
    nginx \
    postgresql-client \
    ufw \
    fail2ban \
    certbot \
    python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
python3.11 --version
node --version
nginx -v
```

### 3.3 Configure Firewall

```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

### 3.4 Harden SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Update these settings:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
```

```bash
sudo systemctl restart sshd
```

### 3.5 Install Fail2ban

```bash
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

---

## Step 4: Deploy Backend Application

### 4.1 Clone Repository

```bash
cd /opt
sudo mkdir revize
sudo chown ubuntu:ubuntu revize
cd revize

git clone https://github.com/YOUR_USERNAME/revize_v2.git
cd revize_v2/spaced-repetition/backend
```

### 4.2 Create Python Virtual Environment

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

### 4.3 Create Production Environment File

```bash
nano .env.production
```

Add (replace with actual values):
```env
# Django
SECRET_KEY=GENERATE_NEW_50_CHAR_SECRET_KEY_HERE
DEBUG=False
ALLOWED_HOSTS=YOUR_ELASTIC_IP,your-domain.com,www.your-domain.com

# Database
DATABASE_URL=postgresql://revizeadmin:YOUR_DB_PASSWORD@revize-prod-db.xxxxx.us-east-1.rds.amazonaws.com:5432/revize_prod

# AWS S3
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=revize-prod-media
AWS_S3_REGION_NAME=us-east-1
AWS_S3_CUSTOM_DOMAIN=revize-prod-media.s3.amazonaws.com

# AI APIs
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
GOOGLE_API_KEY=AIzaxxxxxxxxxxxxx

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

**Generate SECRET_KEY:**
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4.4 Update Django Settings for Production

Verify `settings.py` has:
```python
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment
env_file = os.path.join(Path(__file__).resolve().parent.parent, '.env.production')
load_dotenv(env_file)

# Security settings for production
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
```

### 4.5 Run Database Migrations

```bash
# Test database connection
PGPASSWORD=YOUR_DB_PASSWORD psql -h revize-prod-db.xxxxx.us-east-1.rds.amazonaws.com -U revizeadmin -d revize_prod

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

### 4.6 Create Gunicorn Configuration

```bash
nano /opt/revize/gunicorn_config.py
```

Add:
```python
import multiprocessing

bind = "unix:/opt/revize/gunicorn.sock"
workers = multiprocessing.cpu_count() * 2 + 1  # 4 workers for t3.small
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 120
keepalive = 5

# Logging
accesslog = "/var/log/gunicorn/access.log"
errorlog = "/var/log/gunicorn/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
```

Create log directory:
```bash
sudo mkdir -p /var/log/gunicorn
sudo chown ubuntu:ubuntu /var/log/gunicorn
```

### 4.7 Create Systemd Service

```bash
sudo nano /etc/systemd/system/gunicorn.service
```

Add:
```ini
[Unit]
Description=Gunicorn daemon for Revize production
After=network.target

[Service]
Type=notify
User=ubuntu
Group=www-data
WorkingDirectory=/opt/revize/revize_v2/spaced-repetition/backend
Environment="PATH=/opt/revize/revize_v2/spaced-repetition/backend/venv/bin"
EnvironmentFile=/opt/revize/revize_v2/spaced-repetition/backend/.env.production
ExecStart=/opt/revize/revize_v2/spaced-repetition/backend/venv/bin/gunicorn \
          -c /opt/revize/gunicorn_config.py \
          spaced_repetition.wsgi:application
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 4.8 Start and Enable Gunicorn

```bash
sudo systemctl daemon-reload
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

---

## Step 5: Deploy Frontend Application

### 5.1 Configure Frontend

```bash
cd /opt/revize/revize_v2/spaced-repetition/frontend
nano src/config/environment.js
```

Update for production:
```javascript
const config = {
  API_BASE_URL: process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com/api'
    : 'http://localhost:8000/api'
};

export default config;
```

### 5.2 Build Production Frontend

```bash
npm install
npm run build

# Verify build
ls -lh dist/
```

---

## Step 6: Configure Nginx

### 6.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/revize-prod
```

Add:
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

# Upstream
upstream gunicorn {
    server unix:/opt/revize/gunicorn.sock fail_timeout=0;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL will be configured by certbot

    client_max_body_size 50M;
    client_body_timeout 120s;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Logging
    access_log /var/log/nginx/revize_access.log;
    error_log /var/log/nginx/revize_error.log warn;

    # Frontend - React build
    location / {
        root /opt/revize/revize_v2/spaced-repetition/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://gunicorn;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Admin interface
    location /admin/ {
        limit_req zone=login_limit burst=5 nodelay;

        proxy_pass http://gunicorn;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        alias /opt/revize/revize_v2/spaced-repetition/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
```

### 6.2 Enable Site and Test Configuration

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/revize-prod /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Optimize nginx
sudo nano /etc/nginx/nginx.conf
```

Update in `http` block:
```nginx
# Performance tuning
keepalive_timeout 65;
keepalive_requests 100;
client_body_buffer_size 128k;
client_max_body_size 50m;

# Gzip compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript
           application/json application/javascript application/xml+rss;
```

### 6.3 Start Nginx

```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

---

## Step 7: SSL Certificate Setup

### 7.1 Configure DNS (Do this first!)

Point your domain to your Elastic IP:
```
Type: A
Name: @
Value: YOUR_ELASTIC_IP
TTL: 300

Type: A
Name: www
Value: YOUR_ELASTIC_IP
TTL: 300
```

Wait for DNS propagation (5-30 minutes).

### 7.2 Obtain SSL Certificate

```bash
# Stop nginx temporarily
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Share email (optional)

# Restart nginx
sudo systemctl start nginx
```

### 7.3 Configure Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Enable auto-renewal (already set up by certbot)
sudo systemctl status certbot.timer

# Manually configure nginx to use certificates
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Step 8: Create S3 Bucket for Media

### 8.1 Create Bucket

```bash
AWS Console → S3 → Create Bucket
```

Configuration:
```
Name: revize-prod-media
Region: us-east-1
Block public access: Uncheck (configure carefully)
Versioning: Enable
Encryption: AES-256
```

### 8.2 Configure CORS

Bucket → Permissions → CORS:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": [
            "https://your-domain.com",
            "https://www.your-domain.com"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

### 8.3 Create IAM User

```bash
IAM → Users → Create User
Name: revize-prod-s3
Permissions: AmazonS3FullAccess (or custom policy)
```

Custom policy (recommended):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::revize-prod-media",
                "arn:aws:s3:::revize-prod-media/*"
            ]
        }
    ]
}
```

Generate access keys and add to `.env.production`.

---

## Step 9: Production Checks

### 9.1 Health Checks

```bash
# Test backend
curl https://your-domain.com/health
curl https://your-domain.com/api/

# Test admin
curl https://your-domain.com/admin/

# Test frontend
curl https://your-domain.com/
```

### 9.2 Security Scan

```bash
# Test SSL
curl -I https://your-domain.com/

# Check security headers
curl -I https://your-domain.com/ | grep -i "security\|x-frame\|x-xss"

# Test HTTPS redirect
curl -I http://your-domain.com/
```

### 9.3 Performance Test

```bash
# Install Apache Bench
sudo apt install apache2-utils -y

# Test load
ab -n 100 -c 10 https://your-domain.com/
```

---

## Step 10: Monitoring and Logging

### 10.1 Configure Log Rotation

```bash
sudo nano /etc/logrotate.d/revize
```

Add:
```
/var/log/gunicorn/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        systemctl reload gunicorn
    endscript
}

/var/log/nginx/revize*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}
```

### 10.2 Set Up CloudWatch Monitoring

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure (follow AWS prompts)
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### 10.3 Create Monitoring Script

```bash
nano /opt/revize/monitor.sh
```

Add:
```bash
#!/bin/bash

# Check services
systemctl is-active --quiet gunicorn || echo "Gunicorn down!" | mail -s "Alert" your@email.com
systemctl is-active --quiet nginx || echo "Nginx down!" | mail -s "Alert" your@email.com

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage at ${DISK_USAGE}%" | mail -s "Disk Alert" your@email.com
fi

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1 || echo "DB down!" | mail -s "Alert" your@email.com
```

```bash
chmod +x /opt/revize/monitor.sh

# Add to crontab
crontab -e
# Add: */5 * * * * /opt/revize/monitor.sh
```

---

## Step 11: Backup Strategy

### 11.1 RDS Automated Backups

Already configured (7 days retention). To create manual snapshot:
```
RDS → Databases → revize-prod-db → Actions → Take snapshot
```

### 11.2 Application Backup Script

```bash
nano /opt/revize/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DATABASE_URL > $BACKUP_DIR/db_$DATE.sql

# Backup media (if not using S3)
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /opt/revize/revize_v2/spaced-repetition/backend/media/

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
chmod +x /opt/revize/backup.sh

# Run daily at 2 AM
crontab -e
# Add: 0 2 * * * /opt/revize/backup.sh
```

---

## Step 12: Deployment Automation Script

Create update script for future deployments:

```bash
nano /opt/revize/deploy.sh
```

Add:
```bash
#!/bin/bash
set -e

echo "Starting deployment..."

# Pull latest code
cd /opt/revize/revize_v2
git pull origin main

# Update backend
cd spaced-repetition/backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

# Update frontend
cd ../frontend
npm install
npm run build

# Restart services
sudo systemctl restart gunicorn
sudo systemctl reload nginx

echo "Deployment complete!"
```

```bash
chmod +x /opt/revize/deploy.sh
```

Usage for future updates:
```bash
/opt/revize/deploy.sh
```

---

## Production Checklist

- [ ] RDS PostgreSQL created with backups enabled
- [ ] EC2 instance with Elastic IP
- [ ] Firewall (UFW) configured
- [ ] Fail2ban active
- [ ] Backend deployed and running
- [ ] Frontend built and served
- [ ] Nginx configured with rate limiting
- [ ] SSL certificate installed and auto-renewing
- [ ] S3 bucket created for media
- [ ] DNS pointing to Elastic IP
- [ ] HTTPS redirect working
- [ ] Security headers configured
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] All health checks passing

---

## Post-Deployment

### Security Hardening
```bash
# Disable password authentication completely
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no

# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Performance Optimization
```bash
# Enable HTTP/2 (already in nginx config)
# Add CloudFront CDN for static assets
# Enable database connection pooling
# Configure Redis for session storage
```

### Monitoring Setup
- CloudWatch: CPU, Memory, Disk, Network
- RDS: Connection count, CPU, Storage
- Application: Error rates, Response times
- Set up billing alerts

---

## Estimated Costs

**Monthly Costs:**
- EC2 t3.small: $15-20
- RDS db.t3.micro: $15
- S3: $0.50-2 (depending on usage)
- Data transfer: $1-5
- **Total: $30-50/month**

Plus variable costs:
- OpenAI API: Pay per use
- Gemini API: Free tier available

---

## Support and Troubleshooting

### View Logs
```bash
# Gunicorn
sudo tail -f /var/log/gunicorn/error.log

# Nginx
sudo tail -f /var/log/nginx/revize_error.log

# System
journalctl -u gunicorn -f
journalctl -u nginx -f
```

### Restart Services
```bash
sudo systemctl restart gunicorn
sudo systemctl reload nginx
```

### Emergency Rollback
```bash
cd /opt/revize/revize_v2
git log  # Find previous commit
git checkout COMMIT_HASH
/opt/revize/deploy.sh
```

---

**Deployment Completed**: Your Revize application is now live in production!

**Next Steps:**
1. Test all functionality
2. Monitor logs for first 24 hours
3. Set up uptime monitoring (UptimeRobot, Pingdom)
4. Configure CloudWatch alarms
5. Document any custom configurations
