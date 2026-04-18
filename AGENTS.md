# AGENTS.md — AI Agent Instructions for HeritageGraph

> **Purpose:** This file gives AI coding agents (GPT, Claude, Copilot, Cursor, Cody, etc.) the full context they need to work effectively in this codebase. Read this file first before making any changes.

---

## 🧠 What Is This Project?

**HeritageGraph** is a full-stack platform by CAIR-Nepal for digitally preserving and publishing cultural heritage data as linked open data. It has:

- A **Django REST Framework** backend (API, auth, data models)
- A **Next.js 15** main app (`heritage_graph_ui`) — dashboard, contribution forms, graph visualization
- A **Next.js 15** marketing landing (`heritage_graph_landing`) — public site; same brand colors as the dashboard
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
│   │   ├── document_processing/ # **NEW** OCR & document processing pipeline
│   │   ├── assistant/        # In-app LLM chat (grounded: site copy + public graph search)
│   │   └── health_check.py     # /health/ endpoints for Docker/Traefik
│   ├── celery_app.py            # **NEW** Celery app initialization (imported from `heritage_graph/__init__.py`)
│   ├── settings/
│   │   ├── __init__.py          # Env-based dispatch (DJANGO_ENV → dev or prod)
│   │   ├── base.py              # Shared settings (apps, middleware, DRF config, Celery)
│   │   ├── development.py       # Dev: SQLite, DEBUG=True, Celery eager mode
│   │   └── production.py        # Prod: PostgreSQL, env-based secrets
│   ├── urls.py                  # Root URL configuration
│   ├── entrypoint.sh            # Docker entrypoint (migrate, superuser, start)
│   ├── manage.py                # Django management
│   └── requirements.txt         # Python dependencies
│
├── heritage_graph_ui/           # Next.js 15 main app (authenticated product UI)
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── layout.tsx       # Root layout (SessionProvider, ThemeProvider)
│   │   │   ├── (dashboard)/     # Dashboard route group (sidebar layout)
│   │   │   │   ├── page.tsx     # Dashboard home (/)
│   │   │   │   ├── knowledge/   # Knowledge base CRUD (entity, person, etc.)
│   │   │   │   ├── contribute/  # Contribution forms
│   │   │   │   ├── curation/    # Moderation & activity logs
│   │   │   │   │   ├── contributions/  # Contribution queue
│   │   │   │   │   ├── activity/       # Activity log
│   │   │   │   │   ├── review/         # Triaged review queue
│   │   │   │   │   │   └── [id]/       # Three-panel review workspace
│   │   │   │   │   ├── conflicts/      # Conflict resolution
│   │   │   │   │   └── dashboard/      # Reviewer dashboard
│   │   │   │   ├── community/   # Contributors & organizations
│   │   │   │   └── graphview/   # Graph visualization (Cytoscape)
│   │   │   └── api/auth/        # NextAuth API route
│   │   ├── components/          # Shared components (shadcn/ui, data tables, chat)
│   │   ├── providers/           # Context providers (ChatContext)
│   │   ├── hooks/               # Custom hooks (use-mobile)
│   │   └── lib/                 # Utilities (auth.ts, utils.ts, chat/)
│   ├── types/                   # TypeScript type augmentations
│   └── public/                  # Static assets
│
├── heritage_graph_landing/      # Next.js 15 marketing site (port 3001 locally)
│   ├── src/app/                 # Public landing + chat widget (calls same assistant API)
│   └── README.md                # Env: NEXT_PUBLIC_APP_URL → main app origin
│
├── infra/                       # Infrastructure configs
│   ├── traefik/                 # Traefik reverse proxy config
│   ├── postgres/                # Database init scripts
│   └── docker/                  # Legacy docker-compose files (reference only)
│
├── docker-compose.yml           # Main compose: all services (dev)
├── docker-compose-coolify.yml   # Coolify (platform proxy; no in-repo Traefik)
├── docker-compose-dokploy.yml   # Dokploy (same + MIGRATION_AUTO_REPAIR, landing build args)
├── DOKPLOY.md                   # Dokploy checklist and env notes
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

### 3. Authentication varies by layer
- **Next.js app (`heritage_graph_ui`):** **Google sign-in only** (NextAuth v4 + `GoogleProvider`). There is no username/password or GitHub login in the UI. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the frontend environment; the same `GOOGLE_CLIENT_ID` must be set on Django for token verification.
- **Django API** (`DJANGO_ENV=development`): Tries `GoogleTokenAuthentication` first, then `GitHubTokenAuthentication`, then session and `JWTAuthentication`. Use `POST /api/token/` or Django admin when you need a JWT without the browser UI.
- **Django API** (`DJANGO_ENV=production`): Expects Google-issued tokens from the app (`GoogleTokenAuthentication`).
- **Login UI:** `/auth/login` — Google OAuth only; if env vars are missing, shows configuration guidance instead of a password form.

