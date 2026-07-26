# Deploying HeritageGraph on Dokploy

Use the repository file **`docker-compose-dokploy.yml`** as the Compose definition for a Dokploy project (same idea as Coolify: the platform terminates TLS and routes to containers).

## Quick checklist

1. **Compose file:** `docker-compose-dokploy.yml` at repo root; use the **monorepo root** as the Docker build context for **backend** and **frontend** (the Next.js `frontend` image needs `tools/` + `ontology/` for the `npm run build` prebuild).
2. **Secrets in Dokploy:** `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. For the **in-app assistant**, set **`OPENROUTER_API_KEY`** and at least **`OPENROUTER_MODEL_STANDARD`** (and optional `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_PREMIUM`). **`ANTHROPIC_API_KEY`** is only needed if you restore the suspended OCR worker.
3. **URLs:** `NEXT_PUBLIC_API_URL` (public `https://…` API), `NEXTAUTH_URL` (public `https://…` app), `CORS_ALLOWED_ORIGINS` (comma-separated **app** origins, e.g. `https://dev.heritagegraph.xyz` — required for browser API calls after sign-in).
4. **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`:** Set on **both** `frontend` and `backend` (same OAuth client). Missing `GOOGLE_CLIENT_ID` on the backend yields failed sign-in (`BACKEND_REJECTED`).
5. **`ALLOWED_HOSTS`:** Must list every **API** hostname that hits Django **plus** `backend` (NextAuth uses `INTERNAL_BACKEND_URL=http://backend:8000`). Example:  
   `devapi.heritagegraph.xyz,api.heritagegraph.xyz,localhost,backend`  
   Do **not** point `INTERNAL_BACKEND_URL` at the public API URL unless that hostname is in `ALLOWED_HOSTS`. Omitting `backend` causes `400` / DisallowedHost (`BACKEND_DISALLOWED_HOST` on login).
6. **Domains in Dokploy:** API → **backend** port **8000**; dashboard → **frontend** **3000**; landing → **landing** **3000**. Redis is internal only (no public route).

## Automatic redeploy on `v1`

Deploy hooks and branch selection are configured in **Dokploy** and your **Git host**, not in `docker-compose-dokploy.yml`.

### 1. Dokploy source

1. Open the **Compose** application → **Settings** / **Source** (labels may vary by Dokploy version).
2. Set the Git **branch** to **`v1`** (production / build branch).
3. Confirm the compose file path is **`docker-compose-dokploy.yml`** at the **repository root** and the build context is the **monorepo root** (see Quick checklist above).

### 2. Git provider webhook (alternative on GitHub)

If you prefer the Git host to call Dokploy directly (no Actions), use **only** this path on GitHub—not **also** Actions with **`DOKPLOY_WEBHOOK_URL`** (**double deploy**).

In Dokploy, open **Deployments** and copy the **Webhook URL** for this compose app. It looks like:

`http://<dokploy-host>:<port>/api/deploy/compose/<secret-token>`

Use that full URL (do **not** commit it into this repo):

- **GitHub:** **Settings → Webhooks → Add webhook**
  - **Payload URL:** paste the URL from Dokploy.
  - **Content type:** `application/json`.
  - **Which events:** *Just the push event* (or push only).
- **GitLab:** **Settings → Webhooks** — same URL and push events.

**Network:** The Git host must reach your Dokploy instance (firewall / port open). Prefer **HTTPS** if Dokploy or your reverse proxy exposes it; some orgs disallow plain **HTTP** webhooks.

**GitHub “every branch” pushes:** The webhook fires on all branch pushes; Dokploy should build only the branch configured in step 1 (`v1`). If your Dokploy build runs on every hook regardless of branch, avoid using the repo webhook for every branch push—use the optional GitHub Actions workflow below (it runs **only** on `v1`), or push only to `v1` for production.

**Secrets:** The path token in the URL is a **secret**. Rotate it in Dokploy if it leaks, then update the Git webhook (and any CI secret).

### 3. GitHub Actions (recommended on GitHub: only `v1` pushes trigger)

Workflow [`.github/workflows/dokploy-deploy.yml`](../../.github/workflows/dokploy-deploy.yml) runs on **`push` to branch `v1`** and **`workflow_dispatch`** (manual run may require that branch’s workflow on the repo’s default branch; prefer a **push** to **`v1`** for a reliable hook).

**Operator checklist:**

1. In Dokploy, copy the full **Deployments → Webhook URL** (`…/api/deploy/compose/<token>`). Treat the URL as **secret**; rotate the token if it leaked and update CI.
2. In GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret** named **`DOKPLOY_WEBHOOK_URL`** with that URL — **do not commit** it to git.

