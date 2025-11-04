# 🚀 Full Deployment & Configuration Guide for revize.live

---

## 1. **Initial Server Setup**

**Connect to your EC2 instance:**
```bash
ssh -i your-key.pem ubuntu@18.227.190.69
```

**Update and install required packages:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx git nodejs npm
```

---

## 2. **Clone Your Project**

```bash
git clone https://github.com/alliedbrother/revize_v2.git
cd revize_v2
```

---

## 3. **Backend Setup (Django)**

### **A. Create and activate a virtual environment:**
```bash
cd spaced-repetition/backend
python3 -m venv venv
source venv/bin/activate
```

### **B. Install Python dependencies:**
```bash
pip install -r requirements.txt
```

### **C. Create/Edit the `.env` file:**
```bash
nano .env
```
**Add/Update these values:**
```env
SECRET_KEY=your-django-secret-key
DEBUG=False
ALLOWED_HOSTS=revize.live,www.revize.live,18.227.190.69,172.31.0.215,localhost,127.0.0.1

# No DATABASE_URL needed for SQLite
CORS_ALLOWED_ORIGINS=https://revize.live,https://www.revize.live,http://18.227.190.69,http://172.31.0.215,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000

USE_S3=FALSE

GOOGLE_OAUTH2_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH2_CLIENT_SECRET=your-google-client-secret
```
- **Generate a Django secret key**: You can use [Djecrety](https://djecrety.ir/) or run `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`

### **D. Run migrations and collect static files:**
```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

---

## 4. **Frontend Setup (React/Vite)**

```bash
cd ../frontend
```

### **A. Install Node dependencies:**
```bash
npm install
```

### **B. Edit the `.env` file:**
```bash
nano .env
```
**Add/Update these values:**
```env
VITE_API_BASE_URL=https://revize.live/api
VITE_API_URL=https://revize.live
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```
- For initial testing (before DNS is set up), you can use:
  ```env
  VITE_API_BASE_URL=http://18.227.190.69/api
  VITE_API_URL=http://18.227.190.69
  ```

### **C. Build the frontend:**
```bash
rm -rf dist/
npm run build
```

### **D. Deploy frontend build to web directory:**
```bash
sudo mkdir -p /var/www/revize
sudo cp -r dist/* /var/www/revize/
sudo chown -R www-data:www-data /var/www/revize/
sudo chmod -R 755 /var/www/revize/
```

---

## 5. **File & Directory Permissions (IMPORTANT)**

**You must ensure correct permissions for all directories and files that nginx or your build process needs to access.**

### **A. Grant execute permission to parent directories:**
```bash
sudo chmod +x /home/ubuntu/
sudo chmod +x /home/ubuntu/revize_v2/
sudo chmod +x /home/ubuntu/revize_v2/spaced-repetition/
sudo chmod +x /home/ubuntu/revize_v2/spaced-repetition/frontend/
```

### **B. For frontend build process:**
- Before running `npm run build`, make sure you own the directory:
```bash
sudo chown -R ubuntu:ubuntu /home/ubuntu/revize_v2/spaced-repetition/frontend/
```
- After building, set permissions for nginx:
```bash
sudo chown -R www-data:www-data /var/www/revize/
sudo chmod -R 755 /var/www/revize/
```

### **C. For static and media files:**
```bash
sudo chown -R www-data:www-data /home/ubuntu/revize_v2/spaced-repetition/backend/staticfiles/
sudo chmod -R 755 /home/ubuntu/revize_v2/spaced-repetition/backend/staticfiles/
sudo chown -R www-data:www-data /home/ubuntu/revize_v2/spaced-repetition/backend/media/
sudo chmod -R 755 /home/ubuntu/revize_v2/spaced-repetition/backend/media/
```

---

## 6. **Nginx Configuration**

### **A. Edit/Create Nginx site config:**
```bash
sudo nano /etc/nginx/sites-available/revize
```
**Paste this config:**
```nginx
server {
    listen 80;
    server_name revize.live www.revize.live 18.227.190.69;
    return 301 https://revize.live$request_uri;
}

server {
    listen 443 ssl http2;
    server_name revize.live www.revize.live;

    ssl_certificate /etc/letsencrypt/live/revize.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/revize.live/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 10M;

    location / {
        root /var/www/revize;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
        proxy_buffering off;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    location /static/ {
        alias /home/ubuntu/revize_v2/spaced-repetition/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /home/ubuntu/revize_v2/spaced-repetition/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types
        application/javascript
        application/json
        text/css
        text/javascript
        text/plain
        text/xml
        application/xml
        application/xml+rss;
}
```

### **B. Enable the site and restart nginx:**
```bash
sudo ln -sf /etc/nginx/sites-available/revize /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. **SSL Certificate (HTTPS) with Let's Encrypt**

**Make sure your domain is pointed to your server IP before this step!**

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo systemctl stop nginx
sudo certbot certonly --standalone -d revize.live -d www.revize.live
sudo systemctl start nginx
```
- Certificates will be placed in `/etc/letsencrypt/live/revize.live/`
- Nginx config above already references these paths

**Set up auto-renewal:**
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 8. **Django as a Systemd Service**

**Create the service file:**
```bash
sudo nano /etc/systemd/system/django.service
```
**Paste:**
```ini
[Unit]
Description=Django Gunicorn Application Server
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/revize_v2/spaced-repetition/backend
ExecStart=/home/ubuntu/revize_v2/spaced-repetition/backend/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 spaced_repetition.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start the service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable django
sudo systemctl start django
```

---

## 9. **Testing and Troubleshooting**

**Check services:**
```bash
sudo systemctl status django
sudo systemctl status nginx
```

**Check logs:**
```bash
sudo journalctl -u django -f
sudo tail -f /var/log/nginx/error.log
```

**Test endpoints:**
- Frontend: https://revize.live
- Admin: https://revize.live/admin/
- API: https://revize.live/api/

---

## 10. **Google OAuth Setup**

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create OAuth 2.0 credentials
- Set **Authorized JavaScript origins**:  
  `https://revize.live`, `https://www.revize.live`
- Set **Authorized redirect URIs**:  
  `https://revize.live/accounts/google/login/callback/`
- Copy the client ID and secret into both backend and frontend `.env` files

---

## 11. **Summary of File Changes**

| File | What to Edit |
|------|--------------|
| `.env` (backend) | SECRET_KEY, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, GOOGLE_OAUTH2_CLIENT_ID, GOOGLE_OAUTH2_CLIENT_SECRET |
| `.env` (frontend) | VITE_API_BASE_URL, VITE_API_URL, VITE_GOOGLE_CLIENT_ID |
| `nginx.conf` | server_name, SSL cert paths, root path for frontend |
| `django.service` | WorkingDirectory, ExecStart path |

---

## 12. **Common Commands**

```bash
# Restart services
sudo systemctl restart django
sudo systemctl restart nginx

# Check status
sudo systemctl status django
sudo systemctl status nginx

# View logs
sudo journalctl -u django -f
sudo tail -f /var/log/nginx/error.log
```

---

## ⚠️ **Permissions Troubleshooting Tips**
- If you see `Permission denied` errors, always check directory and file permissions.
- Use `ls -la` to inspect permissions and ownership.
- Use `sudo chown` and `sudo chmod` as shown above to fix issues.
- Nginx (www-data) must be able to traverse all parent directories to serve static files.
- The build user (ubuntu) must own the frontend directory before running `npm run build`.

---

## 🎉 **Your app is now production-ready and live at https://revize.live!**

If you follow these steps and update the specified files, your deployment will be robust, secure, and maintainable. 