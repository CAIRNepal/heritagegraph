# TROUBLESHOOTING.md — Known Issues, Gotchas & Fixes

> **Purpose:** This file documents known issues, edge cases, and non-obvious behaviors in the codebase. AI agents should read this to avoid re-introducing bugs or spending time debugging known problems.

---

## 🚨 Critical Issues

### 1. Dashboard layout has nested `<html>` tags
- **Where:** `heritage_graph_ui/src/app/dashboard/layout.tsx`
- **Problem:** The dashboard layout re-declares `<html>` and `<body>` tags, but only the root layout (`src/app/layout.tsx`) should have these. This creates invalid HTML with nested documents.
- **Impact:** May cause hydration errors, broken styling, or SEO issues.
- **Fix:** Remove `<html>` and `<body>` from `dashboard/layout.tsx`. Only wrap content in the sidebar/layout structure.
- **Status:** ⚠️ Known, not yet fixed.

### 2. Duplicate NextAuth configuration
- **Where:** `src/lib/auth.ts` AND `src/app/api/auth/[...nextauth]/route.ts`
- **Problem:** Keycloak provider + callbacks are defined in BOTH files independently, with slightly different callback logic. The API route file doesn't import from `auth.ts`.
- **Impact:** Behavior discrepancies between session handling and API route auth.
- **Fix:** `route.ts` should import `authOptions` from `@/lib/auth` instead of redefining it.
- **Status:** ⚠️ Known, not yet fixed.

### 3. Hardcoded backend URLs in frontend
- **Where:** Multiple frontend components
- **Problem:** `http://localhost:8000` and `http://127.0.0.1:8000` are hardcoded instead of using `process.env.NEXT_PUBLIC_API_URL`.
- **Impact:** Breaks when deployed behind Traefik or to production.
- **Fix:** Replace all hardcoded URLs with `process.env.NEXT_PUBLIC_API_URL`.
- **Status:** ⚠️ Known, not yet fixed.

### 4. Middleware does nothing
- **Where:** `heritage_graph_ui/src/middleware.ts`
- **Problem:** The middleware matches all routes but just returns `NextResponse.next()` — no authentication checking.
- **Impact:** All dashboard routes are accessible without login (client-side session check only).
- **Fix:** Add NextAuth middleware protection for `/dashboard/*` routes.
- **Status:** ⚠️ Known, not yet fixed.

---

## ⚠️ Configuration Gotchas

### 5. `ROOT_URLCONF` is `"urls"` not `"heritage_graph.urls"`
- **Where:** `heritage_graph/settings/base.py`
- **Problem:** Looks wrong but is correct — Django's working directory in Docker is `/app` (which is `heritage_graph/`), so `urls.py` is a top-level module.
- **Impact:** If you run Django outside Docker with a different working directory, URL routing breaks.
- **Fix:** Not needed — this is intentional. But if running locally, ensure you `cd heritage_graph` first, or set `PYTHONPATH` appropriately.

### 6. `settings.py` vs `settings/` — two settings systems
- **Where:** `heritage_graph/settings/settings.py` AND `heritage_graph/settings/__init__.py`
- **Problem:** `settings.py` is a legacy standalone settings file. The `__init__.py` dispatches to `development.py` or `production.py`. Both exist and can cause confusion.
- **Impact:** If `DJANGO_SETTINGS_MODULE` points to `heritage_graph.settings`, the `__init__.py` dispatch is used. If it points to `heritage_graph.settings.settings`, the legacy file is used.
- **Fix:** Use `__init__.py` dispatch (set `DJANGO_ENV=development` or `DJANGO_ENV=production`). Don't use `settings.py` directly.

### 7. WSGI/ASGI `DJANGO_SETTINGS_MODULE` mismatch
- **Where:** `heritage_graph/wsgi.py` and `heritage_graph/asgi.py`
- **Problem:** Both set `DJANGO_SETTINGS_MODULE = "heritage_graph.settings"` — but `manage.py` may set it differently (`settings.settings`).
- **Fix:** Ensure Docker and env vars consistently set `DJANGO_SETTINGS_MODULE=heritage_graph.settings` (which triggers `__init__.py` dispatch).