From a machine where [GitHub CLI](https://cli.github.com/) is logged in (`gh auth login`) and you have **`admin`/secrets permission** on the repo, you can set the secret without pasting into the GitHub UI (replace placeholders):

```bash
REPO_OWNER=CAIRNepal
REPO_NAME=heritagegraph
WEBHOOK_URL='https-or-http-url-from-dokploy-deployments'
printf '%s' "$WEBHOOK_URL" | gh secret set DOKPLOY_WEBHOOK_URL --repo "$REPO_OWNER/$REPO_NAME"
```

3. In Dokploy, confirm **Compose → Source**: branch **`v1`**, file **`docker-compose-dokploy.yml`** at repo root, monorepo build context (**§ Quick checklist** above).

**Do not use both** a repository webhook and this workflow with the secret set—you will trigger **two** deploys per push. Prefer either:

- Repository webhook only, **or**
- Actions workflow with `DOKPLOY_WEBHOOK_URL`, and **no** GitHub repository webhook to the same hook.

If the secret is not set, the workflow skips the POST (no failure) so you can rely on a repo webhook only.

### 4. Verify

1. Note the last deployment in Dokploy **Deployments** (e.g. last 10 list).
2. Push a merge or commit to **`v1`** (or GitHub → **Actions** → **Dokploy deploy hook** → **Run workflow**) so the webhook POST runs.
3. In GitHub **Actions**, open the **“Dokploy deploy hook”** run and confirm **“Trigger Dokploy webhook”** did not skip (if **`DOKPLOY_WEBHOOK_URL`** was set).
4. In Dokploy, confirm a **new** deployment appears and finishes; logs should show a clone/checkout of **`v1`**.

## OCR and async tasks

**Current status:** The OCR / document-ingestion pipeline is **suspended** in active compose files (`OCR_ENABLED` defaults `false`; `ocr-worker` is not in the running stack). The active stack runs **`backend`**, **`postgres`**, **`frontend`**, **`landing`**, **`redis`**, and **`oxigraph`**.

| Variable | Service(s) | Notes |
|----------|------------|--------|
| `RDF_SYNC_ENABLED` | `backend` | Default `true` — projects accepted records to Oxigraph |
| `RDF_ENDPOINT_URL` / `RDF_QUERY_URL` | `backend` | Point at internal `http://oxigraph:7878/...` in compose |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | `backend` (when async enabled) | `redis://redis:6379/0` and `…/1` |
| `OCR_ENABLED` | `backend` | Default `false` — set `true` only after restoring `ocr-worker` |
| `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, etc. | `backend`, others | Required |
| `OPENROUTER_API_KEY` | `backend` | Required for the in-app assistant; read per request, so an unset key fails only `/api/v1/assistant/chat/` |
| `OPENROUTER_MODEL_STANDARD` | `backend` | Defaults to `anthropic/claude-3-5-haiku-20241022`; `…_FAST` / `…_PREMIUM` fall back to it |
| `CSRF_TRUSTED_ORIGINS` | `backend` | Comma-separated, **scheme required** (`https://host`). Appends to the `heritagegraph.xyz` origins pinned in `settings/base.py` — set this when deploying on any other domain, or Django admin login fails CSRF |
| `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` | `backend` | Defaults to `/app/schema-overlay/extensions.yaml` on the `backend-schema-overlay` volume, so published schema extension proposals survive a redeploy |

### Build-time vs runtime variables

`NEXT_PUBLIC_*` are compiled into the browser bundle, so they are read from **build args**, not the running container — changing them in Dokploy has no effect until the image is rebuilt. Compose defaults them to the public `https://` origins; an unset variable previously resolved to `http://localhost:*` inside the Dockerfile and shipped that to browsers.

**To revive OCR:** restore the `ocr-worker` service in compose, build the `ocr-worker` Docker target, set `OCR_ENABLED=true`, and add `ANTHROPIC_API_KEY` for Claude Vision rescue. See [`../pipelines/OCR.md`](../pipelines/OCR.md).

**Identity bootstrap:** `heritage_graph/entrypoint.sh` runs `bootstrap_identity_clusters` and `refresh_identity_candidates --auto-merge` on every backend start (idempotent).

## Migrations

`MIGRATION_AUTO_REPAIR=1` is set for the **backend** service in this compose file. On startup, the entrypoint runs `repair_migration_history` before `migrate`, which fixes the common `InconsistentMigrationHistory` case (`admin` recorded before `users` with a custom user model).

To disable after the database is healthy, set `MIGRATION_AUTO_REPAIR=0` (or remove it) in Dokploy and redeploy.

## Heritage Atlas (Cesium 3D globe)

The **`frontend`** Dockerfile runs **`npm run build`**, which runs **`prebuild`** and copies **`node_modules/cesium/…`** into **`public/cesium/`** (workers, WASM, Assets). Never replace that with bare **`next build`** without **`copy-cesium-assets`** or the atlas will fail at runtime.

**Verify after deploy:**

- From a browser or shell: **`GET https://<your-app-host>/cesium/Assets/approximateTerrainHeights.json`** should return **HTTP 200** (JSON). **`404`/HTML from the SPA** usually means **`public/cesium`** never made it into the image or the path is not routed to the frontend.
- In **`heritage_graph_ui`**, you can smoke-check locally: **`npm run verify:cesium-public`** (checks `public/cesium` layout after copy).

If **`approximateTerrainHeights.json`** is **200** but the globe still errors, open **DevTools → Console** on **`/atlas`** and watch for Content Security Policy (CSP) reports: Cesium expects workers (often **`blob:`**) and WASM. If your Dokploy ingress, CDN, or a security middleware injects CSP, widen it responsibly. Typical ingredients (adapt to your security model; tighten `default-src`/hosts as needed):

```
script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob: https:
worker-src 'self' blob:
connect-src 'self' https://server.arcgisonline.com ...
img-src 'self' data: blob: https:
```

Imagery tiles use **`https://server.arcgisonline.com/...`**; include that host in **`connect-src`**/**`img-src`** if you constrain those directives.

**Operator-only UI:** Set **`NEXT_PUBLIC_ATLAS_SHOW_ERROR_DETAIL=true`** on the **`frontend`** service to show **`AtlasErrorBoundary`** exception text after a hard failure (helps distinguish WebGL vs. script errors vs. CSP). Leave unset for normal deployments.

## More help

- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) — migration history, CORS, OAuth.
- [deploy_on_coolify.md](deploy_on_coolify.md) — same stack pattern; substitute “Dokploy” for “Coolify” where relevant.
