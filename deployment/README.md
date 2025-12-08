# Deployment Configuration

This directory contains all production deployment configurations and scripts.

## Directory Structure

```
deployment/
├── README.md                      # This file
├── ecosystem.config.js            # PM2 process manager config (traditional deployment)
├── deploy.sh                      # Traditional deployment script
├── backup-db.sh                   # Database backup script
├── health-check.sh                # Service health monitoring
├── setup-docker.sh                # Docker production setup script
├── nginx/                         # Nginx configurations
│   ├── nginx.conf                 # Main nginx config
│   ├── conf.d/
│   │   ├── chat-app.conf          # Single project config
│   │   └── multi-project.conf.example  # Multi-project template
│   └── ssl/                       # SSL certificates (gitignored)
├── backups/                       # Database backups (gitignored)
└── logs/                          # Application logs (gitignored)
    └── nginx/                     # Nginx logs
```

## Deployment Methods

### Method 1: Docker Compose (Recommended)

**Best for:** Production deployments, multi-project VPS, isolated environments

```bash
# Quick setup
./deployment/setup-docker.sh

# Or manual
docker compose -f docker-compose.prod.yml up -d
```

**Documentation:** [docs/DOCKER-DEPLOYMENT.md](../docs/DOCKER-DEPLOYMENT.md)

**Pros:**
- Complete isolation between projects
- Easy to scale and manage
- Consistent across environments
- Simple rollback

**Cons:**
- Higher resource usage
- Requires Docker knowledge

### Method 2: PM2 + Nginx (Traditional)

**Best for:** Single project, direct deployment, lower resource usage

```bash
# Deploy
./deployment/deploy.sh
```

**Documentation:** [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)

**Pros:**
- Lower resource usage
- Faster startup
- Direct file access
- Simpler debugging

**Cons:**
- Manual dependency management
- Less isolation
- More manual configuration

## Configuration Files

### PM2 Configuration (ecosystem.config.js)

Used for traditional PM2 deployments:

```javascript
{
  name: 'chat-app-backend',
  script: 'dist/src/index.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production'
  }
}
```

### Nginx Configurations

#### Single Project (nginx/conf.d/chat-app.conf)

Standard configuration for a single application:
- HTTP → HTTPS redirect
- WebSocket support
- Static file caching
- Security headers
- Rate limiting

#### Multi-Project (nginx/conf.d/multi-project.conf.example)

Template for hosting multiple projects:
- Subdomain-based routing
- Shared Nginx proxy
- Per-project SSL certificates
- Isolated upstream services

**Usage:**
```bash
cp nginx/conf.d/multi-project.conf.example nginx/conf.d/projects.conf
nano nginx/conf.d/projects.conf  # Configure your domains
```

## Scripts

### setup-docker.sh

Automated Docker production setup:
- Validates environment configuration
- Creates necessary directories
- Builds Docker images
- Starts all services
- Performs health checks

**Usage:**
```bash
chmod +x deployment/setup-docker.sh
./deployment/setup-docker.sh
```

### deploy.sh

Traditional deployment script for PM2:
- Pulls latest code
- Installs dependencies
- Builds application
- Runs migrations
- Restarts services
- Health check

**Usage:**
```bash
# Update REPO_URL in script first
nano deployment/deploy.sh

# Run deployment
./deployment/deploy.sh
```

### backup-db.sh

Database backup script:
- Creates compressed SQL dump
- Timestamps backups
- Cleans old backups (7-day retention)
- Works with both Docker and traditional deployments

**Usage:**
```bash
# Docker deployment
docker compose -f docker-compose.prod.yml exec postgres /backups/backup-db.sh

# Traditional deployment
./deployment/backup-db.sh
```

**Automate with cron:**
```bash
# Daily backup at 2 AM
0 2 * * * /var/www/chat-app/deployment/backup-db.sh
```

### health-check.sh

Service health monitoring:
- Checks backend `/api/health` endpoint
- Auto-restart on failure (3 retries)
- Logs results
- Can be run via cron

**Usage:**
```bash
./deployment/health-check.sh
```

**Automate with cron:**
```bash
# Check every 5 minutes
*/5 * * * * /var/www/chat-app/deployment/health-check.sh
```

## SSL/TLS Setup

