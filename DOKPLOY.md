# Deploying HeritageGraph on Dokploy

Use the repository file **`docker-compose-dokploy.yml`** as the Compose definition for a Dokploy project (same idea as Coolify: the platform terminates TLS and routes to containers).

## Quick checklist

1. **Compose file:** `docker-compose-dokploy.yml` at repo root; build context is the monorepo root (backend Dockerfile expects that).
2. **Secrets in Dokploy:** `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, `NEXTAUTH_SECRET`, and optionally `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. For the **in-app assistant**, set **`OPENROUTER_API_KEY`** and at least **`OPENROUTER_MODEL_STANDARD`** (and optional `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_PREMIUM`); for **OCR/vision**, set **`ANTHROPIC_API_KEY`** on the backend if you use that feature.
3. **URLs:** `NEXT_PUBLIC_API_URL` (public `https://…` API), `NEXTAUTH_URL` (public `https://…` app), `CORS_ALLOWED_ORIGINS` (your app origin, comma-separated).
4. **`ALLOWED_HOSTS`:** Must list every hostname that hits Django **plus** the Docker hostname `backend` (used by NextAuth server-side `INTERNAL_BACKEND_URL`). Example:  
   `devapi.heritagegraph.xyz,dev.heritagegraph.xyz,localhost,backend`  
   (Omitting `backend` causes `400 Bad Request` / DisallowedHost on token exchange.)
5. **Domains in Dokploy:** API → **backend** port **8000**; dashboard → **frontend** **3000**; landing → **landing** **3000**.

## Migrations

`MIGRATION_AUTO_REPAIR=1` is set for the **backend** service in this compose file. On startup, the entrypoint runs `repair_migration_history` before `migrate`, which fixes the common `InconsistentMigrationHistory` case (`admin` recorded before `users` with a custom user model).

To disable after the database is healthy, set `MIGRATION_AUTO_REPAIR=0` (or remove it) in Dokploy and redeploy.

## More help

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — migration history, CORS, OAuth.
- [deploy_on_coolify.md](deploy_on_coolify.md) — same stack pattern; substitute “Dokploy” for “Coolify” where relevant.
