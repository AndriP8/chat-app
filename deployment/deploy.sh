#!/bin/bash
set -e  # Exit on error

# Configuration
APP_DIR="/var/www/chat-app"
REPO_URL="https://github.com/yourusername/chat-app.git"  # Update this
BRANCH="main"
BACKEND_DIR="$APP_DIR/packages/backend"
FRONTEND_DIR="$APP_DIR/packages/frontend"
LOG_DIR="$APP_DIR/logs"

echo "=== Chat App Deployment Script ==="
echo "Started at: $(date)"

# Create necessary directories
mkdir -p "$LOG_DIR"

# Navigate to app directory
cd "$APP_DIR"

# Pull latest code
echo "[1/8] Pulling latest code from $BRANCH..."
git fetch origin
git reset --hard origin/$BRANCH

# Install dependencies
echo "[2/8] Installing dependencies..."
pnpm install --frozen-lockfile

# Run type checking
echo "[3/8] Running type checks..."
pnpm type-check

# Build backend
echo "[4/8] Building backend..."
cd "$BACKEND_DIR"
pnpm build

# Run database migrations
echo "[5/8] Running database migrations..."
pnpm db:migrate

# Build frontend
echo "[6/8] Building frontend..."
cd "$FRONTEND_DIR"
pnpm build

# Restart backend service
echo "[7/8] Restarting backend service..."
pm2 restart chat-app-backend || pm2 start "$APP_DIR/deployment/ecosystem.config.js"

# Reload Nginx
echo "[8/8] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Health check
echo "Waiting 5 seconds for backend to start..."
sleep 5

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Deployment successful! Backend health check passed."
else
    echo "❌ Warning: Backend health check failed (status: $HEALTH_STATUS)"
    echo "Check logs: pm2 logs chat-app-backend"
    exit 1
fi

echo "Deployment completed at: $(date)"
echo ""
echo "📊 Service Status:"
pm2 status chat-app-backend
