# TROUBLESHOOTING.md — Known Issues, Gotchas & Fixes

> **Purpose:** This file documents known issues, edge cases, and non-obvious behaviors in the codebase. AI agents should read this to avoid re-introducing bugs or spending time debugging known problems.

---

## 🚨 Critical Issues

### 1. Dashboard layout nested `<html>` tags — Fixed
- **Where:** Was `src/app/dashboard/layout.tsx` (old path).
- **Status:** ✅ Fixed — dashboard shell is now `(dashboard)/layout.tsx` and does not re-declare `<html>`/`<body>`.

### 2. Duplicate NextAuth configuration
- **Where:** `src/lib/auth.ts` AND `src/app/api/auth/[...nextauth]/route.ts`
- **Problem:** Google provider + callbacks are defined in BOTH files independently, with slightly different callback logic. The API route file doesn't import from `auth.ts`.
- **Impact:** Behavior discrepancies between session handling and API route auth.
- **Fix:** `route.ts` should import `authOptions` from `@/lib/auth` instead of redefining it.
- **Status:** ⚠️ Known, not yet fixed.

### 3. Hardcoded backend URLs in frontend
- **Where:** Multiple frontend components
- **Problem:** `http://localhost:8000` and `http://127.0.0.1:8000` are hardcoded instead of using `process.env.NEXT_PUBLIC_API_URL`.
- **Impact:** Breaks when deployed behind Traefik or to production.
- **Fix:** Replace all hardcoded URLs with `process.env.NEXT_PUBLIC_API_URL`.
- **Status:** ⚠️ Known, not yet fixed.

### 4. Middleware session gate — Fixed
- **Where:** `heritage_graph_ui/src/middleware.ts`
- **Behavior:** Redirects unauthenticated users from `/curation`, `/platform-admin`, `/moderate`, `/account`, `/notification`, `/progression`, and `/community/reviewer-request` to `/auth/login`. `/contribute` is gated by `RequireAuth` in `(dashboard)/contribute/layout.tsx` (client-side, after OAuth callback).
- **Note:** Public browse routes (`/knowledge/*`, `/graphview`, `/atlas`, etc.) remain reachable without login; APIs still enforce permissions.
- **Status:** ✅ Implemented.

---

## ⚠️ Configuration Gotchas

### Sign-in: `BACKEND_SYNC` / `BACKEND_HANDSHAKE_NOT_FOUND` after Google OAuth

- **Where:** NextAuth `signIn` callback in `heritage_graph_ui/src/lib/auth.ts` calls Django `GET /data/api/testme/` with `Authorization: Bearer <Google access or ID token>`.
- **Symptoms:** Google succeeds, then redirect to `/auth/login?error=BACKEND_SYNC` (or `BACKEND_HANDSHAKE_NOT_FOUND` for `404`).
- **What to do:**
  - Read **Django/API logs** for the HTTP status on `/data/api/testme/` (400 often means `DisallowedHost`; 404 means routing or wrong `INTERNAL_BACKEND_URL` path).
  - On the **frontend** service, set `INTERNAL_BACKEND_URL` to an internal base URL the Node server can reach (e.g. `http://backend:8000` in Compose), not a public URL that redirects and strips `Authorization`.
  - Ensure **`ALLOWED_HOSTS`** includes `backend` and **`GOOGLE_CLIENT_ID`** matches on Django and Next.js ([`auth/AUTH.md`](auth/AUTH.md), [`deployment/DOKPLOY.md`](deployment/DOKPLOY.md)).
  - Next.js logs a snippet on failure: `[next-auth] Django handshake non-OK response`.

### 5. `ROOT_URLCONF` is `"urls"` not `"heritage_graph.urls"`
- **Where:** `heritage_graph/settings/base.py`
- **Problem:** Looks wrong but is correct — Django's working directory in Docker is `/app` (which is `heritage_graph/`), so `urls.py` is a top-level module.
- **Impact:** If you run Django outside Docker with a different working directory, URL routing breaks.
- **Fix:** Not needed — this is intentional. But if running locally, ensure you `cd heritage_graph` first, or set `PYTHONPATH` appropriately.

### 6. `settings.py` vs `settings/` — two settings systems
- **Where:** `heritage_graph/settings/settings.py` AND `heritage_graph/settings/__init__.py`
- **Problem:** `settings.py` is a legacy standalone settings file. The `__init__.py` dispatches to `development.py` or `production.py`. Both exist and can cause confusion.
- **Impact:** `DJANGO_SETTINGS_MODULE` should be `settings` (dispatches via `settings/__init__.py` on `DJANGO_ENV`) or `settings.development` / `settings.production` directly. The legacy `settings/settings.py` startproject file was removed.
- **Fix:** Use `__init__.py` dispatch (set `DJANGO_ENV=development` or `DJANGO_ENV=production`). Don't use `settings.py` directly.

