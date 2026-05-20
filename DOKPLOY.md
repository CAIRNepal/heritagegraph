# Deploying HeritageGraph on Dokploy

Use the repository file **`docker-compose-dokploy.yml`** as the Compose definition for a Dokploy project (same idea as Coolify: the platform terminates TLS and routes to containers).

## Quick checklist

1. **Compose file:** `docker-compose-dokploy.yml` at repo root; use the **monorepo root** as the Docker build context for **backend** and **frontend** (the Next.js `frontend` image needs `tools/` + `ontology/` for the `npm run build` prebuild).
2. **Secrets in Dokploy:** `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, `NEXTAUTH_SECRET`, and optionally `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. For the **in-app assistant**, set **`OPENROUTER_API_KEY`** and at least **`OPENROUTER_MODEL_STANDARD`** (and optional `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_PREMIUM`). For **Claude Vision OCR rescue**, set **`ANTHROPIC_API_KEY`** on **`backend` and `ocr-worker`** (same value in both services).
3. **URLs:** `NEXT_PUBLIC_API_URL` (public `https://…` API), `NEXTAUTH_URL` (public `https://…` app), `CORS_ALLOWED_ORIGINS` (your app origin, comma-separated).
4. **`ALLOWED_HOSTS`:** Must list every hostname that hits Django **plus** the Docker hostname `backend` (used by NextAuth server-side `INTERNAL_BACKEND_URL`). Example:  
   `devapi.heritagegraph.xyz,dev.heritagegraph.xyz,localhost,backend`  
   (Omitting `backend` causes `400 Bad Request` / DisallowedHost on token exchange.)
5. **Domains in Dokploy:** API → **backend** port **8000**; dashboard → **frontend** **3000**; landing → **landing** **3000**. Redis and **`ocr-worker`** are internal only (no public route).

## OCR and async tasks

The stack runs **`backend`** (lean API image) plus **`redis`** and **`ocr-worker`** (heavy image with PyTorch). Document uploads enqueue Celery tasks on Redis; the worker must be running for OCR to progress beyond `pending`.

| Variable | Service(s) | Notes |
|----------|------------|--------|
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | Set in compose to `redis://redis:6379/0` and `…/1` | Override only if you run an external Redis |
| `OCR_ENABLED` | `backend`, `ocr-worker` | Default `true`; set `false` to disable pipeline |
| `ANTHROPIC_API_KEY` | `backend`, `ocr-worker` | Optional; needed for Claude Vision rescue path |
| `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, etc. | `backend`, `ocr-worker`, others | Required |
| `GRAFANA_ADMIN_PASSWORD` | `grafana` | Required by compose for monitoring |

**Sizing:** Prefer at least **4 GB RAM** on the host for `backend` + `postgres` + `frontend` + `ocr-worker` (the worker limit is 2 GB in compose). The first **`ocr-worker` image build** can take **15–30+ minutes** on a small builder; cache makes later deploys faster. If the platform build times out, raise the build timeout or push pre-built images to a registry.

**Verify OCR:** Upload a PDF or image on a project that triggers document processing. `UploadedDocument` rows should move `pending` → `processing` → `completed` (or check `ocr-worker` logs for Celery activity).

## Migrations

`MIGRATION_AUTO_REPAIR=1` is set for the **backend** service in this compose file. On startup, the entrypoint runs `repair_migration_history` before `migrate`, which fixes the common `InconsistentMigrationHistory` case (`admin` recorded before `users` with a custom user model).

To disable after the database is healthy, set `MIGRATION_AUTO_REPAIR=0` (or remove it) in Dokploy and redeploy.

## More help

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — migration history, CORS, OAuth.
- [deploy_on_coolify.md](deploy_on_coolify.md) — same stack pattern; substitute “Dokploy” for “Coolify” where relevant.
