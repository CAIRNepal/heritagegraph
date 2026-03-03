# 🚀 HeritageGraph Deployment Guide

> **Domain:** `heritagegraph.xyz` — Ubuntu cloud VM with Docker Compose + Traefik + Let's Encrypt

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Production Deployment on heritagegraph.xyz](#production-deployment-on-heritagegraphxyz)
  - [Step 1: Prepare the Ubuntu VM](#step-1-prepare-the-ubuntu-vm)
  - [Step 2: Configure DNS](#step-2-configure-dns)
  - [Step 3: Clone & Configure](#step-3-clone--configure)
  - [Step 4: Build & Launch](#step-4-build--launch)
  - [Step 5: Verify Deployment](#step-5-verify-deployment)
  - [Step 6: Google OAuth Setup](#step-6-google-oauth-setup)
- [Post-Deployment](#post-deployment)
- [Updating the Application](#updating-the-application)
- [Backup & Recovery](#backup--recovery)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)
- [Security Hardening](#security-hardening)
- [Quick Reference](#quick-reference)

---

## Architecture Overview

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │   heritagegraph │
              │       .xyz      │
              │   (Ubuntu VM)   │
              └────────┬────────┘
                       │ :80 / :443
              ┌────────▼────────┐
              │     Traefik     │  ← Reverse proxy + auto HTTPS (Let's Encrypt)
              │  (entry point)  │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │Frontend │   │ Backend │   │ Landing │
   │Next.js  │   │ Django  │   │Next.js  │
   │  :3000  │   │  :8000  │   │  :3000  │
   └─────────┘   └────┬────┘   └─────────┘
                       │
                  ┌────▼────┐
                  │PostgreSQL│
                  │  :5432   │
                  └──────────┘
```

### Domain Routing

| URL | Service | Purpose |
|-----|---------|---------|
| `https://heritagegraph.xyz` | Frontend | Main dashboard & app |
| `https://www.heritagegraph.xyz` | Frontend | Alias for root domain |
| `https://api.heritagegraph.xyz` | Backend | Django REST API |
| `https://landing.heritagegraph.xyz` | Landing | Marketing / landing page |

---

## Prerequisites

### System Requirements (Ubuntu VM)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **RAM** | 4 GB | 8 GB+ |
| **CPU** | 2 vCPUs | 4 vCPUs |
| **Disk** | 20 GB | 40 GB+ SSD |
| **Ports** | 22, 80, 443 open | — |

### What You Need Before Starting

- [ ] Ubuntu VM with root/sudo access (cloud provider: AWS, DigitalOcean, Hetzner, etc.)
- [ ] Domain `heritagegraph.xyz` with DNS access
- [ ] Google OAuth credentials (Client ID + Secret) from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- [ ] SSH access to the VM

---

## Quick Start (Development)

For local development (no domain or SSL needed):

```bash
# 1. Clone
git clone https://github.com/CAIRNepal/heritagegraph.git
cd heritagegraph

# 2. Configure
cp .env.example .env
# Edit .env — defaults are fine for dev, just change POSTGRES_PASSWORD and DJANGO_SECRET_KEY

# 3. Run
docker compose up -d --build

# 4. Access
# Frontend:  http://frontend.localhost
# Backend:   http://backend.localhost
# Dashboard: http://traefik.localhost:8080
```

**Default dev credentials:** `admin` / `changeme123!`

```bash
# Stop
docker compose down

# Stop + wipe data
docker compose down -v
```

---

## Production Deployment on heritagegraph.xyz

### Step 1: Prepare the Ubuntu VM

SSH into your VM and run these commands:

```bash
ssh root@<YOUR_VM_IP>
```

#### 1a. System updates & essentials

```bash
apt update && apt upgrade -y
apt install -y curl git ufw apt-transport-https ca-certificates gnupg lsb-release
```

#### 1b. Install Docker Engine

```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version
```

#### 1c. Create a deploy user (recommended — don't run as root)

```bash
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Switch to deploy user for the rest
su - deploy
```

#### 1d. Configure firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt challenge + redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

---

### Step 2: Configure DNS

Go to your domain registrar's DNS management panel for `heritagegraph.xyz` and create these **A records**:

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| A | `@` | `<YOUR_VM_IP>` | 300 |
| A | `www` | `<YOUR_VM_IP>` | 300 |
| A | `api` | `<YOUR_VM_IP>` | 300 |
| A | `landing` | `<YOUR_VM_IP>` | 300 |

> **Tip:** Set TTL to 300 (5 min) initially for fast propagation. Increase later.

#### Verify DNS propagation

```bash
# Run from your local machine or the VM
dig +short heritagegraph.xyz
dig +short api.heritagegraph.xyz
dig +short www.heritagegraph.xyz
dig +short landing.heritagegraph.xyz
```

All should return your VM's IP address. DNS can take 5–30 minutes to propagate.

---

### Step 3: Clone & Configure

```bash
# As the deploy user on the VM
cd /home/deploy
git clone https://github.com/CAIRNepal/heritagegraph.git
cd heritagegraph
git checkout v1
```

#### 3a. Create the `.env` file

```bash
cp .env.example .env
nano .env
```

**Set these values** (replace placeholders):

```bash
# ================================================================
# ENVIRONMENT
# ================================================================
ENVIRONMENT=production
DEBUG=False

# ================================================================
# DOMAIN — This drives all Traefik routing
# ================================================================
DOMAIN=heritagegraph.xyz

# ================================================================
# DJANGO
# ================================================================
DJANGO_SECRET_KEY=<generate-with: openssl rand -base64 50>
DJANGO_SETTINGS_MODULE=heritage_graph.settings.production
ALLOWED_HOSTS=heritagegraph.xyz,www.heritagegraph.xyz,api.heritagegraph.xyz

# Django superuser (created on first boot)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@heritagegraph.xyz
DJANGO_SUPERUSER_PASSWORD=<strong-password-here>

# ================================================================
# DATABASE
# ================================================================
DB_ENGINE=django.db.backends.postgresql
DB_NAME=heritage_db
DB_USER=heritage_user
DB_PASSWORD=<generate-with: openssl rand -base64 20>
DB_HOST=postgres
DB_PORT=5432

POSTGRES_DB=heritage_db
POSTGRES_USER=heritage_user
POSTGRES_PASSWORD=<same-as-DB_PASSWORD>

# ================================================================
# GOOGLE OAUTH
# ================================================================
GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# ================================================================
# FRONTEND (Next.js)
# ================================================================
NEXT_PUBLIC_API_URL=https://api.heritagegraph.xyz
NEXTAUTH_URL=https://heritagegraph.xyz
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>

# ================================================================
# CORS
# ================================================================
CORS_ALLOWED_ORIGINS=https://heritagegraph.xyz,https://www.heritagegraph.xyz

# ================================================================
# TRAEFIK
# ================================================================
TRAEFIK_ACME_EMAIL=admin@heritagegraph.xyz
TRAEFIK_DASHBOARD_USER=admin
TRAEFIK_DASHBOARD_PASSWORD=<generate-with: htpasswd -nb admin yourpassword>
```

> **Generate secrets** (run these one by one and paste into `.env`):
> ```bash
> openssl rand -base64 50   # DJANGO_SECRET_KEY
> openssl rand -base64 20   # DB_PASSWORD / POSTGRES_PASSWORD
> openssl rand -base64 32   # NEXTAUTH_SECRET
> htpasswd -nb admin your-dashboard-password  # TRAEFIK_DASHBOARD_PASSWORD
> ```

#### 3b. Prepare Let's Encrypt directory

```bash
mkdir -p infra/traefik/acme
touch infra/traefik/acme/acme.json
chmod 600 infra/traefik/acme/acme.json
```

---

### Step 4: Build & Launch

```bash
# Build all images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Watch the logs (wait for "ready" messages)
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

> **First boot takes 2–5 minutes** as it:
> 1. Starts PostgreSQL and waits for it to be healthy
> 2. Runs Django migrations
> 3. Creates superuser
> 4. Collects static files
> 5. Traefik requests Let's Encrypt certificates

---

### Step 5: Verify Deployment

```bash
# Check all containers are running
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Expected: all services show "Up (healthy)"
```

#### Test each service

```bash
# Backend health
curl -s https://api.heritagegraph.xyz/health/ | head
# Expected: {"status": "ok", ...}

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://heritagegraph.xyz
# Expected: 200

# Landing page
curl -s -o /dev/null -w "%{http_code}" https://landing.heritagegraph.xyz
# Expected: 200

# HTTPS certificate check
echo | openssl s_client -connect heritagegraph.xyz:443 -servername heritagegraph.xyz 2>/dev/null | openssl x509 -noout -dates
# Should show valid Let's Encrypt dates
```

#### Test in browser

1. Open `https://heritagegraph.xyz` — should load the dashboard
2. Open `https://api.heritagegraph.xyz/docs` — should load Swagger UI
3. Open `https://landing.heritagegraph.xyz` — should load the landing page
4. Check the padlock icon — HTTPS should be valid

---

### Step 6: Google OAuth Setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add these **Authorized redirect URIs**:
   - `https://heritagegraph.xyz/api/auth/callback/google`
4. Add these **Authorized JavaScript origins**:
   - `https://heritagegraph.xyz`
5. Save and test sign-in at `https://heritagegraph.xyz`

---

## Post-Deployment

### Create a convenience alias

Add to `/home/deploy/.bashrc`:

```bash
alias hg-up="cd /home/deploy/heritagegraph && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
alias hg-down="cd /home/deploy/heritagegraph && docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
alias hg-logs="cd /home/deploy/heritagegraph && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
alias hg-ps="cd /home/deploy/heritagegraph && docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
alias hg-restart="cd /home/deploy/heritagegraph && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart"
```

### Set up automatic database backups

```bash
# Create backup directory
sudo mkdir -p /backups/heritage
sudo chown deploy:deploy /backups/heritage

# Create backup script
cat > /home/deploy/backup-heritage.sh << 'SCRIPT'
#!/bin/bash
set -e
BACKUP_DIR="/backups/heritage"
COMPOSE_DIR="/home/deploy/heritagegraph"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

cd "$COMPOSE_DIR"
docker compose exec -T postgres pg_dump -U heritage_user heritage_db | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

# Keep only last 14 days
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +14 -delete

echo "[$(date)] Backup completed: db-$TIMESTAMP.sql.gz"
SCRIPT

chmod +x /home/deploy/backup-heritage.sh

# Add to crontab — daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /home/deploy/backup-heritage.sh >> /var/log/heritage-backup.log 2>&1") | crontab -
```

### Set up automatic Docker log rotation

Docker JSON logs are already limited to 10MB × 3 files per container (configured in `docker-compose.yml`). No extra config needed.

### Set up automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Updating the Application

### Standard update (pull latest code + rebuild)

```bash
cd /home/deploy/heritagegraph

# Pull latest changes
git pull origin v1

# Rebuild and restart (zero-downtime for stateless services)
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run migrations if needed
docker compose exec backend python manage.py migrate

# Check logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50
```

### Update a single service (e.g., backend only)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend
```

### Rollback

```bash
# Revert to previous commit
git log --oneline -5   # find the commit to revert to
git checkout <commit-hash>

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Backup & Recovery

### Manual database backup

```bash
cd /home/deploy/heritagegraph

# Backup
docker compose exec -T postgres pg_dump -U heritage_user heritage_db \
  | gzip > /backups/heritage/db-manual-$(date +%Y%m%d-%H%M%S).sql.gz

# Verify
ls -lh /backups/heritage/
gzip -t /backups/heritage/db-manual-*.sql.gz && echo "Backup OK"
```

### Restore database from backup

```bash
cd /home/deploy/heritagegraph

# Stop backend to prevent writes
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend

# Restore (replace filename with your backup)
gunzip < /backups/heritage/db-20260303-030000.sql.gz \
  | docker compose exec -T postgres psql -U heritage_user -d heritage_db

# Restart backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml start backend

# Verify
docker compose exec backend python manage.py check
```

### Backup & restore volumes (full system)

```bash
# Backup everything (stop first for consistency)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
sudo tar -czf /backups/heritage/full-$(date +%Y%m%d).tar.gz \
  -C /var/lib/docker/volumes .

# Restore
sudo tar -xzf /backups/heritage/full-20260303.tar.gz \
  -C /var/lib/docker/volumes
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Monitoring & Logs

### View logs

```bash
# All services (follow mode)
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# Last N lines
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend

# Filter errors
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend 2>&1 | grep -i "error\|exception\|traceback"
```

### Health checks

```bash
# Service status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# API health endpoints
curl -s https://api.heritagegraph.xyz/health/           # basic
curl -s https://api.heritagegraph.xyz/health/detailed/   # includes DB
curl -s https://api.heritagegraph.xyz/health/ready/      # readiness
curl -s https://api.heritagegraph.xyz/health/live/       # liveness
```

### Resource monitoring

```bash
# Real-time container stats
docker stats

# Disk usage
docker system df
df -h /

# Check if any container is restarting
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | sort
```

### Database monitoring

```bash
# Connect to psql
docker compose exec postgres psql -U heritage_user -d heritage_db

# Inside psql:
\dt                                        # List all tables
SELECT COUNT(*) FROM django_migrations;    # Check migrations ran
SELECT pg_database_size('heritage_db');    # Database size
\q                                         # Quit
```

---

## Troubleshooting

### Traefik not issuing certificates

```bash
# Check Traefik logs for ACME errors
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs traefik | grep -i "acme\|certificate\|error"

# Common causes:
# 1. DNS not propagated yet — wait and retry
# 2. Port 80 blocked — check firewall: sudo ufw status
# 3. acme.json permissions — must be 600:
chmod 600 infra/traefik/acme/acme.json

# 4. Rate limit hit — use Let's Encrypt staging first:
#    Change caServer in traefik command to staging URL for testing
```

### Container won't start

```bash
# Check specific container logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs <service>

# Check if it's a resource issue
free -h
df -h /

# Restart a specific service
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart <service>

# Nuclear option: full rebuild
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Database connection errors

```bash
# Check PostgreSQL is running and healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps postgres

# Test connectivity from backend
docker compose exec backend python -c "
import django; django.setup()
from django.db import connection
cursor = connection.cursor()
cursor.execute('SELECT 1')
print('DB OK:', cursor.fetchone())
"

# Reset database (WARNING: destroys all data)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Frontend shows 502 Bad Gateway

```bash
# Check if frontend container is running
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps frontend

# Check frontend logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend

# Common cause: NEXT_PUBLIC_API_URL was wrong at build time
# Fix: rebuild with correct env
docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

### Google OAuth not working

```bash
# Verify env vars are set
docker compose exec backend printenv GOOGLE_CLIENT_ID
docker compose exec frontend printenv GOOGLE_CLIENT_ID

# Check NextAuth logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend | grep -i "auth\|oauth\|google"

# Verify redirect URI in Google Console matches exactly:
# https://heritagegraph.xyz/api/auth/callback/google
```

### Out of disk space

```bash
# Check disk usage
df -h /
docker system df

# Clean up unused Docker resources
docker system prune -f          # Remove stopped containers, dangling images
docker image prune -a -f        # Remove all unused images
docker volume prune -f          # Remove unused volumes (careful!)
```

---

## Security Hardening

### 1. SSH hardening

```bash
# Disable root login and password auth
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

### 2. Fail2ban (block brute-force attempts)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Secret management

- **Never commit `.env`** to git — it's in `.gitignore`
- Rotate `DJANGO_SECRET_KEY` and `NEXTAUTH_SECRET` periodically
- Use unique, generated passwords for all services

### 4. CORS configuration

Only allow your domain:
```env
CORS_ALLOWED_ORIGINS=https://heritagegraph.xyz,https://www.heritagegraph.xyz
```

### 5. Regular updates

```bash
# Update OS packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 6. Monitor for issues

```bash
# Check for auth failures
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend | grep -i "401\|403\|forbidden"

# Check container restarts
docker ps --format "{{.Names}} {{.Status}}" | grep -i "restarting"
```

---

## Quick Reference

### Commands cheat sheet

| Action | Command |
|--------|---------|
| Start production | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |
| Stop production | `docker compose -f docker-compose.yml -f docker-compose.prod.yml down` |
| View logs | `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f` |
| Rebuild & restart | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |
| Run migrations | `docker compose exec backend python manage.py migrate` |
| Create superuser | `docker compose exec backend python manage.py createsuperuser` |
| Django shell | `docker compose exec backend python manage.py shell` |
| Database shell | `docker compose exec postgres psql -U heritage_user -d heritage_db` |
| Backup database | `docker compose exec -T postgres pg_dump -U heritage_user heritage_db \| gzip > backup.sql.gz` |
| Container stats | `docker stats` |
| Disk usage | `docker system df` |

### Service URLs (Production)

| Service | URL |
|---------|-----|
| Frontend (Dashboard) | `https://heritagegraph.xyz` |
| Backend API | `https://api.heritagegraph.xyz` |
| API Docs (Swagger) | `https://api.heritagegraph.xyz/docs` |
| API Docs (ReDoc) | `https://api.heritagegraph.xyz/redoc/` |
| Landing Page | `https://landing.heritagegraph.xyz` |
| Health Check | `https://api.heritagegraph.xyz/health/` |

### Service URLs (Development)

| Service | URL |
|---------|-----|
| Frontend | `http://frontend.localhost` |
| Backend API | `http://backend.localhost` |
| Traefik Dashboard | `http://traefik.localhost:8080` |
| Landing Page | `http://landing.localhost` |

---

## Support & Documentation

- **GitHub**: https://github.com/CAIRNepal/heritagegraph
- **Issues**: https://github.com/CAIRNepal/heritagegraph/issues
- **Contributing**: See `contributing.md`

---

**Last Updated**: March 2026