### 7. WSGI/ASGI `DJANGO_SETTINGS_MODULE` mismatch
- **Where:** `heritage_graph/wsgi.py` and `heritage_graph/asgi.py`
- **Problem:** Historically `manage.py` forced `settings.development` while WSGI used `heritage_graph.settings`, skipping `__init__.py` dispatch.
- **Fix:** `manage.py` now defaults to `DJANGO_SETTINGS_MODULE=settings` (loads `settings/__init__.py` + `DJANGO_ENV`). Gunicorn still uses `heritage_graph.settings` with `PYTHONPATH=/app`; both resolve to the same dispatch package.
- **Status:** Fixed for CLI (`manage.py`); WSGI/ASGI unchanged and aligned in intent.

### 8. Duplicate `CommonMiddleware` in MIDDLEWARE
- **Where:** `heritage_graph/settings/base.py`
- **Problem:** `django.middleware.common.CommonMiddleware` appears twice in the MIDDLEWARE list.
- **Impact:** Minor — Django handles it, but it processes requests/responses twice through CommonMiddleware.
- **Fix:** Remove the duplicate.
- **Status:** Fixed (duplicate removed from `MIDDLEWARE`).

### 9. Legacy auth files with outdated names
- **Where:** ~~`heritage_graph/apps/heritage_data/clerk_auth.py`~~ (removed)
- **Problem:** This legacy file contained old Clerk authentication code. The active auth class is `GoogleTokenAuthentication` in `authentication.py`.
- **Impact:** Confusing for developers. AI agents might look for auth code in the wrong file.
- **Fix:** Delete `clerk_auth.py` since `authentication.py` now handles all auth via Google OAuth.
- **Status:** Fixed (file removed).

### 10. `InconsistentMigrationHistory` during `make setup` / `migrate`
- **Error:** `django.db.migrations.exceptions.InconsistentMigrationHistory: Migration admin.0001_initial is applied before its dependency users.0001_initial`
- **Cause:** Django’s `django_migrations` table says `admin.0001_initial` ran, but `users.0001_initial` (required for the custom `AUTH_USER_MODEL`) is not recorded as applied. Typical cases:
  - Stale **SQLite** dev DB from before the custom user model.
  - **PostgreSQL** volume reused after a failed or partial migrate, or a DB restored from another environment.

#### Fix — local SQLite (development)

```bash
make reset-dev-db
```

Or manual:

```bash
mv heritage_graph/db.sqlite3 heritage_graph/db.sqlite3.bak-$(date +%Y%m%d-%H%M%S)
make migrate
```

#### Fix — PostgreSQL / Docker / Coolify (production or shared DB)

**A. No data to keep (empty or disposable DB)** — simplest:

1. In Coolify (or `docker compose`), remove the Postgres **volume** for this stack, or run:

