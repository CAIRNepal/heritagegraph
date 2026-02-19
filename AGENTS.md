# AGENTS.md — AI Agent Instructions for HeritageGraph

> **Purpose:** This file gives AI coding agents (GPT, Claude, Copilot, Cursor, Cody, etc.) the full context they need to work effectively in this codebase. Read this file first before making any changes.

---

## 🧠 What Is This Project?

**HeritageGraph** is a full-stack platform by CAIR-Nepal for digitally preserving and publishing cultural heritage data as linked open data. It has:

- A **Django REST Framework** backend (API, auth, data models)
- A **Next.js 15** frontend (dashboard, contribution forms, graph visualization)
- A **Next.js 14** landing page (marketing site)
- **NextAuth v4 + Google OAuth** for authentication
- **Traefik** as reverse proxy (routes traffic, handles TLS)
- **PostgreSQL** as database (Django backend)

---

## 📁 Repository Structure

```
heritagegraph/
│
├── heritage_graph/              # Django backend (DRF)
│   ├── apps/
│   │   ├── heritage_data/       # Main app: submissions, moderation, profiles
│   │   ├── cidoc_data/          # CIDOC-CRM ontology app: persons, events, locations
│   │   └── health_check.py     # /health/ endpoints for Docker/Traefik
│   ├── settings/
│   │   ├── __init__.py          # Env-based dispatch (DJANGO_ENV → dev or prod)
│   │   ├── base.py              # Shared settings (apps, middleware, DRF config)
│   │   ├── development.py       # Dev: SQLite, DEBUG=True
│   │   └── production.py        # Prod: PostgreSQL, env-based secrets
│   ├── urls.py                  # Root URL configuration
│   ├── entrypoint.sh            # Docker entrypoint (migrate, superuser, start)
│   ├── manage.py                # Django management
│   └── requirements.txt         # Python dependencies
│
├── heritage_graph_ui/           # Next.js 15 frontend (main app)
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── page.tsx         # Landing/home page
│   │   │   ├── layout.tsx       # Root layout (SessionProvider, ThemeProvider)
│   │   │   ├── dashboard/       # Dashboard pages (nested layout)
│   │   │   │   ├── knowledge/   # Knowledge base CRUD (entity, person, etc.)
│   │   │   │   ├── contribute/  # Contribution forms
│   │   │   │   ├── curation/    # Moderation & activity logs
│   │   │   │   ├── community/   # Contributors & organizations
│   │   │   │   └── graphview/   # Graph visualization (Cytoscape)
│   │   │   └── api/auth/        # NextAuth API route
│   │   ├── components/          # Shared components (shadcn/ui, data tables)
│   │   ├── hooks/               # Custom hooks (use-mobile)
│   │   └── lib/                 # Utilities (auth.ts, utils.ts)
│   ├── types/                   # TypeScript type augmentations
│   └── public/                  # Static assets
│
├── heritage_graph_landing/      # Next.js 14 landing page
│   └── app/                     # Landing page with 3D hero, features
│
├── infra/                       # Infrastructure configs
│   ├── traefik/                 # Traefik reverse proxy config
│   ├── postgres/                # Database init scripts
│   └── docker/                  # Legacy docker-compose files (reference only)
│
├── docker-compose.yml           # Main compose: all services (dev)
├── docker-compose.prod.yml      # Production override (HTTPS, Let's Encrypt)
├── Dockerfile.backend           # Backend multi-stage build
├── Dockerfile.frontend          # Frontend multi-stage build (root-level, legacy)
├── Makefile                     # Convenience commands
├── .env.example                 # Environment variable template
└── DEPLOYMENT.md                # Full deployment guide
```

---

## ⚠️ Critical Rules — Read Before Coding

### 1. Never hardcode secrets
All secrets come from environment variables. See `.env.example` for the full list. Never commit `.env` files.

### 2. Django settings dispatch
Settings are loaded via `heritage_graph/settings/__init__.py` which reads `DJANGO_ENV`:
- `DJANGO_ENV=development` → imports `development.py` (SQLite, DEBUG=True)
- `DJANGO_ENV=production` → imports `production.py` (PostgreSQL, env-based)
- Both import `from .base import *`

### 3. Authentication is Google OAuth via NextAuth
The active auth backend is `GoogleTokenAuthentication` in `heritage_graph/apps/heritage_data/authentication.py`. Frontend uses NextAuth v4 with Google OAuth provider. Google ID tokens are sent to the Django backend as Bearer tokens, where they are verified using the `google-auth` library.

