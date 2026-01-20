# Revize Production Deployment Guide - Custom Configuration

**Last Updated:** November 9, 2025
**Deployment Date:** November 9, 2025
**Status:** ✅ Successfully Deployed

---

## Table of Contents
- [Infrastructure Overview](#infrastructure-overview)
- [AWS Resources](#aws-resources)
- [Prerequisites](#prerequisites)
- [Phase 1: Database Setup (RDS)](#phase-1-database-setup-rds)
- [Phase 2: EC2 Instance Setup](#phase-2-ec2-instance-setup)
- [Phase 3: Backend Deployment](#phase-3-backend-deployment)
- [Phase 4: Frontend Deployment](#phase-4-frontend-deployment)
- [Phase 5: Nginx Configuration](#phase-5-nginx-configuration)
- [Phase 6: SSL Certificate Setup](#phase-6-ssl-certificate-setup)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## Infrastructure Overview

### Architecture
```
Internet
    ↓
Nginx (Port 80/443)
    ↓
├── Frontend (React/Vite) → /opt/revize_application/revize_v2/spaced-repetition/frontend/dist
└── Backend (Django + Gunicorn) → Unix Socket
         ↓
    RDS PostgreSQL
```

### Technology Stack
- **Frontend:** React + Vite
- **Backend:** Django 5.1.7 + Django REST Framework
- **Server:** Gunicorn (WSGI)
- **Reverse Proxy:** Nginx
- **Database:** PostgreSQL 15 (AWS RDS)
- **OS:** Ubuntu 22.04 LTS
- **Instance:** AWS EC2 t3.small

---

## AWS Resources

### Region
**us-east-2 (Ohio)** - All resources MUST be in the same region!

### EC2 Instance
- **Instance ID:** Your instance ID
- **Instance Type:** t3.small (2 vCPU, 2GB RAM)
- **AMI:** Ubuntu Server 22.04 LTS
- **Public IP:** 18.188.82.227
- **Storage:** 20-30 GB gp3
- **Key Pair:** revize-prod-key.pem

### RDS Database
- **DB Identifier:** revize-prod-db
- **Engine:** PostgreSQL 15
- **Instance Class:** db.t3.micro (2 vCPU, 1GB RAM)
- **Endpoint:** revize-prod-db.cx82owo8yex5.us-east-2.rds.amazonaws.com
- **Port:** 5432
- **Database Name:** revize
- **Master Username:** postgres
- **Storage:** 20 GB gp3 (auto-scaling enabled to 100 GB)
- **Backup Retention:** 7 days

### Security Groups

#### EC2 Security Group (revize-web-prod-sg)
**ID:** sg-04efddf3c21c6c26

**Inbound Rules:**
```
Type        Protocol    Port    Source          Description
SSH         TCP         22      Your IP         SSH access
HTTP        TCP         80      0.0.0.0/0       Web traffic
HTTPS       TCP         443     0.0.0.0/0       Secure web traffic
```

**Outbound Rules:**
```
All traffic allowed
```

#### RDS Security Group (revize-prod-db-sg)
**ID:** sg-00f65ebe7db0ed9a5

**Inbound Rules:**
```
Type        Protocol    Port    Source                  Description
PostgreSQL  TCP         5432    sg-04efddf3c21c6c26     Allow EC2 to connect
```

### VPC
**VPC ID:** vpc-0c80317712d6aabdf (Default VPC)

---

## Prerequisites

### Local Machine
- SSH client
- Web browser
- Git (if you need to update code)

### AWS Account
- Active AWS account
- IAM user with permissions:
  - EC2 full access
  - RDS full access
  - VPC access
  - S3 access (for media files - optional)

### Credentials You'll Need
- RDS Database Password: `Revizelive1998`
- Django SECRET_KEY: (generated during deployment)
- OpenAI API Key: Your key
- Google Gemini API Key: Your key
- Google OAuth2 credentials: Your credentials

---

## Phase 1: Database Setup (RDS)

### 1.1 Create RDS Instance

**AWS Console → RDS → Create Database**

**Configuration:**
```yaml
Engine: PostgreSQL
Engine Version: 15.x
Template: Production (or Dev/Test for lower cost)
DB Instance Identifier: revize-prod-db
Master Username: postgres
Master Password: Revizelive1998  # Change this!

Instance Class: db.t3.micro
Storage Type: General Purpose SSD (gp3)
Allocated Storage: 20 GB
Enable Storage Autoscaling: Yes
Maximum Storage Threshold: 100 GB

VPC: Default VPC
Public Access: No
VPC Security Group: Create new → revize-prod-db-sg
Availability Zone: No preference

Database Name: revize
Port: 5432
Backup Retention: 7 days
Enable Encryption: Yes
Enable Automated Backups: Yes
Enable Enhanced Monitoring: Yes (60 seconds)
Enable Deletion Protection: Yes
```

### 1.2 Configure RDS Security Group

After RDS creation, update the security group:

**EC2 → Security Groups → revize-prod-db-sg → Edit Inbound Rules**

```
Type: PostgreSQL
Port: 5432
Source: sg-04efddf3c21c6c26 (EC2 security group)
Description: Allow EC2 web server to connect to database
```

### 1.3 Note RDS Endpoint

**Endpoint:** revize-prod-db.cx82owo8yex5.us-east-2.rds.amazonaws.com

---

## Phase 2: EC2 Instance Setup

### 2.1 Launch EC2 Instance

**EC2 → Launch Instance**

**Configuration:**
```yaml
Name: revize-production
AMI: Ubuntu Server 22.04 LTS (64-bit x86)
Instance Type: t3.small
Key Pair: revize-prod-key (create and download)
Network Settings:
  VPC: Default VPC
  Auto-assign Public IP: Enable
  Security Group: Create new → revize-web-prod-sg
    - SSH (22) from Your IP
    - HTTP (80) from 0.0.0.0/0
    - HTTPS (443) from 0.0.0.0/0
Storage: 20-30 GB gp3
```

### 2.2 Connect to EC2

```bash
# Set key permissions
chmod 400 /Users/saiakhil/Documents/AWS_Related/revize-prod-key.pem

# SSH into instance
ssh -i /Users/saiakhil/Documents/AWS_Related/revize-prod-key.pem ubuntu@18.188.82.227
```

### 2.3 Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and tools
sudo apt install python3.11 python3-pip python3.11-venv git nginx -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install PostgreSQL client
sudo apt install postgresql-client -y

# Verify installations
python3 --version    # Should show 3.10.12 or higher
node --version       # Should show v20.x
npm --version        # Should show 10.x
git --version        # Should show 2.x
nginx -v            # Should show 1.18.x
```

---

## Phase 3: Backend Deployment

### 3.1 Clone Repository

```bash
cd /opt
sudo mkdir -p revize_application
sudo chown ubuntu:ubuntu revize_application
cd revize_application

# Clone your repository
git clone https://github.com/YOUR_USERNAME/revize_v2.git
cd revize_v2/spaced-repetition/backend
```

**Repository Path:** `/opt/revize_application/revize_v2`

### 3.2 Create Python Virtual Environment

```bash
cd /opt/revize_application/revize_v2/spaced-repetition/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
```

### 3.3 Install Python Dependencies

```bash
pip install -r requirements.txt
pip install gunicorn
```

**If you encounter urllib3 conflict:**

```bash
nano requirements.txt
# Change: urllib3==2.2.0
# To: urllib3>=1.25.4,<2.1
# Save and exit

pip install -r requirements.txt
```

### 3.4 Create Environment File

```bash
nano .env.production
```

**Add this configuration:**

```env
# Django
SECRET_KEY="GENERATE_NEW_SECRET_KEY_HERE"
DEBUG=False

# Database
DATABASE_URL=postgresql://postgres:Revizelive1998@revize-prod-db.cx82owo8yex5.us-east-2.rds.amazonaws.com:5432/revize

# Hosts
ALLOWED_HOSTS=18.188.82.227,localhost,127.0.0.1,revize.live,www.revize.live
CORS_ALLOWED_ORIGINS=http://18.188.82.227,https://revize.live,https://www.revize.live

# Django Settings
DJANGO_SETTINGS_MODULE=spaced_repetition.settings

# Google API
GOOGLE_OAUTH2_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_OAUTH2_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# OpenAI
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"

# Langsmith (Optional)
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=pr-candid-kayak-40
LANGSMITH_API_KEY="YOUR_LANGSMITH_API_KEY"

# AWS S3 (Optional - for media files)
USE_S3=False
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
# AWS_STORAGE_BUCKET_NAME=revize-prod-media
# AWS_S3_REGION_NAME=us-east-2

# Security (Enable after SSL is configured)
# SECURE_SSL_REDIRECT=True
# SESSION_COOKIE_SECURE=True
# CSRF_COOKIE_SECURE=True
# SECURE_HSTS_SECONDS=31536000
# SECURE_HSTS_INCLUDE_SUBDOMAINS=True
# SECURE_HSTS_PRELOAD=True
```

**Generate SECRET_KEY:**

```bash
source venv/bin/activate
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copy the output and paste it as SECRET_KEY value.

### 3.5 Test Database Connection

```bash
PGPASSWORD=Revizelive1998 psql -h revize-prod-db.cx82owo8yex5.us-east-2.rds.amazonaws.com -U postgres -d revize
```

Type `\q` to exit if successful.

### 3.6 Run Migrations

```bash
cd /opt/revize_application/revize_v2/spaced-repetition/backend
source venv/bin/activate

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
# Username: admin (or your choice)
# Email: your-email@example.com
# Password: (create a strong password)

# Collect static files
python manage.py collectstatic --noinput
```

### 3.7 Create Gunicorn Configuration

```bash
nano /opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn_config.py
```

**Add:**

```python
import multiprocessing

bind = "unix:/opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn.sock"
umask = 0o007
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 120
keepalive = 5

accesslog = "/var/log/gunicorn/access.log"
errorlog = "/var/log/gunicorn/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
```

**Create log directory:**

```bash
sudo mkdir -p /var/log/gunicorn
sudo chown ubuntu:ubuntu /var/log/gunicorn
```

### 3.8 Create Systemd Service

```bash
sudo nano /etc/systemd/system/gunicorn.service
```

**Add:**

```ini
[Unit]
Description=Gunicorn daemon for Revize production
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/opt/revize_application/revize_v2/spaced-repetition/backend
Environment="PATH=/opt/revize_application/revize_v2/spaced-repetition/backend/venv/bin"
EnvironmentFile=/opt/revize_application/revize_v2/spaced-repetition/backend/.env.production
ExecStart=/opt/revize_application/revize_v2/spaced-repetition/backend/venv/bin/gunicorn \
          --config /opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn_config.py \
          spaced_repetition.wsgi:application

Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 3.9 Start Gunicorn

```bash
# Add www-data to ubuntu group for socket access
sudo usermod -a -G ubuntu www-data

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

Should show "active (running)". Press `q` to exit.

---

## Phase 4: Frontend Deployment

### 4.1 Configure Frontend Environment

```bash
cd /opt/revize_application/revize_v2/spaced-repetition/frontend
```

**Edit environment.js:**

```bash
nano src/config/environment.js
```

**Content:**

```javascript
const environments = {
  development: {
    API_BASE_URL: 'http://localhost:8000/api',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    DEBUG: true,
  },
  staging: {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://18.188.82.227/api',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    DEBUG: false,
  },
  production: {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://18.188.82.227/api',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    DEBUG: false,
  }
};

const currentEnv = import.meta.env.MODE || 'development';

export default environments[currentEnv];
```

**Create .env.production:**

```bash
nano .env.production
```

**Add:**

```env
VITE_API_BASE_URL=http://18.188.82.227/api
VITE_GOOGLE_CLIENT_ID=207768218915-deijp30cnukg4i6p9pudmv4vrhapfoup.apps.googleusercontent.com
```

### 4.2 Build Frontend

```bash
cd /opt/revize_application/revize_v2/spaced-repetition/frontend

# Install dependencies
npm install

# Build for production
npm run build
```

Build output will be in `dist/` folder (~1.4 MB).

**Verify build:**

```bash
ls -la dist/
du -sh dist/
```

---

## Phase 5: Nginx Configuration

### 5.1 Create Nginx Site Configuration

```bash
sudo nano /etc/nginx/sites-available/revize
```

**Add:**

```nginx
server {
    listen 80;
    server_name 18.188.82.227;
    client_max_body_size 50M;

    # Frontend - Serve React build
    location / {
        root /opt/revize_application/revize_v2/spaced-repetition/frontend/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Backend API
    location /api/ {
        proxy_pass http://unix:/opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://unix:/opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Django Static files
    location /static/ {
        alias /opt/revize_application/revize_v2/spaced-repetition/backend/staticfiles/;
        add_header Cache-Control "public, max-age=31536000";
    }

    # Media files
    location /media/ {
        alias /opt/revize_application/revize_v2/spaced-repetition/backend/media/;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

### 5.2 Enable Site and Start Nginx

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/revize /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Set permissions
sudo chown -R ubuntu:www-data /opt/revize_application/revize_v2
sudo chmod -R 755 /opt/revize_application/revize_v2

# Restart services
sudo systemctl restart gunicorn
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 5.3 Verify Deployment

**Check service status:**

```bash
sudo systemctl status gunicorn
sudo systemctl status nginx
```

Both should show "active (running)".

**Test in browser:**

```
http://18.188.82.227          → React frontend
http://18.188.82.227/admin/   → Django admin
http://18.188.82.227/api/     → API endpoints
```

---

## Phase 6: SSL Certificate Setup

### Prerequisites

**You need a domain name!** Let's Encrypt doesn't issue certificates for IP addresses.

**Example domain:** revize.live

### 6.1 Point Domain to EC2

In your domain registrar (GoDaddy, Namecheap, etc.), add DNS records:

```
Type: A
Name: @
Value: 18.188.82.227
TTL: 300

Type: A
Name: www
Value: 18.188.82.227
TTL: 300
```

**Wait 5-10 minutes for DNS propagation.**

**Test DNS:**

```bash
# On your local machine
nslookup revize.live
# Should return: 18.188.82.227
```

### 6.2 Update Nginx for Domain

```bash
sudo nano /etc/nginx/sites-available/revize
```

**Change the server_name line:**

```nginx
server {
    listen 80;
    server_name revize.live www.revize.live;  # Update this
    # ... rest stays the same
}
```

**Test and reload:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Install Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 6.4 Get SSL Certificate

```bash
sudo certbot --nginx -d revize.live -d www.revize.live
```

**Follow prompts:**
- Enter email for renewal notifications
- Agree to Terms of Service (A)
- Choose option 2: Redirect HTTP to HTTPS

Certbot will:
- ✅ Obtain SSL certificate
- ✅ Update Nginx configuration automatically
- ✅ Set up auto-renewal (cron job)

### 6.5 Update Environment for HTTPS

**Frontend:**

```bash
nano /opt/revize_application/revize_v2/spaced-repetition/frontend/.env.production
```

Update:
```env
VITE_API_BASE_URL=https://revize.live/api
```

Rebuild:
```bash
cd /opt/revize_application/revize_v2/spaced-repetition/frontend
npm run build
```

**Backend:**

```bash
nano /opt/revize_application/revize_v2/spaced-repetition/backend/.env.production
```

Update:
```env
ALLOWED_HOSTS=revize.live,www.revize.live,18.188.82.227
CORS_ALLOWED_ORIGINS=https://revize.live,https://www.revize.live

# Uncomment security settings
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True
```

Restart:
```bash
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

### 6.6 Verify SSL

Visit: `https://revize.live`

You should see:
- ✅ Padlock icon in browser
- ✅ Valid SSL certificate
- ✅ Automatic redirect from HTTP to HTTPS

**Test SSL configuration:**
https://www.ssllabs.com/ssltest/analyze.html?d=revize.live

### 6.7 Auto-Renewal

Certbot sets up automatic renewal. Test it:

```bash
sudo certbot renew --dry-run
```

Should complete successfully.

---

## Troubleshooting

### Common Issues

#### Issue 1: 502 Bad Gateway on /api/ or /admin/

**Cause:** Nginx can't connect to Gunicorn socket

**Solution:**

```bash
# Check Gunicorn status
sudo systemctl status gunicorn

# Check socket permissions
ls -la /opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn.sock
# Should show: srwxrwx--- (770)

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log

# Restart services
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

#### Issue 2: Gunicorn Won't Start

**Solution:**

```bash
# Check logs
sudo journalctl -u gunicorn -n 100 --no-pager

# Common fixes:
# 1. Check .env.production exists and is readable
ls -la /opt/revize_application/revize_v2/spaced-repetition/backend/.env.production

# 2. Test Django manually
cd /opt/revize_application/revize_v2/spaced-repetition/backend
source venv/bin/activate
python manage.py check

# 3. Test Gunicorn manually
gunicorn --config gunicorn_config.py spaced_repetition.wsgi:application
```

#### Issue 3: Database Connection Failed

**Solution:**

```bash
# Test connection
PGPASSWORD=Revizelive1998 psql -h revize-prod-db.cx82owo8yex5.us-east-2.rds.amazonaws.com -U postgres -d revize

# Check:
# - RDS is in "Available" state (AWS Console)
# - Security group allows EC2 connection
# - DATABASE_URL in .env.production is correct
```

#### Issue 4: Frontend Shows 404 or Blank Page

**Solution:**

```bash
# Check if dist folder exists
ls -la /opt/revize_application/revize_v2/spaced-repetition/frontend/dist/

# Rebuild if needed
cd /opt/revize_application/revize_v2/spaced-repetition/frontend
npm run build

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log

# Verify Nginx config
sudo nginx -t
```

#### Issue 5: Permission Denied Errors

**Solution:**

```bash
# Set proper ownership and permissions
sudo chown -R ubuntu:www-data /opt/revize_application/revize_v2
sudo chmod -R 755 /opt/revize_application/revize_v2

# Ensure www-data is in ubuntu group
sudo usermod -a -G ubuntu www-data

# Restart services
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

### Useful Commands

**View Logs:**

```bash
# Gunicorn logs
sudo tail -f /var/log/gunicorn/error.log
sudo tail -f /var/log/gunicorn/access.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Systemd logs
sudo journalctl -u gunicorn -f
sudo journalctl -u nginx -f
```

**Restart Services:**

```bash
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

**Check Service Status:**

```bash
sudo systemctl status gunicorn
sudo systemctl status nginx
```

---

## Maintenance

### Regular Updates

**System updates (monthly):**

```bash
sudo apt update
sudo apt upgrade -y
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

**Python dependencies (as needed):**

```bash
cd /opt/revize_application/revize_v2/spaced-repetition/backend
source venv/bin/activate
pip install --upgrade -r requirements.txt
sudo systemctl restart gunicorn
```

**Frontend updates (as needed):**

```bash
cd /opt/revize_application/revize_v2/spaced-repetition/frontend
npm update
npm run build
```

### Database Backups

**RDS Automated Backups:**
- Configured for 7-day retention
- Daily automated backups
- Point-in-time recovery available

**Manual backup:**

```bash
pg_dump -h revize-prod-db.cx82owo8yex5.us-east-2.rds.amazonaws.com -U postgres -d revize > backup_$(date +%Y%m%d).sql
```

### Monitoring

**Check disk space:**

```bash
df -h
```

**Check memory usage:**

```bash
free -h
```

**Check CPU usage:**

```bash
top
# Press 'q' to exit
```

**Check active connections:**

```bash
sudo netstat -tulpn | grep LISTEN
```

### Code Deployment Updates

**When you update code:**

```bash
# 1. SSH to server
ssh -i /Users/saiakhil/Documents/AWS_Related/revize-prod-key.pem ubuntu@18.188.82.227

# 2. Pull latest code
cd /opt/revize_application/revize_v2
git pull origin main

# 3. Update backend
cd spaced-repetition/backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn

# 4. Update frontend
cd ../frontend
npm install
npm run build

# 5. Restart Nginx
sudo systemctl restart nginx
```

---

## Security Best Practices

1. **Keep .env files private** - Never commit to Git
2. **Rotate credentials regularly**
   - Database password: Every 90 days
   - AWS keys: Every 90 days
   - API keys: As recommended by providers
3. **Monitor logs** for suspicious activity
4. **Keep system updated** - Apply security patches monthly
5. **Use strong passwords** - 20+ characters, mixed case, numbers, symbols
6. **Enable MFA** on AWS root account
7. **Backup regularly** - Test restore procedures
8. **Monitor costs** - Set up billing alerts in AWS
9. **Review security groups** - Ensure only necessary ports are open
10. **SSL certificate renewal** - Automatic via Certbot, but monitor for issues

---

## Cost Estimates

### Monthly Costs (us-east-2)

```
EC2 t3.small:           ~$15-20/month
RDS db.t3.micro:        ~$15/month
Storage (40 GB total):  ~$5/month
Data transfer:          ~$1-5/month (depending on traffic)
----------------------------------------
Total:                  ~$36-45/month
```

**Additional costs:**
- OpenAI API: Variable (based on usage)
- Google Gemini API: Free tier available
- Domain: ~$10-15/year
- S3 (if used): ~$1-5/month

### Cost Optimization Tips

1. **Use Reserved Instances** after validating usage (save 30-70%)
2. **Enable RDS storage autoscaling** instead of over-provisioning
3. **Use CloudFront CDN** for static assets (reduces data transfer)
4. **Set up billing alerts** at $10, $25, $50
5. **Monitor unused resources** regularly
6. **Use Gemini API** over OpenAI when possible (better free tier)
7. **Implement caching** to reduce API calls

---

## Performance Optimization

### Backend

**Gunicorn workers:**
- Current: 5 workers (for t3.small with 2 vCPU)
- Formula: `(2 × CPU cores) + 1`
- Adjust in `gunicorn_config.py` if needed

**Database connections:**
- Monitor with: `python manage.py dbshell` → `SELECT count(*) FROM pg_stat_activity;`
- Optimize queries with indexes
- Use Django Debug Toolbar in development

**Caching:**
```python
# In settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

### Frontend

**Already optimized:**
- Vite production build (minified, tree-shaken)
- Code splitting enabled
- Gzip compression via Nginx

**Further optimization:**
- Implement service workers for offline support
- Use lazy loading for routes
- Optimize images (WebP format)

---

## Support & Resources

### Documentation Links
- Django: https://docs.djangoproject.com/
- Nginx: https://nginx.org/en/docs/
- Gunicorn: https://docs.gunicorn.org/
- Let's Encrypt: https://letsencrypt.org/docs/
- AWS RDS: https://docs.aws.amazon.com/rds/
- AWS EC2: https://docs.aws.amazon.com/ec2/

### Quick Reference

**Important File Locations:**
```
Application:        /opt/revize_application/revize_v2/
Backend:           /opt/revize_application/revize_v2/spaced-repetition/backend/
Frontend:          /opt/revize_application/revize_v2/spaced-repetition/frontend/
Frontend Build:    /opt/revize_application/revize_v2/spaced-repetition/frontend/dist/
Nginx Config:      /etc/nginx/sites-available/revize
Gunicorn Config:   /opt/revize_application/revize_v2/spaced-repetition/backend/gunicorn_config.py
Systemd Service:   /etc/systemd/system/gunicorn.service
Env File:          /opt/revize_application/revize_v2/spaced-repetition/backend/.env.production
Logs:              /var/log/gunicorn/ and /var/log/nginx/
SSL Certificates:  /etc/letsencrypt/live/revize.live/ (if configured)
```

**Important Commands:**
```bash
# Service management
sudo systemctl {start|stop|restart|status} gunicorn
sudo systemctl {start|stop|restart|status} nginx

# View logs
sudo tail -f /var/log/gunicorn/error.log
sudo tail -f /var/log/nginx/error.log
sudo journalctl -u gunicorn -f

# Test configurations
sudo nginx -t
python manage.py check

# Database access
python manage.py dbshell
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] AWS account created and configured
- [ ] Domain name registered (if using SSL)
- [ ] API keys obtained (OpenAI, Google Gemini)
- [ ] Repository code ready
- [ ] Database password chosen
- [ ] EC2 key pair downloaded and secured

### Phase 1: Database
- [ ] RDS instance created in us-east-2
- [ ] Security group configured
- [ ] Database endpoint noted
- [ ] Connection tested

### Phase 2: EC2
- [ ] EC2 instance launched in us-east-2
- [ ] Security group configured
- [ ] SSH access tested
- [ ] System dependencies installed

### Phase 3: Backend
- [ ] Repository cloned
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] .env.production configured
- [ ] Migrations run successfully
- [ ] Superuser created
- [ ] Static files collected
- [ ] Gunicorn service running

### Phase 4: Frontend
- [ ] Environment configured
- [ ] Dependencies installed
- [ ] Production build successful
- [ ] Build files verified

### Phase 5: Nginx
- [ ] Configuration created
- [ ] Site enabled
- [ ] Permissions set
- [ ] Services restarted
- [ ] All URLs tested

### Phase 6: SSL (Optional)
- [ ] Domain DNS configured
- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] HTTPS redirect configured
- [ ] Environment files updated for HTTPS

### Post-Deployment
- [ ] All pages loading correctly
- [ ] API endpoints working
- [ ] Admin panel accessible
- [ ] Database operations working
- [ ] File uploads working (if applicable)
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Documentation updated

---

**Deployment completed successfully on November 9, 2025! 🎉**

**Access your application:**
- HTTP: http://18.188.82.227
- HTTPS: https://revize.live (after SSL setup)
- Admin: http://18.188.82.227/admin/

**For support or questions, refer to the troubleshooting section or AWS documentation.**