### 8. Duplicate `CommonMiddleware` in MIDDLEWARE
- **Where:** `heritage_graph/settings/base.py`
- **Problem:** `django.middleware.common.CommonMiddleware` appears twice in the MIDDLEWARE list.
- **Impact:** Minor — Django handles it, but it processes requests/responses twice through CommonMiddleware.
- **Fix:** Remove the duplicate.
- **Status:** ⚠️ Known, not yet fixed.

### 9. Auth file is named `clerk_auth.py` but contains Keycloak code
- **Where:** `heritage_graph/apps/heritage_data/clerk_auth.py`
- **Problem:** The file was originally for Clerk authentication. It now contains `KeycloakJWTAuthentication` as the active class, with Clerk code commented out.
- **Impact:** Confusing for developers. AI agents might look for Keycloak auth in wrong places.
- **Fix:** Rename to `keycloak_auth.py` and update imports. The file also contains `ClerkJWTAuthentication` (commented out) which could be moved to a separate file.
- **Status:** ⚠️ Known, not yet fixed.

---

## 🐛 Behavioral Quirks

### 10. UserStatistics auto-updates only on Submission save
- **Where:** `heritage_data/signals.py`
- **Problem:** The `post_save` signal on `Submission` recalculates `UserStatistics`, but there's no signal for `CulturalEntity` saves.
- **Impact:** If using the new `CulturalEntity` workflow, `UserStatistics` won't update.
- **Fix:** Add a `post_save` signal for `CulturalEntity` that also recalculates statistics.
- **Status:** ⚠️ Known, not yet fixed.

### 11. PersonRevision auto-creation fires on every save
- **Where:** `cidoc_data/signals.py`
- **Problem:** The `post_save` signal creates a `PersonRevision` on every `Person.save()`, even if no fields changed.
- **Impact:** Could create unnecessary revision records.
- **Fix:** Compare old and new field values before creating revision.

### 12. Submission `submission_id` is auto-generated
- **Where:** `heritage_data/models.py` → `Submission.save()`
- **Problem:** `submission_id` is generated as `random.choices(string.ascii_uppercase + string.digits, k=11)` — not guaranteed unique (though collisions are rare with 11 chars from 36-char alphabet).
- **Impact:** Very unlikely collision, but not enforced at DB level beyond `unique=True` (which would raise an IntegrityError).

### 13. Frontend `.env.local` is in wrong location
- **Where:** Should be at `heritage_graph_ui/.env.local`
- **Problem:** Next.js expects `.env.local` at the project root (next to `package.json`). If it's elsewhere, env vars won't load.
- **Fix:** Ensure `.env.local` is in `heritage_graph_ui/` directory.

---

## 🐳 Docker Issues

### 14. Keycloak realm import requires `--import-realm` flag
- **Where:** `docker-compose.yml` → `keycloak` service
- **Problem:** The realm JSON is mounted to `/opt/keycloak/data/import/` but Keycloak won't auto-import without the `--import-realm` command flag.
- **Fix:** Ensure keycloak command includes `start --import-realm` (not just `start`).
- **Status:** Check current compose config.

### 15. Frontend volume mounts override built assets in dev
- **Where:** `docker-compose.yml` → `frontend` service
- **Problem:** Volume mounts (`./heritage_graph_ui:/app`) override the built `.next` directory. Anonymous volumes (`/app/node_modules`, `/app/.next`) are used to prevent this, but can cause stale cache issues.
- **Fix:** In development, use `docker-compose up --build` to rebuild. Or remove volume mounts and rely on image rebuilds.

### 16. PostgreSQL init script only runs on first boot
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

### Check Keycloak JWKS endpoint
```bash
curl http://keycloak.localhost/realms/HeritageRealm/protocol/openid-connect/certs
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
- [ ] `KEYCLOAK_ADMIN_PASSWORD` is a strong password
- [ ] `DEBUG=False` in `.env`
- [ ] `ALLOWED_HOSTS` contains your production domain
- [ ] `KC_HOSTNAME` matches your Keycloak domain
- [ ] `NEXT_PUBLIC_API_URL` points to production API URL
- [ ] Keycloak realm has correct redirect URIs for production
- [ ] SSL/TLS is configured (Let's Encrypt or custom certs)
- [ ] Firewall allows only ports 80 and 443
- [ ] Database backups are scheduled
- [ ] Log rotation is configured
- [ ] Health check endpoints are accessible