### 4. Two data model architectures co-exist
- **Legacy:** `Submission` model with 80+ flat CharField fields for heritage data
- **New:** `CulturalEntity` → `Revision` (JSONField) → `Activity` workflow
- Both are active. New features should use the `CulturalEntity` workflow.

### 5. Frontend API calls use Bearer tokens
```tsx
fetch('http://backend.localhost/data/endpoint/', {
  headers: { Authorization: `Bearer ${session.accessToken}` }
})
```

### 6. UI components are shadcn/ui
Installed via `npx shadcn@latest add <component>`. Style: "new-york". Colors managed in `globals.css` via tweakcn. **Do not add custom colors to individual components.**

### 7. Root URL conf is `urls` not `heritage_graph.urls`
The Django `ROOT_URLCONF` in base.py is set to `"urls"` — the file is at `heritage_graph/urls.py` but is imported as a top-level module because `WORKDIR` is `/app` in Docker.

---

## 🔌 API Endpoints Summary

### Backend (Django) — Port 8000

**Health:**
- `GET /health/` — basic health check
- `GET /health/detailed/` — includes DB connectivity
- `GET /health/ready/` — readiness probe
- `GET /health/live/` — liveness probe

**Documentation:**
- `GET /docs` — Swagger UI
- `GET /redoc/` — ReDoc
- `GET /schema/` — OpenAPI schema

**Heritage Data (prefix: `/data/`):**
- `GET/POST /data/submissions/` — list/create submissions
- `GET/PUT/PATCH/DELETE /data/submissions/<id>/` — submission CRUD
- `POST /data/form-submit/` — full heritage form submission
- `GET/POST /data/review/` — moderation review
- `GET /data/leaderboard/` — ranked contributors
- `GET/POST /data/comments/` — comments on entities

**CIDOC Data (prefix: `/cidoc/`):**
- `/cidoc/persons/` — historical persons CRUD
- `/cidoc/locations/` — heritage locations CRUD
- `/cidoc/events/` — cultural events CRUD
- `/cidoc/historical_periods/` — time periods CRUD
- `/cidoc/traditions/` — cultural traditions CRUD
- `/cidoc/sources/` — documentary sources CRUD
- `/cidoc/search/?q=<query>` — cross-model search

**Cultural Entities (prefix: `/data/`):**
- `/data/cultural-entities/` — CRUD + submit/review actions
- `/data/contribution-queue/` — pending contributions queue
- `/data/revisions/` — revision history

**Auth:**
- `POST /api/token/` — obtain JWT
- `POST /api/token/refresh/` — refresh JWT
- `POST /api/register/` — user registration

### Frontend Routes — Port 3000

- `/` — landing page
- `/dashboard` — main dashboard
- `/dashboard/knowledge/<domain>` — knowledge base (entity, person, location, event, period, tradition, source)
- `/dashboard/contribute/<domain>` — contribution forms
- `/dashboard/curation/contributions` — moderation queue
- `/dashboard/curation/activity` — activity log
- `/dashboard/community/contributors` — contributor list
- `/dashboard/graphview` — graph visualization

---

## 🐳 Docker Services

| Service | Image | Internal Port | Traefik Route |
|---------|-------|--------------|---------------|
| `postgres` | postgres:16-alpine | 5432 | — (internal) |
| `traefik` | traefik:latest | 80, 443, 8080 | `traefik.localhost` |
| `backend` | custom (Dockerfile.backend) | 8000 | `backend.localhost` |
| `frontend` | custom (heritage_graph_ui/Dockerfile) | 3000 | `frontend.localhost` |
| `landing` | custom (heritage_graph_landing/Dockerfile) | 3000 | `landing.localhost` |

---

## 🧪 Testing

- Backend: `cd heritage_graph && python manage.py test apps.cidoc_data`
- Frontend: No test framework configured yet
- Docker validation: `docker compose config --quiet`

---

## 📚 Related Documentation

| File | Purpose |
|------|---------|
| `FORMS.md` | **How forms work** — add fields/enums/sections/entities, registry-driven form system |
| `AUTH.md` | Authentication system — NextAuth + Google OAuth + Django token verification |
| `CLAUDE.md` | Coding conventions and style guide for AI agents |
| `SKILLS.md` | Feature capabilities matrix and implementation guide |
| `ARCHITECTURE.md` | System design, data flow, and component relationships |
| `CONVENTIONS.md` | Code style, naming, and file organization rules |
| `PLATFORM_PLAN.md` | Contributing platform vision and phased roadmap |
| `TROUBLESHOOTING.md` | Known issues, gotchas, and their fixes |
| `DEPLOYMENT.md` | Production deployment guide |
| `contributing.md` | Contributor instructions |
