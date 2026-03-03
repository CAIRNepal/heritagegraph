# Production Deployment (summary)

This page summarizes the production deployment steps. For full details see `DEPLOYMENT.md` in the repository root.

Key points:
- Traefik for TLS and routing
- PostgreSQL as the DB
- Use environment variables for secrets; do not commit `.env`
- Health endpoints: `/health/`, `/health/ready/`, `/health/live/`
