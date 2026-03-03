# Deploying HeritageGraph on Coolify

This guide explains how to deploy the full HeritageGraph stack on [Coolify](https://coolify.io/).

---

## Prerequisites

- Coolify installed on your VM (v4.x recommended)
- A domain pointing to your VM (e.g., `heritagegraph.xyz`)
- GitHub repository access configured in Coolify

---

## Architecture on Coolify

```
┌─────────────────────────────────────────────────────────────────┐
│                        COOLIFY VM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │  coolify-proxy  │  ← Traefik (managed by Coolify)           │
│  │  (ports 80/443) │    Handles SSL, routing, domains          │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ├──────────────┬──────────────┬─────────────────┐    │
│           ▼              ▼              ▼                 ▼    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐│
│  │   frontend   │ │   backend    │ │   landing    │ │postgres ││
│  │  (Next.js)   │ │   (Django)   │ │  (Next.js)   │ │  (DB)   ││
│  │   :3000      │ │   :8000      │ │   :3000      │ │  :5432  ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Point:** Coolify's own Traefik proxy (`coolify-proxy`) handles all routing and SSL. We do NOT include Traefik in our compose file.

---

## Step 1: Create the Resource in Coolify

1. Go to your Coolify dashboard
2. Create a new **Project** (or use existing)
3. Add a new **Resource** → Select **Docker Compose**
4. Choose **Git Repository** as the source
5. Connect your HeritageGraph repository
6. Set the **Docker Compose file path** to: `docker-compose.coolify.yml`

---

## Step 2: Configure Environment Variables

In Coolify's **Environment Variables** section, add:

### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `your-secure-password-123` | Database password (generate a strong one) |
| `DJANGO_SECRET_KEY` | `your-50-char-random-string` | Django secret key |
| `NEXTAUTH_SECRET` | `your-32-char-random-string` | NextAuth session secret |
| `NEXTAUTH_URL` | `https://app.heritagegraph.xyz` | Frontend public URL |
| `NEXT_PUBLIC_API_URL` | `https://api.heritagegraph.xyz` | Backend API URL |

### Optional Variables (for Google OAuth)

| Variable | Example | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Google OAuth secret |

### Other Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `heritage_db` | Database name |
| `POSTGRES_USER` | `heritage_user` | Database user |
| `ALLOWED_HOSTS` | `*` | Django allowed hosts (Coolify handles this) |
| `CORS_ALLOWED_ORIGINS` | `https://app.heritagegraph.xyz` | CORS origins |

### Generate Secrets

```bash
# Generate DJANGO_SECRET_KEY
openssl rand -base64 50 | tr -d '\n'

# Generate NEXTAUTH_SECRET
openssl rand -base64 32 | tr -d '\n'

# Generate POSTGRES_PASSWORD
openssl rand -base64 24 | tr -d '\n'
```

---

## Step 3: Configure Domains in Coolify

Coolify manages domains through its UI, NOT through Docker labels. For each service that needs a public domain:

### Frontend Service
1. Click on **frontend** service in Coolify
2. Go to **Network** → **Domains**
3. Add: `https://app.heritagegraph.xyz` (or your domain)
4. Port: `3000`
5. Enable **HTTPS** (Let's Encrypt auto-provisioned)

### Backend Service
1. Click on **backend** service
2. Go to **Network** → **Domains**
3. Add: `https://api.heritagegraph.xyz` (or your domain)
4. Port: `8000`
5. Enable **HTTPS**

### Landing Service (Optional)
1. Click on **landing** service
2. Go to **Network** → **Domains**
3. Add: `https://heritagegraph.xyz` (or root domain)
4. Port: `3000`
5. Enable **HTTPS**

---

## Step 4: Configure Service Dependencies

In Coolify, set up health check dependencies:

1. **backend** depends on **postgres** (healthy)
2. **frontend** can start independently
3. **landing** can start independently

This is already defined in the compose file via `depends_on`.

---

## Step 5: Deploy

1. Click **Deploy** in Coolify
2. Watch the build logs for each service
3. Wait for all health checks to pass (green status)

---

## Step 6: Post-Deployment Setup

### Run Django Migrations

After first deployment, you may need to run migrations manually:

```bash
# SSH into your Coolify VM
ssh your-vm

# Find the backend container
docker ps | grep backend

# Run migrations
docker exec -it <container_id> python manage.py migrate

# Create superuser (optional)
docker exec -it <container_id> python manage.py createsuperuser
```

### Verify Services

```bash
# Check backend health
curl https://api.heritagegraph.xyz/health/

# Check frontend
curl https://app.heritagegraph.xyz

# Check landing
curl https://heritagegraph.xyz
```

---

## DNS Configuration

Point your domains to your Coolify VM's IP address:

| Record Type | Name | Value |
|-------------|------|-------|
| A | `heritagegraph.xyz` | `<VM_IP>` |
| A | `app.heritagegraph.xyz` | `<VM_IP>` |
| A | `api.heritagegraph.xyz` | `<VM_IP>` |

Or use a wildcard:

| Record Type | Name | Value |
|-------------|------|-------|
| A | `*.heritagegraph.xyz` | `<VM_IP>` |
| A | `heritagegraph.xyz` | `<VM_IP>` |

---

## Troubleshooting

### Build Fails

1. Check Dockerfile paths are correct
2. Ensure `heritage_graph_ui/Dockerfile` and `heritage_graph_landing/Dockerfile` exist
3. Check Coolify build logs for specific errors

### Services Won't Start

1. Check environment variables are set correctly
2. Verify postgres is healthy before backend starts
3. Check container logs in Coolify

### SSL Issues

1. Ensure DNS is pointing to Coolify VM
2. Let's Encrypt needs ports 80 and 443 open
3. Wait a few minutes for certificate provisioning

### Database Connection Errors

1. Check `POSTGRES_PASSWORD` matches in both places
2. Ensure postgres health check passes
3. Backend should wait for postgres via `depends_on`

### CORS Errors

1. Update `CORS_ALLOWED_ORIGINS` to include your actual frontend domain
2. Include both `https://app.domain.com` and `https://www.app.domain.com` if needed

---

## Updating the Deployment

### Code Updates

1. Push changes to your Git repository
2. In Coolify, click **Redeploy** on the affected service
3. Or enable **Auto Deploy** for automatic deployments on push

### Environment Variable Changes

1. Update variables in Coolify UI
2. Click **Restart** on affected services

### Database Migrations

```bash
docker exec -it <backend_container> python manage.py migrate
```

---

## Backup & Recovery

### Database Backup

```bash
# Create backup
docker exec heritage-postgres pg_dump -U heritage_user heritage_db > backup.sql

# Restore backup
docker exec -i heritage-postgres psql -U heritage_user heritage_db < backup.sql
```

### Volume Backup

Coolify stores volumes in `/var/lib/docker/volumes/`. Back up:
- `postgres-data` (database)
- `backend-media` (uploaded files)
- `backend-static` (static files)

---

## Security Checklist

- [ ] Strong `POSTGRES_PASSWORD` (24+ characters)
- [ ] Strong `DJANGO_SECRET_KEY` (50+ characters)
- [ ] Strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] HTTPS enabled on all public services
- [ ] `DEBUG=False` in production
- [ ] Restricted `ALLOWED_HOSTS` (not `*` in production)
- [ ] Proper `CORS_ALLOWED_ORIGINS`
- [ ] Firewall rules (80, 443 open; other ports closed)

---

## Architecture Differences from Local Development

| Aspect | Local (docker-compose.yml) | Coolify |
|--------|---------------------------|---------|
| Reverse Proxy | Own Traefik container | Coolify's `coolify-proxy` |
| SSL | Manual or self-signed | Auto Let's Encrypt |
| Domains | `*.localhost` | Real domains |
| Routing | Traefik labels | Coolify UI |
| Env Vars | `.env` file | Coolify UI |
| Builds | Local Docker | Coolify build system |
| Monitoring | Manual | Coolify dashboard |