### Let's Encrypt (Production)

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy to deployment
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem deployment/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem deployment/nginx/ssl/
sudo chown $USER:$USER deployment/nginx/ssl/*.pem
```

### Auto-Renewal

```bash
# Add to crontab
sudo crontab -e

# Docker deployment
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /var/www/chat-app/deployment/nginx/ssl/ && docker compose -f /var/www/chat-app/docker-compose.prod.yml restart nginx

# Traditional deployment
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /var/www/chat-app/deployment/nginx/ssl/ && sudo systemctl reload nginx
```

## Environment Variables

### Docker Deployment

Create `.env.prod` in root directory:

```env
# Database
POSTGRES_USER=chatapp_user
POSTGRES_PASSWORD=<STRONG_PASSWORD>
POSTGRES_DB=chat_app_prod

# Backend
JWT_SECRET=<STRONG_SECRET>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://yourdomain.com

# Frontend
VITE_API_BASE_URL=https://yourdomain.com
VITE_WS_URL=wss://yourdomain.com

# SSL
DOMAIN=yourdomain.com
LETSENCRYPT_EMAIL=your-email@example.com
```

### Traditional Deployment

Create `packages/backend/.env`:

```env
NODE_ENV=production
PORT=3001
HOST=localhost
DATABASE_URL=postgresql://user:pass@localhost:5432/chat_app_prod
JWT_SECRET=<STRONG_SECRET>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://yourdomain.com
```

## Multi-Project VPS

### Architecture

```
VPS
├── nginx-proxy (shared)
│   └── Routes to all projects
├── chat-app
│   ├── chat-app-network
│   ├── backend container
│   ├── frontend container
│   └── postgres container
├── project2
│   └── ...
└── project3
    └── ...
```

### Setup Steps

1. **Deploy individual projects**
   ```bash
   cd /var/www/chat-app
   docker compose -f docker-compose.prod.yml up -d
   ```

2. **Create shared nginx proxy**
   ```bash
   mkdir -p /var/www/nginx-proxy
   # Copy configurations from deployment/nginx/
   ```

3. **Configure multi-project routing**
   ```bash
   cp deployment/nginx/conf.d/multi-project.conf.example \
      /var/www/nginx-proxy/conf.d/projects.conf
   nano /var/www/nginx-proxy/conf.d/projects.conf
   ```

4. **Start shared nginx**
   ```bash
   cd /var/www/nginx-proxy
   docker compose up -d
   ```

See [docs/DOCKER-DEPLOYMENT.md](../docs/DOCKER-DEPLOYMENT.md#multi-project-vps-setup) for details.

## Monitoring

### View Logs

**Docker:**
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Nginx logs
tail -f deployment/logs/nginx/access.log
tail -f deployment/logs/nginx/error.log
```

**PM2:**
```bash
pm2 logs chat-app-backend
pm2 status
```

### Resource Usage

```bash
# Docker
docker stats

# System
htop
free -h
df -h
```

## Troubleshooting

### Service Won't Start

```bash
# Docker
docker compose -f docker-compose.prod.yml logs [service]
docker compose -f docker-compose.prod.yml ps

# PM2
pm2 logs chat-app-backend
pm2 describe chat-app-backend
```

### Database Connection Failed

```bash
# Docker
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U chatapp_user chat_app_prod

# Traditional
psql -U chatapp_user -d chat_app_prod -h localhost
```

### Nginx Configuration Error

```bash
# Docker
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Traditional
sudo nginx -t
```

### Port Already in Use

```bash
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service
sudo systemctl stop apache2
```

## Security Checklist

- [ ] Strong passwords and secrets
- [ ] SSL/TLS enabled
- [ ] Firewall configured (ufw)
- [ ] Fail2ban installed
- [ ] Database not exposed to internet
- [ ] Regular backups configured
- [ ] Automated security updates
- [ ] SSH key-based authentication only
- [ ] Non-root user for deployment
- [ ] Environment files in .gitignore

## Maintenance Tasks

### Daily
- Check service health
- Monitor resource usage

### Weekly
- Review logs for errors
- Check backup integrity
- Update dependencies

### Monthly
- Security updates
- Certificate renewal check
- Capacity planning review

## Support

For detailed guides, see:
- [DOCKER-DEPLOYMENT.md](../docs/DOCKER-DEPLOYMENT.md) - Docker deployment guide
- [DEPLOYMENT-QUICKSTART.md](../docs/DEPLOYMENT-QUICKSTART.md) - Quick reference
- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Traditional PM2 deployment
- [DOCKER-SETUP.md](../docs/DOCKER-SETUP.md) - Local Docker setup
