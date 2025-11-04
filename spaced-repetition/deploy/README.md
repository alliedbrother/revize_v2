# 🚀 AWS EC2 Deployment Guide

This guide provides step-by-step instructions for deploying the Spaced Repetition application on AWS EC2.

## 📋 Prerequisites

- AWS EC2 instance (Ubuntu 22.04 LTS recommended)
- Domain name pointed to your EC2 instance (optional but recommended)
- SSH access to your EC2 instance

## 🏗️ Step-by-Step Deployment

### 1. Initial Server Setup

```bash
# Connect to your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv postgresql postgresql-contrib nginx git npm nodejs
```

### 2. Setup Database

```bash
# Run the database setup scriptp
chmod +x setup_database.sh
./setup_database.sh

# Update the password in the script before running
```

### 3. Create Environment Files

Create `.env` files for both backend and frontend:

**Backend (.env):**
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,your-ec2-ip,localhost

DATABASE_URL=postgresql://spaced_repetition_user:your_secure_password@localhost:5432/spaced_repetition_db

CORS_ALLOWED_ORIGINS=https://your-domain.com,http://your-ec2-ip

# Optional: AWS S3 Configuration
USE_S3=FALSE
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=your-s3-bucket-name
AWS_S3_REGION_NAME=us-west-2

# Google OAuth
GOOGLE_OAUTH2_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH2_CLIENT_SECRET=your-google-client-secret
```

**Frontend (.env):**
```env
VITE_API_BASE_URL=https://your-domain.com/api
VITE_API_URL=https://your-domain.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### 4. Deploy Application

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

### 5. Setup SSL (Optional but Recommended)

```bash
# Update the domain in ssl_setup.sh
chmod +x ssl_setup.sh
./ssl_setup.sh
```

## 🔧 Configuration Files

### Required Changes to Your Code

1. **Update nginx.conf**: Replace `your-domain.com` and `your-ec2-ip` with your actual values
2. **Update deploy.sh**: Replace `https://github.com/yourusername/revize_v2.git` with your repository URL
3. **Update ssl_setup.sh**: Replace `your-domain.com` with your actual domain
4. **Update production_settings.py**: Replace placeholder values with your actual configuration

## 🔍 Monitoring and Maintenance

### Check Application Health

```bash
# Make monitoring script executable
chmod +x monitoring.sh

# Run health check
./monitoring.sh
```

### Common Commands

```bash
# Restart Django service
sudo systemctl restart django

# Restart Nginx
sudo systemctl restart nginx

# View Django logs
sudo journalctl -u django -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check service status
sudo systemctl status django
sudo systemctl status nginx
sudo systemctl status postgresql
```

## 📁 Directory Structure

```
/home/ubuntu/revize_v2/
├── deploy/                 # Deployment scripts
├── spaced-repetition/
│   ├── backend/           # Django backend
│   └── frontend/          # React frontend (built to dist/)
└── venv/                  # Python virtual environment
```

## 🔐 Security Considerations

1. **Firewall**: Configure UFW or AWS Security Groups
2. **SSL**: Always use HTTPS in production
3. **Database**: Use strong passwords and limit access
4. **Environment Variables**: Never commit sensitive data to version control
5. **Regular Updates**: Keep system packages updated

## 🐛 Troubleshooting

### Common Issues

1. **Django service fails to start**
   - Check logs: `sudo journalctl -u django -f`
   - Verify virtual environment and dependencies
   - Check environment variables

2. **Nginx configuration errors**
   - Test config: `sudo nginx -t`
   - Check file permissions
   - Verify file paths

3. **Database connection issues**
   - Check PostgreSQL service: `sudo systemctl status postgresql`
   - Verify database credentials
   - Check network connectivity

4. **Frontend not loading**
   - Verify React build completed successfully
   - Check Nginx configuration
   - Verify static file paths

## 📞 Support

For additional support, check the application logs and ensure all environment variables are correctly set.

## 🔄 Continuous Deployment

To set up automatic deployments:

1. Use GitHub Actions or similar CI/CD tools
2. Create deployment webhooks
3. Implement blue-green deployments for zero downtime

## 📈 Performance Optimization

1. **Database**: Use connection pooling
2. **Caching**: Implement Redis for session and query caching
3. **CDN**: Use CloudFront for static assets
4. **Monitoring**: Set up CloudWatch or similar monitoring tools 