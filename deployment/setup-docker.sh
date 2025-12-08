#!/bin/bash
# ===========================================
# Docker Production Setup Script
# ===========================================
# This script helps set up the production Docker environment

set -e

echo "=== Chat App Docker Production Setup ==="
echo ""

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ Error: .env.prod file not found!"
    echo ""
    echo "Please create .env.prod from .env.prod.example:"
    echo "  cp .env.prod.example .env.prod"
    echo "  nano .env.prod  # Edit with your values"
    echo ""
    exit 1
fi

# Load environment variables
set -a
source .env.prod
set +a

echo "✅ Environment variables loaded"
echo ""

# Create necessary directories
echo "Creating directories..."
mkdir -p deployment/nginx/ssl
mkdir -p deployment/logs
mkdir -p deployment/logs/nginx
mkdir -p deployment/backups
echo "✅ Directories created"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Build and start services
echo "Building Docker images (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check service health
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Configure SSL certificates (see docs/DEPLOYMENT.md)"
echo "2. Update deployment/nginx/conf.d/chat-app.conf with your domain"
echo "3. Restart nginx: docker compose -f docker-compose.prod.yml restart nginx"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker compose -f docker-compose.prod.yml down"
echo "  - Restart service: docker compose -f docker-compose.prod.yml restart <service>"
echo "  - Execute shell: docker compose -f docker-compose.prod.yml exec <service> sh"
echo ""
