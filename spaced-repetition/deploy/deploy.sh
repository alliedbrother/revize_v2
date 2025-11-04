#!/bin/bash

# Deployment script for AWS EC2
# Run this script on your EC2 instance

set -e

echo "🚀 Starting deployment process..."

# Set variables
PROJECT_DIR="/home/ubuntu/revize_v2"
VENV_DIR="$PROJECT_DIR/venv"
BACKEND_DIR="$PROJECT_DIR/spaced-repetition/backend"
FRONTEND_DIR="$PROJECT_DIR/spaced-repetition/frontend"

# Create project directory
echo "📁 Setting up project directory..."
mkdir -p $PROJECT_DIR

# Clone repository (if not already cloned)
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "📦 Cloning repository..."
    git clone https://github.com/alliedbrother/revize_v2.git $PROJECT_DIR
fi

# Update repository
echo "🔄 Updating repository..."
cd $PROJECT_DIR
git pull origin main

# Setup Python virtual environment
echo "🐍 Setting up Python virtual environment..."
python3 -m venv $VENV_DIR
source $VENV_DIR/bin/activate

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd $BACKEND_DIR
pip install -r requirements.txt

# Setup database
echo "🗄️ Setting up database..."
python manage.py migrate
python manage.py collectstatic --noinput

# Build frontend
echo "⚛️ Building frontend..."
cd $FRONTEND_DIR
npm install
npm run build

# Setup Nginx to serve frontend
echo "🌐 Setting up Nginx..."
sudo cp $PROJECT_DIR/deploy/nginx.conf /etc/nginx/sites-available/revize
sudo ln -sf /etc/nginx/sites-available/revize /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup systemd service for Django
echo "🔧 Setting up Django service..."
sudo cp $PROJECT_DIR/deploy/django.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable django
sudo systemctl restart django

echo "✅ Deployment completed successfully!"
echo "🌍 Your app should be accessible at: http://your-server-ip" 