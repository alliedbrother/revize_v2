# 🚀 Final Configuration Guide for revize.live

## 📋 Your Server Details
- **Domain**: revize.live, www.revize.live
- **Public IP**: 18.227.190.69
- **Private IP**: 172.31.0.215
- **Database**: SQLite (USE_S3=FALSE)

## 📝 Configuration Files to Update

### 1. Backend .env file
**Location**: `/home/ubuntu/revize_v2/spaced-repetition/backend/.env`

```env
# Django Core Settings
SECRET_KEY=your-secret-key-here-generate-a-new-one
DEBUG=False
ALLOWED_HOSTS=revize.live,www.revize.live,18.227.190.69,172.31.0.215,localhost,127.0.0.1

# SQLite Database (NO DATABASE_URL needed)
# Django will automatically use SQLite when no DATABASE_URL is provided

# CORS Settings
CORS_ALLOWED_ORIGINS=https://revize.live,https://www.revize.live,http://18.227.190.69,http://172.31.0.215,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000

# Static Files (using WhiteNoise, not S3)
USE_S3=FALSE

# Google OAuth (get these from Google Cloud Console)
GOOGLE_OAUTH2_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH2_CLIENT_SECRET=your-google-client-secret
```

### 2. Frontend .env file
**Location**: `/home/ubuntu/revize_v2/spaced-repetition/frontend/.env`

```env
# API Configuration (Primary domain)
VITE_API_BASE_URL=https://revize.live/api
VITE_API_URL=https://revize.live

# Google OAuth (same client ID as backend)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### 3. For Testing (if domain isn't working yet)
If your domain isn't pointed to the server yet, use IP temporarily:

```env
# Temporary IP-based configuration
VITE_API_BASE_URL=http://18.227.190.69/api
VITE_API_URL=http://18.227.190.69
```

## 🚀 Deployment Steps

### 1. Connect to your EC2 instance
```bash
ssh -i your-key.pem ubuntu@18.227.190.69
```

### 2. Run the deployment script
```bash
git clone https://github.com/alliedbrother/revize_v2.git
cd revize_v2/spaced-repetition/deploy
chmod +x deploy_sqlite.sh
./deploy_sqlite.sh
```

### 3. Update the auto-generated .env files
- Edit backend .env: `nano /home/ubuntu/revize_v2/spaced-repetition/backend/.env`
- Edit frontend .env: `nano /home/ubuntu/revize_v2/spaced-repetition/frontend/.env`
- Add your Google OAuth credentials

### 4. Restart services
```bash
sudo systemctl restart django
sudo systemctl restart nginx
```

### 5. Setup SSL (after domain is pointed to server)
```bash
chmod +x ssl_setup.sh
./ssl_setup.sh
```

## 🌍 Access Your Application

### Without SSL (Initial testing)
- **Frontend**: http://18.227.190.69
- **Admin**: http://18.227.190.69/admin
- **API**: http://18.227.190.69/api

### With Domain (After DNS setup)
- **Frontend**: https://revize.live
- **Admin**: https://revize.live/admin
- **API**: https://revize.live/api

## 🔧 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized URLs:
   - **JavaScript origins**: https://revize.live, https://www.revize.live, http://18.227.190.69
   - **Redirect URIs**: https://revize.live/accounts/google/login/callback/

## 🔍 Troubleshooting

### Check service status
```bash
sudo systemctl status django
sudo systemctl status nginx
```

### View logs
```bash
sudo journalctl -u django -f
sudo tail -f /var/log/nginx/error.log
```

### Test health
```bash
chmod +x monitoring.sh
./monitoring.sh
```

## 📊 Database Information

- **Type**: SQLite
- **Location**: `/home/ubuntu/revize_v2/spaced-repetition/backend/db.sqlite3`
- **Backup**: Run `./backup_sqlite.sh` periodically

## 🔐 Security Notes

1. **Change default admin password** after first login
2. **Generate secure SECRET_KEY** (script does this automatically)
3. **Point domain to server** before running SSL setup
4. **Update Google OAuth URLs** with production domains

Your configuration is now ready for deployment! 🎉 