### 4. Two data model architectures co-exist
- **Legacy:** `Submission` model with 80+ flat CharField fields for heritage data
- **New:** `CulturalEntity` → `Revision` (JSONField) → `Activity` workflow
- Both are active. New features should use the `CulturalEntity` workflow.
- **Review system:** `ReviewerRole`, `ReviewDecision`, `ReviewFlag` models extend the `CulturalEntity` workflow with three-persona epistemic review (community_reviewer, domain_expert, expert_curator).

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
- **Routing note**: Most endpoints are available under both `/data/api/...` (legacy/canonical for existing clients) and `/data/...` (clean prefix). New clients should prefer `/data/...` when possible.
- `GET/POST /data/api/submissions/` — list/create submissions (legacy workflow)
- `GET/PUT/PATCH/DELETE /data/api/submissions/<id>/` — submission CRUD (legacy workflow)
- `POST /data/api/form-submit/` — full heritage form submission (legacy workflow)
- `GET/POST /data/api/comments/` — comments on submissions/entities (legacy workflow)
- `GET /data/api/leaderboard/` — ranked contributors
- `GET /data/api/contributors/` — contributor directory
- `GET /data/api/personal-stats/` — current user stats
- `GET /data/api/progression/` — progression metrics

**CIDOC Data (prefix: `/cidoc/`):**
- `/cidoc/persons/` — historical persons CRUD
- `/cidoc/locations/` — heritage locations CRUD
- `/cidoc/events/` — cultural events CRUD
- `/cidoc/historical_periods/` — time periods CRUD
- `/cidoc/traditions/` — cultural traditions CRUD
- `/cidoc/sources/` — documentary sources CRUD
- `/cidoc/search/?q=<query>` — cross-model search
- `/cidoc/discovery/?type=<persons|monuments|...>&q=<optional>` — public faceted browse + counts (landing)
- **Ontology edit (UI):** From `/knowledge/<domain>/view/<id>`, **Edit** opens `/contribute/<domain>?id=<id>`. The form **GET**s the same detail resource as the view, then **PATCH**es with `Authorization: Bearer` (NextAuth). **Mutations** require an authenticated user who is **staff/superuser** or the row’s `contributor` (see `CidocObjectEditPermission` in `heritage_graph/apps/cidoc_data/permissions.py` and `ContributionFlowMixin.get_permissions` in `heritage_graph/apps/cidoc_data/views.py`).

**Cultural Entities (prefix: `/data/`):**
- `/data/cultural-entities/` — CRUD + submit/review actions
- `/data/contribution-queue/` — pending contributions queue
- `/data/revisions/` — revision history

**Epistemic Review (prefix: `/data/`):**
- `/data/review-queue/` — triaged queue (filterable: all, new_claims, conflicts, flagged, expiring)
- `/data/review-queue/queue_counts/` — count per queue type
- `GET /data/api/review-workspace/<uuid>/` — three-panel workspace data
- `POST /data/api/review-workspace/<uuid>/decide/` — submit review decision
- `/data/review-flags/` — CRUD + resolve action
- `/data/reviewer-roles/` — role management + my_role/assign actions
- `GET /data/api/reviewer-dashboard/` — reviewer stats and metrics

**OCR / Document processing (prefix: `/data/`, also available under `/api/v1/data/`):**
- `POST /data/ocr-documents/upload/` — multipart upload: creates `heritage_data.Media` and enqueues `document_processing.UploadedDocument` processing
- `GET /data/ocr-documents/<uuid>/` — OCR run status
- `GET /data/ocr-documents/<uuid>/suggestions/` — JSON map of `ExtractedField` suggestions
- `POST /data/ocr-documents/<uuid>/retry/` — staff-only requeue

