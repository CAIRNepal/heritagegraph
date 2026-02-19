# 🚀 HeritageGraph Deployment Guide

This guide provides comprehensive instructions for deploying HeritageGraph in development and production environments using Docker and Docker Compose.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Services Overview](#services-overview)
- [Troubleshooting](#troubleshooting)
- [Monitoring & Logs](#monitoring--logs)
- [Security Considerations](#security-considerations)
- [Backup & Recovery](#backup--recovery)
- [Migration Checklist: Keycloak → Google OAuth](#-migration-checklist-keycloak--google-oauth)

---

## Prerequisites

### System Requirements

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **RAM**: 4GB minimum (8GB+ recommended)
- **Disk Space**: 20GB minimum
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2

### Check Installation

```bash
docker --version
docker-compose --version
```

---

## Quick Start (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/CAIRNepal/heritagegraph.git
cd heritagegraph
```

### 2. Create Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your values (defaults are fine for development)
nano .env
```

**Minimum required changes for development:**
- Leave most defaults as-is
- Change `POSTGRES_PASSWORD` and `DJANGO_SECRET_KEY` to something unique

### 3. Build and Start Services

```bash
# Build and start all services
docker-compose up -d --build

# Or use the background flag to run in the background
docker-compose up --build
```

### 4. Verify Services

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Access the Application

- **Frontend**: http://localhost or http://frontend.localhost
- **Backend API**: http://backend.localhost/api
- **Traefik Dashboard**: http://traefik.localhost:8080

### Default Credentials (Development Only)

```
Django Admin:
  Username: admin
  Password: changeme123!
  Email: admin@example.com
```

### 6. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## Production Deployment

### 1. Prerequisites

- A server with Docker and Docker Compose installed
- A domain name (e.g., `example.com`)
- SSL certificate (Let's Encrypt recommended)
- Firewall configured to allow ports 80, 443

### 2. Prepare Environment

```bash
# SSH into your production server
ssh user@your-server.com

# Clone repository
git clone https://github.com/CAIRNepal/heritagegraph.git
cd heritagegraph

# Copy and customize environment
cp .env.example .env
nano .env
```

### 3. Essential Production Configuration

**Edit `.env` with production values:**

```bash
# Environment
ENVIRONMENT=production
DEBUG=False

# Security - Generate these securely
DJANGO_SECRET_KEY=$(openssl rand -base64 50)
POSTGRES_PASSWORD=$(openssl rand -base64 20)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Network
ALLOWED_HOSTS=example.com,www.example.com,api.example.com
DOMAIN=example.com
PRODUCTION_URL=https://example.com

# Google OAuth (get from https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# API Configuration
NEXT_PUBLIC_API_URL=https://api.example.com
```

### 4. Create Production Docker Compose Override

Create `docker-compose.prod.yml`:

```bash
# This file will override development settings
cat > docker-compose.prod.yml << 'EOF'
version: "3.9"

services:
  traefik:
    restart: always
    command:
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=proxy"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/etc/traefik/acme/acme.json"
    labels:
      - "traefik.http.routers.dashboard.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=admin:${TRAEFIK_DASHBOARD_PASSWORD}"
    ports:
      - "443:443"
    volumes:
      - ./infra/traefik/acme:/etc/traefik/acme

  backend:
    environment:
      DJANGO_SETTINGS_MODULE: heritage_graph.settings.production
      DEBUG: "False"
    restart: always

  frontend:
    restart: always
EOF
```

### 5. Deploy to Production

```bash
# Ensure .env is properly configured
cat .env | grep -E "ENVIRONMENT|DEBUG|DOMAIN"

# Build images (optional, can use pre-built images)
docker-compose build

# Start services with production override
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify services
docker-compose ps

# Check logs
docker-compose logs -f traefik backend
```

### 6. Configure Firewall (Example: UFW)

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### 7. Setup Automatic Backups

Create a backup script at `/home/user/backup-heritage.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/heritage"
mkdir -p "$BACKUP_DIR"

# Backup database
docker-compose exec -T postgres pg_dump -U heritage_user heritage_db | gzip > "$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +7 -delete

echo "Backup completed"
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /home/user/backup-heritage.sh >> /var/log/heritage-backup.log 2>&1
```

---

## Configuration

### Environment Variables

See `.env.example` for all available variables. Key sections:

#### Django Configuration
```env
DJANGO_SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=example.com,www.example.com
```

#### Database
```env
DB_NAME=heritage_db
DB_USER=heritage_user
DB_PASSWORD=your-db-password
DB_HOST=postgres
```

#### Google OAuth
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
```

#### Frontend
```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Database Migration

To run migrations manually:

```bash
# Apply migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

---

## Services Overview

### 1. **PostgreSQL** (`postgres:16-alpine`)
- Database for Django backend
- Port: 5432 (internal only)
- Volume: `postgres-data:/var/lib/postgresql/data`

### 2. **Traefik** (Reverse Proxy)
- Routes all HTTP/HTTPS traffic
- Dashboard: `http://traefik.localhost:8080`
- Ports: 80 (HTTP), 443 (HTTPS), 8080 (Dashboard)

### 3. **Backend** (Django REST Framework)
- API server
- Port: 8000 (internal, exposed via Traefik)
- URL: `http://backend.localhost` or `https://api.example.com`
- Health check: `GET /health/`

### 4. **Frontend** (Next.js UI)
- Main application
- Port: 3000 (internal, exposed via Traefik)
- URL: `http://localhost` or `https://example.com`

### 5. **Landing Page** (Next.js)
- Marketing/landing page
- Port: 3000 (internal)
- URL: `http://landing.localhost`

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs backend
docker-compose logs postgres

# Restart services
docker-compose restart

# Rebuild images
docker-compose down
docker-compose up --build
```

### Database Connection Errors

```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Check database connectivity
docker-compose exec postgres psql -U heritage_user -d heritage_db -c "SELECT 1;"

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Port Already in Use

```bash
# Find what's using port 80
lsof -i :80

# Kill process or change Traefik port in docker-compose.yml
```

### Frontend Not Loading

```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend
docker-compose up frontend

# Clear Next.js cache
docker-compose exec frontend rm -rf .next
```

### Google OAuth Not Working

```bash
# Verify GOOGLE_CLIENT_ID is set
docker-compose exec backend printenv GOOGLE_CLIENT_ID
docker-compose exec frontend printenv GOOGLE_CLIENT_ID

# Check NextAuth logs
docker-compose logs frontend | grep -i "auth\|oauth\|google"

# Verify redirect URIs match Google Cloud Console config
# Development: http://localhost:3000/api/auth/callback/google
# Production: https://example.com/api/auth/callback/google
```

### Static Files Not Serving

```bash
# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput

# Check static volume
docker volume inspect heritage_backend-static
```

---

## Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# With timestamps
docker-compose logs -f --timestamps backend
```

### Health Checks

```bash
# Check all services
docker-compose ps

# Manual health check
curl http://backend.localhost/health/
curl http://frontend.localhost
```

### Database Monitoring

```bash
# Connect to database
docker-compose exec postgres psql -U heritage_user -d heritage_db

# Inside psql:
\dt                    # List tables
SELECT COUNT(*) FROM django_migrations;  # Check migrations
\q                     # Quit
```

### Container Resource Usage

```bash
# Monitor CPU and memory
docker stats

# View specific container
docker stats heritage-backend
```

---

## Security Considerations

### 1. Change Default Passwords

Always change these in production:
- Database password
- Django superuser password
- Traefik dashboard password
- `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)

### 2. Enable HTTPS

In `.env`:
```env
ACME_ENABLED=true
ACME_EMAIL=admin@example.com
```

### 3. Set Strong Secret Key

```bash
# Generate secure key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4. Configure CORS Properly

Update `CORS_ALLOWED_ORIGINS` to only include your domain:
```env
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

### 5. Use Environment Variables for Secrets

Never commit `.env` to version control. Use `.gitignore`:
```bash
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"
```

### 6. Regular Updates

```bash
# Update base images
docker-compose pull

# Rebuild with latest
docker-compose build --no-cache
```

### 7. Monitor Logs for Security Issues

```bash
# Check for failed login attempts
docker-compose logs frontend | grep -i "auth\|error\|failed"
docker-compose logs backend | grep -i "auth\|error\|401"
```

---

## Backup & Recovery

### Backup Database

```bash
# Manual backup
docker-compose exec postgres pg_dump -U heritage_user heritage_db | gzip > heritage-db-$(date +%Y%m%d).sql.gz

# Verify backup
gzip -t heritage-db-*.sql.gz
```

### Backup Volumes

```bash
# Backup all volumes
docker-compose down
tar -czf heritage-backup-$(date +%Y%m%d).tar.gz .

# Restore
tar -xzf heritage-backup-*.tar.gz
docker-compose up -d
```

### Restore from Backup

```bash
# Restore database
gunzip < heritage-db-backup.sql.gz | docker-compose exec -T postgres psql -U heritage_user -d heritage_db

# Verify
docker-compose exec postgres psql -U heritage_user -d heritage_db -c "SELECT COUNT(*) FROM django_migrations;"
```

---

## Performance Optimization

### 1. Gunicorn Worker Configuration

In `docker-compose.yml`, backend service:
```yaml
CMD ["gunicorn", "heritage_graph.wsgi:application", 
     "--workers", "4",  # Adjust based on CPU cores
     "--worker-class", "sync",
     "--max-requests", "1000"]
```

### 2. Database Connection Pooling

In `heritage_graph/settings/production.py`:
```python
DATABASES = {
    "default": {
        "CONN_MAX_AGE": 300,
        "ATOMIC_REQUESTS": True,
    }
}
```

### 3. Caching

Enable Redis or Memcached for session/query caching (optional).

### 4. Enable Compression

Traefik compression middleware is configured for responses > 1KB.

---

## Useful Commands

### General

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View running services
docker-compose ps

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

### Database

```bash
# Create database backup
docker-compose exec postgres pg_dump -U heritage_user heritage_db > backup.sql

# Run Django shell
docker-compose exec backend python manage.py shell

# Create Django superuser
docker-compose exec backend python manage.py createsuperuser
```

### Logs & Debugging

```bash
# View all logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend

# Real-time stats
docker stats
```

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup (WARNING: removes images too)
docker system prune -a
```

---

## Support & Documentation

- **GitHub**: https://github.com/CAIRNepal/heritagegraph
- **Issues**: https://github.com/CAIRNepal/heritagegraph/issues
- **Contributing**: See `contributing.md`

---

## 🔄 Migration Checklist: Keycloak → Google OAuth

Follow these steps in order to safely migrate from Keycloak to Google OAuth.

### Pre-Migration

- [ ] **Create Google Cloud project** at [console.cloud.google.com](https://console.cloud.google.com)
- [ ] **Create OAuth 2.0 credentials** under APIs & Services → Credentials → Create Credentials → OAuth client ID
  - Application type: **Web application**
  - Authorized redirect URIs:
    - Development: `http://localhost:3000/api/auth/callback/google`
    - Production: `https://yourdomain.com/api/auth/callback/google`
- [ ] **Copy** the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [ ] **Generate** a new `NEXTAUTH_SECRET`: `openssl rand -base64 32`

### Environment Setup

- [ ] **Update `.env`** with new variables:
  ```env
  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-client-secret
  NEXTAUTH_SECRET=your-generated-secret
  NEXTAUTH_URL=http://localhost:3000  # or https://yourdomain.com
  POSTGRES_USER=heritage_user
  POSTGRES_DB=heritage_db
  ```
- [ ] **Remove** old Keycloak variables (`KEYCLOAK_*`, `KC_*`, `NEXT_PUBLIC_KEYCLOAK_*`)

### Deployment

- [ ] **Stop all services**: `docker-compose down`
- [ ] **Remove Keycloak volume** (if present): `docker volume rm heritagegraph_keycloak-data`
- [ ] **Install Python dependency**: `google-auth==2.38.0` is now in `requirements.txt`
- [ ] **Remove Keycloak npm packages**: Run `pnpm install` in `heritage_graph_ui/` to prune removed packages
- [ ] **Rebuild all images**: `docker-compose build --no-cache`
- [ ] **Start services**: `docker-compose up -d`
- [ ] **Run migrations**: `docker-compose exec backend python manage.py migrate`

### Verification

- [ ] **Backend health**: `curl http://backend.localhost/health/`
- [ ] **Frontend loads**: Open `http://frontend.localhost` in browser
- [ ] **Sign in with Google**: Click "Sign In with Google" on frontend
- [ ] **API auth works**: Verify authenticated API calls return data (check browser network tab for 200 responses)
- [ ] **User profile created**: Check Django admin for new UserProfile linked to Google email

### Post-Migration Cleanup (Optional)

- [ ] **Delete `keycloak/` directory** from repo
- [ ] **Delete `keycloak-themes/` directory** from repo
- [ ] **Delete `heritage_graph/apps/heritage_data/clerk_auth.py`** (legacy, unused)
- [ ] **Delete `Dockerfile.keycloak`** from repo root
- [ ] **Remove Keycloak database** if it still exists in PostgreSQL

### Important Notes

- ⚠️ **All existing sessions are invalidated** — users must sign in again with Google
- ⚠️ **Existing Keycloak users are NOT automatically migrated** — new UserProfile records are created on first Google sign-in
- ✅ `NEXTAUTH_SECRET` rotation is **not** required if you're already using NextAuth
- ✅ No database schema changes are needed — the `UserProfile` model is unchanged

---

## License

See LICENSE file for details.

---

**Last Updated**: February 2026