```bash
docker exec -it <postgres_container> psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

2. Redeploy the **backend** so `migrate` runs on a clean schema.

**B. You need to keep data** — repair history, then migrate (get a backup first):

1. Open a shell on the Postgres container and run SQL (adjust user/db names):

```sql
-- Remove the bogus admin row so Django can apply users.* then admin.* in order
DELETE FROM django_migrations WHERE app = 'admin';
```

2. From the **backend** container:

```bash
python manage.py migrate --noinput
```

3. If `migrate` errors with **“relation users_user already exists”** (table present but migration row missing), align with fakes (only if the schema matches `users.0001_initial`):

```bash
python manage.py migrate users 0001 --fake-initial
python manage.py migrate --noinput
```

If problems persist, compare `django_migrations` rows for `users` and `admin` with a known-good fresh migrate on a throwaway database.

#### Automated repair (Docker / Dokploy)

For **Dokploy**, `docker-compose-dokploy.yml` sets `MIGRATION_AUTO_REPAIR=1` on the backend so the entrypoint runs `python manage.py repair_migration_history` before `migrate`. The command is defined in `apps/heritage_data/management/commands/repair_migration_history.py`. You can run it manually or set the same env on other compose stacks. Set `MIGRATION_AUTO_REPAIR=0` once the DB is healthy if you want to skip the check.

---

## 🐛 Behavioral Quirks

### 11. UserStatistics auto-updates only on Submission save
- **Where:** `heritage_data/signals.py`
- **Problem:** The `post_save` signal on `Submission` recalculates `UserStatistics`, but there's no signal for `CulturalEntity` saves.
- **Impact:** If using the new `CulturalEntity` workflow, `UserStatistics` won't update.
- **Fix:** Add a `post_save` signal for `CulturalEntity` that also recalculates statistics.
- **Status:** Fixed — `refresh_user_stats()` aggregates submissions + cultural entities; both models trigger it.

### 12. PersonRevision auto-creation fires on every save
- **Where:** `cidoc_data/signals.py`
- **Problem:** The `post_save` signal creates a `PersonRevision` on every `Person.save()`, even if no fields changed.
- **Impact:** Could create unnecessary revision records.
- **Fix:** Compare old and new field values before creating revision.

### 13. Submission `submission_id` is auto-generated
- **Where:** `heritage_data/models.py` → `Submission.save()`
- **Problem:** `submission_id` is generated as `random.choices(string.ascii_uppercase + string.digits, k=11)` — not guaranteed unique (though collisions are rare with 11 chars from 36-char alphabet).
- **Impact:** Very unlikely collision, but not enforced at DB level beyond `unique=True` (which would raise an IntegrityError).

### 14. Frontend `.env.local` is in wrong location
- **Where:** Should be at `heritage_graph_ui/.env.local`
- **Problem:** Next.js expects `.env.local` at the project root (next to `package.json`). If it's elsewhere, env vars won't load.
- **Fix:** Ensure `.env.local` is in `heritage_graph_ui/` directory.

---

## 🐳 Docker Issues

### 15. Google OAuth requires correct redirect URIs
- **Where:** Google Cloud Console → API Credentials
- **Problem:** Google OAuth will reject sign-in attempts if the redirect URIs don't match exactly. For development, you need `http://localhost:3000/api/auth/callback/google`.
- **Fix:** In Google Cloud Console, add all redirect URIs:
  - Dev: `http://localhost:3000/api/auth/callback/google`
  - Prod: `https://yourdomain.com/api/auth/callback/google`
- **Status:** ℹ️ Configuration requirement.

### 16. Frontend volume mounts override built assets in dev
- **Where:** `docker-compose.yml` → `frontend` service
- **Problem:** Volume mounts (`./heritage_graph_ui:/app`) override the built `.next` directory. Anonymous volumes (`/app/node_modules`, `/app/.next`) are used to prevent this, but can cause stale cache issues.
- **Fix:** In development, use `docker-compose up --build` to rebuild. Or remove volume mounts and rely on image rebuilds.

### 17. PostgreSQL init script only runs on first boot
- **Where:** `infra/postgres/init-scripts/01-init-databases.sh`
- **Problem:** Docker's `docker-entrypoint-initdb.d` scripts only run when the data directory is empty (first `docker-compose up`).
- **Impact:** If you need to re-run init scripts, you must delete the volume: `docker-compose down -v`.

---

## 🔍 Debugging Tips

### Check Django settings being used
```bash
docker-compose exec backend python -c "from django.conf import settings; print(settings.SETTINGS_MODULE)"
```

### Check if database is reachable
```bash
docker-compose exec backend python -c "
import django; django.setup()
from django.db import connection
connection.ensure_connection()
print('DB OK')
"
```

### Verify Google ID token
```bash
# Decode a Google ID token (for debugging)
python3 -c "import jwt; print(jwt.decode('YOUR_TOKEN', options={'verify_signature': False}))"
```

### Check Traefik routing
```bash
curl -H "Host: backend.localhost" http://localhost/health/
curl -H "Host: frontend.localhost" http://localhost
```

### View all Traefik routes
Open http://traefik.localhost:8080/dashboard/ in browser.

### Run Django management commands
```bash
docker-compose exec backend python manage.py shell
docker-compose exec backend python manage.py showmigrations
docker-compose exec backend python manage.py check --deploy
```

### Frontend build errors
```bash
# Check Next.js build output
docker-compose logs frontend | tail -50

# Rebuild with no cache
docker-compose build --no-cache frontend
```

---

## 📋 Checklist Before Deploying

- [ ] `.env` file created from `.env.example` with production values
- [ ] `DJANGO_SECRET_KEY` is randomly generated (not the default)
- [ ] `POSTGRES_PASSWORD` is a strong password
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured
- [ ] `NEXTAUTH_SECRET` is randomly generated
- [ ] `DEBUG=False` in `.env`
- [ ] `ALLOWED_HOSTS` contains your production domain
- [ ] `NEXT_PUBLIC_API_URL` points to production API URL
- [ ] Google OAuth redirect URIs configured for production domain
- [ ] SSL/TLS is configured (Let's Encrypt or custom certs)
- [ ] Firewall allows only ports 80 and 443
- [ ] Database backups are scheduled
- [ ] Log rotation is configured
- [ ] Health check endpoints are accessible
