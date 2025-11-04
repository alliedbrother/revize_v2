#!/bin/bash

# SSL setup script using Let's Encrypt
# Run this script after domain is pointed to your EC2 instance

set -e

DOMAIN="revize.live"

echo "🔐 Setting up SSL with Let's Encrypt..."

# Install certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain SSL certificate
sudo certbot certonly --standalone -d $DOMAIN

# Update nginx configuration for SSL
sudo cp /etc/nginx/sites-available/revize /etc/nginx/sites-available/revize.backup

# Create SSL-enabled nginx config
sudo tee /etc/nginx/sites-available/revize > /dev/null << 'EOF'
server {
    listen 80;
    server_name revize.live;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name revize.live;    
    
    ssl_certificate /etc/letsencrypt/live/revize.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/revize.live/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Serve React frontend
    location / {
        root /home/ubuntu/revize_v2/spaced-repetition/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests to Django
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }
    
    # Proxy admin requests to Django
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Serve Django static files
    location /static/ {
        alias /home/ubuntu/revize_v2/spaced-repetition/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Handle media files
    location /media/ {
        alias /home/ubuntu/revize_v2/spaced-repetition/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Gzip compression
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
EOF

# Test nginx configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx

# Setup auto-renewal
sudo systemctl enable certbot.timer

echo "✅ SSL setup completed!"
echo "🌍 Your app should now be accessible at: https://$DOMAIN" 