**In-app assistant (prefix: `/api/v1/assistant/`, public; requires `OPENROUTER_API_KEY` on the server):**
- `POST /api/v1/assistant/chat/` — grounded chat: `heritage_graph/apps/assistant/grounding/site.md` plus public discovery search excerpts (see `retrieval.py`). OpenAPI: `specs/003-grounded-chatbot/contracts/openapi-assistant-chat.v1.yaml`
- **LLM:** [OpenRouter](https://openrouter.ai/) OpenAI-compatible API (`openai` Python client, base URL `https://openrouter.ai/api/v1`). **Cost tiers** (server-side heuristics in `apps/assistant/services/routing.py`): `OPENROUTER_MODEL_FAST`, `OPENROUTER_MODEL_STANDARD` (required), `OPENROUTER_MODEL_PREMIUM`. Optional `OPENROUTER_HTTP_REFERER` / `OPENROUTER_X_TITLE` for OpenRouter app headers.
- **OCR / Vision** still uses `ANTHROPIC_API_KEY` (direct Anthropic) in `document_processing` — not OpenRouter.
- **Ops:** each user turn calls OpenRouter; log at **INFO** only `tier` + `model` (see `chat_completion.py`), not full prompts. Rate-limit or cap at the edge if exposed publicly

**Auth:**
- `POST /api/token/` — obtain JWT
- `POST /api/token/refresh/` — refresh JWT
- `POST /api/register/` — user registration

### Frontend Routes — Main app (`heritage_graph_ui`, port 3000)

- `/` — dashboard home (authenticated shell)
- `/knowledge/<domain>` — knowledge base (entity, person, location, event, period, tradition, source)
- `/contribute/<domain>` — contribution forms (add `?id=<recordId>` to edit an existing CIDOC record)
- `/curation/contributions` — moderation queue
- `/curation/activity` — activity log
- `/curation/review` — triaged epistemic review queue
- `/curation/review/<id>` — three-panel review workspace
- `/curation/conflicts` — conflict resolution queue
- `/curation/dashboard` — reviewer dashboard
- `/community/contributors` — contributor list
- `/graphview` — graph visualization

---

## 🐳 Docker Services

| Service | Image | Internal Port | Traefik Route |
|---------|-------|--------------|---------------|
| `postgres` | postgres:16-alpine | 5432 | — (internal) |
| `redis` | redis:7-alpine | 6379 | — (internal, Celery broker) |
| `traefik` | traefik:latest | 80, 443, 8080 | `traefik.localhost` |
| `backend` | custom (Dockerfile.backend, runtime-lean target) | 8000 | `backend.localhost` |
| `frontend` | custom (heritage_graph_ui/Dockerfile) | 3000 | `frontend.localhost` |
| `landing` | custom (heritage_graph_landing/Dockerfile) | 3000 | `landing.localhost` |
| `ocr-worker` | custom (Dockerfile.backend, ocr-worker target) | — | — (background, OCR processing) |

---

## 🔄 Celery & Async Task Processing

**Status:** Infrastructure complete (Phase 0 & 1)

HeritageGraph uses **Celery + Redis** for async task processing:
- Broker: Redis (`redis://localhost:6379` in dev, env-based in prod)
- Result backend: Redis (separate database)
- Development: `CELERY_TASK_ALWAYS_EAGER=True` (tasks run synchronously for debugging)
- Production: Tasks queued async, processed by `ocr-worker` service

**Key Files:**
- `heritage_graph/celery_app.py` — Celery app initialization
- `heritage_graph/settings/base.py` — Celery configuration
- `requirements.txt` — `celery`, `redis` dependencies
- `requirements-ocr.txt` — Heavy OCR-specific dependencies (separate)

---

## 📄 OCR & Document Processing Pipeline

**Status:** Infrastructure complete, engines pending implementation (Phase 0-1 ✅, Phase 2+ TODO)

**Purpose:** Automatically extract and structure text from uploaded documents (PDFs, images, handwritten notes, stone inscriptions) to pre-populate heritage contribution forms.

**How It Works:**
1. User uploads document via `POST /data/api/form-submit/` or `POST /data/cultural-entities/`
2. Signal fires: `Media` created → `on_media_upload()` handler triggersautomatically
3. Creates `UploadedDocument` record with status='pending'
4. Queues Celery task: `classify_and_route_document(doc_id)`
5. Classifier determines document type (PDF digital/scanned, printed image, handwritten, stone inscription)
6. Routes to appropriate OCR engine:
   - **Digital PDFs** → `pdfplumber` (direct text extraction, no OCR)
   - **Printed Devanagari** → `Tesseract 5` (primary) + `EasyOCR` (fallback)
   - **Handwritten** → `TrOCR` (transformer-based HTR)
   - **Stone inscriptions** → `Claude Vision` (LLM rescue for difficult cases)
7. Task: `extract_structured_fields()` runs NER extraction → parses entities (PERSON, LOCATION, DATE, ARTIFACT, EVENT, TRADITION)
8. Task: `map_fields_to_form()` maps entities to form field structure
9. Result stored in `ExtractedField` records (ready for form pre-population)

**Models** (in `heritage_graph/apps/document_processing/models.py`):
- `UploadedDocument` — Main document record (document_type, status, raw_text, classification_confidence, processing timestamps)
- `DocumentPage` — Per-page OCR text + confidence score
- `OCRResult` — Engine-specific results audit trail (pdfplumber/tesseract/easyocr/trocr/claude_vision)
- `ExtractedField` — NER-extracted entities for form pre-population (field_name, field_value, confidence, vocabulary_match_score)

**Database Tables:**
- `document_processing_uploaded_document`
- `document_processing_document_page`
- `document_processing_ocr_result`
- `document_processing_extracted_field`

**Celery Tasks** (skeleton implementations in `heritage_graph/apps/document_processing/tasks.py`):
- `classify_and_route_document()` — Main pipeline entry, routes to engine
- `extract_text_pdfplumber()` — Digital PDFs (direct text)
- `extract_text_tesseract()` — Printed Devanagari (primary)
- `extract_text_easyocr_fallback()` — Multi-script fallback
- `extract_text_trocr()` — Handwritten HTR
- `vision_rescue_task()` — Claude Vision for inscriptions (per-document cap)
- `extract_structured_fields()` — NER extraction (Instructor + Claude)
- `map_fields_to_form()` — Entity → form field mapping
- `cleanup_failed_documents()` — Periodic cleanup

**Django Admin:**
- Accessible at `/admin/document_processing/`
- Color-coded status badges (pending/processing/completed/failed)
- Searchable, filterable document list
- Bulk actions: Retry failed, Delete results

**Environment Variables** (see `.env.example`):
- `CELERY_BROKER_URL` — Redis connection
- `CELERY_RESULT_BACKEND` — Redis result storage
- `OCR_ENABLED` — Enable/disable pipeline
- `TESSERACT_PATH` — Path to tesseract binary
- `ANTHROPIC_API_KEY` — Claude Vision API key
- `OCR_CONFIDENCE_THRESHOLD` — Min confidence (default: 0.6)
- `OCR_MAX_PAGES_PER_DOCUMENT` — Max pages to process
- `OCR_CLAUDE_VISION_MAX_CALLS_PER_DOCUMENT` — Cost control (default: 1)

**API Endpoint** (TODO - Phase 4):
- `GET /data/documents/<doc_id>/extracted-fields/` — Returns pre-filled form structure

**Next Steps (Phase 2+):**
- [ ] Implement classifier logic (document type detection)
- [ ] Implement OCR engines (pdfplumber, Tesseract, EasyOCR, TrOCR, Claude Vision)
- [ ] Implement NER extraction (Instructor + Claude)
- [ ] Deploy API endpoint for form pre-population
- [ ] Create frontend integration (show pre-filled forms with confidence badges)
- [ ] Add monitoring & logging
- [ ] Unit tests & end-to-end testing

**Documentation:**
- `OCR_INTEGRATION_SUMMARY.md` — Detailed architecture, implementation guide, and troubleshooting

---

## 🧪 Testing

- Backend: `cd heritage_graph && python manage.py test apps.cidoc_data`
- OCR: (incoming) `python manage.py test apps.document_processing`
- Frontend: No test framework configured yet
- Docker validation: `docker compose config --quiet`

---

## 📚 Related Documentation

| File | Purpose |
|------|---------|
| `FORMS.md` | **How forms work** — add fields/enums/sections/entities, registry-driven form system |
| `AUTH.md` | Authentication system — NextAuth + Google OAuth + Django token verification; includes **Errors and Recovery** (`/auth/login` codes, `session.error`, `/auth/error`) |
| `AUTH_GUIDE.md` | **How to add new auth providers** — step-by-step guide with templates |
| `API_VERSIONING.md` | **API versioning** — `/api/v1/...` conventions and how to add `v2+` safely |
| `CLAUDE.md` | Coding conventions and style guide for AI agents |
| `SKILLS.md` | Feature capabilities matrix and implementation guide |
| `ARCHITECTURE.md` | System design, data flow, and component relationships |
| `CONVENTIONS.md` | Code style, naming, and file organization rules |
| `PLATFORM_PLAN.md` | Contributing platform vision and phased roadmap |
| `TROUBLESHOOTING.md` | Known issues, gotchas, and their fixes |
| `TRANSLATION.md` | **i18n guide** — how to translate pages to Nepali or add new languages |
| `DEPLOYMENT.md` | Production deployment guide |
| `OCR_INTEGRATION_SUMMARY.md` | **OCR pipeline details** — architecture, implementation guide, phase tracking |
| `contributing.md` | Contributor instructions |
