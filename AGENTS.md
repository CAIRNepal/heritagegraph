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
│   │   ├── cidoc_data/          # CIDOC-CRM ontology, identity layer, RDF projection
│   │   ├── graph/               # KG engine (Oxigraph), museum enrichment, KG APIs
│   │   ├── document_processing/ # Document upload (OCR pipeline suspended)
│   │   ├── assistant/           # Grounded in-app chat (OpenRouter)
│   │   └── health_check.py      # /health/ endpoints for Docker/Traefik
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
│   │   │   │   │   ├── identity/       # Identity resolution queue + workspace
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
├── documentation/deployment/    # DEPLOYMENT.md, DOKPLOY.md, Coolify runbooks
├── docker-compose.prod.yml      # Production override (HTTPS, Let's Encrypt)
├── Dockerfile.backend           # Backend multi-stage build
├── Dockerfile.frontend          # Same as heritage_graph_ui/Dockerfile (repo-root `-f` alias)
├── Makefile                     # Convenience commands
├── .env.example                 # Environment variable template
├── tests/                       # E2E runners (see documentation/testing/TESTING.md)
└── documentation/               # Topic guides (see DOCS.md)
```

---

## Feature specifications (Spec Kit)

Feature specs and design artifacts live under `specs/`. Example:

- **Identity layer (claim-first)** — [`specs/005-identity-layer/spec.md`](specs/005-identity-layer/spec.md) (draft; ties together entity clusters, same-referent membership claims, merge/split audit, APIs, and reviewer workspace UI).

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
- `GET /data/api/submissions/`, `GET /data/api/submissions/<id>/` — **read-only legacy archive**; all writes (POST/PUT/PATCH/DELETE) return **410 Gone**
- `POST /data/api/form-submit/` — **retired**, returns 410 Gone (use `POST /api/v1/cidoc/<type>/`)
- `GET/POST /data/api/comments/` — comments on submissions/entities (legacy workflow)
- `GET /data/api/leaderboard/` — ranked contributors
- `GET /data/api/contributors/` — contributor directory
- `GET /data/api/personal-stats/` — current user stats
- `GET /data/api/progression/` — progression metrics

**CIDOC Data (prefix: `/cidoc/`):** Ontology **v1.1.0** (deployed 1.0.0 schema rebased onto the upstream 0.1.0 draft — see [`ontology/README.md`](ontology/README.md)) — full registry in [`documentation/ontology/ONTOLOGY.md`](documentation/ontology/ONTOLOGY.md) §5 and `tools/ui-classmap.yaml`. Registry keys ↔ Django models: `cidoc_registry_keys.py`.

- **Actors & spatiotemporal:** `/cidoc/persons/`, `/cidoc/locations/`, `/cidoc/events/`, `/cidoc/historical_periods/`, `/cidoc/traditions/`, `/cidoc/calendar_systems/`
- **Tangible heritage:** `/cidoc/structures/`, `/cidoc/iconographic_objects/`, `/cidoc/monuments/`
- **Conceptual & social:** `/cidoc/deities/`, `/cidoc/guthis/`, `/cidoc/caste_groups/`, `/cidoc/syncretic_relationships/`
- **Lifecycle events:** `/cidoc/rituals/`, `/cidoc/festivals/`, `/cidoc/productions/`, `/cidoc/consecrations/`, `/cidoc/enshrinements/`, `/cidoc/transfers_of_custody/`
- **Kumari tradition:** `/cidoc/kumari_tenures/`, `/cidoc/kumari_selections/`, `/cidoc/kumari_retirements/`
- **Provenance & identity:** `/cidoc/sources/` (LinkML `InformationObject`), `/cidoc/data_sources/` (lookup), `/cidoc/assertions/`, `/cidoc/entity-clusters/`, `/cidoc/identity-candidates/`
- **Schema registry:** `GET /api/v1/cidoc/schema/registry/` — classes, enums, `contribute_hub`, `semantic_patterns`, `registry_jsonschema`
- `/cidoc/search/?q=<query>` — cross-model search
- `/cidoc/discovery/?type=<persons|monuments|...>&q=<optional>` — public faceted browse + counts (landing)
- **Ontology edit (UI):** From `/knowledge/<domain>/view/<id>`, **Edit** opens `/contribute/<domain>?id=<id>`. The form **GET**s the same detail resource as the view, then **PATCH**es with `Authorization: Bearer` (NextAuth). **Mutations** require an authenticated user who is **staff/superuser** or the row’s `contributor` (see `CidocObjectEditPermission` in `heritage_graph/apps/cidoc_data/permissions.py` and `ContributionFlowMixin.get_permissions` in `heritage_graph/apps/cidoc_data/views.py`).

**Cultural Entities (prefix: `/data/`):**
- `/data/cultural-entities/` — CRUD + submit/review actions
- `/data/contribution-queue/` — pending contributions queue
- `/data/revisions/` — revision history
- **Unified contribution pipeline (2026-06):** one canonical status vocabulary +
  transition guard (`apps/cidoc_data/canonical_status.py`, exposed as `canonical_status`);
  wrappers FK-link their CIDOC row (`cidoc_content_type`/`cidoc_object_id`); published
  records are never edited in place — edits stage a `Revision` for re-review while the
  accepted content stays live (`accepted_revision`); RDF projection is deferred to
  `transaction.on_commit`. QR notes promote into this pipeline via
  `POST /data/public-contributions/<id>/review/` with `target_type` (returns
  `promoted_entity_id`). Details: `documentation/contribution/CONTRIBUTION_FLOW.md`.

**Contributor projects (API: `/api/v1/data/projects/`):**
- List/detail support DRF limit-offset pagination; unauthenticated `GET` may list/retrieve **public** dossiers only
- `POST` create accepts optional `Idempotency-Key` (24h replay returns the same project per user)
- `POST .../transition/` — lifecycle; `{"blockers": [...]}` when `in_review` prerequisites fail
- `POST .../<slug>/rollback-merge/` — **Moderators** move a **merged** project back to **needs_revision** (uses last merge snapshot record)
- Throttles: project create (~10/h) and multipart asset upload (~50/day); env `PROJECT_ASSET_UPLOAD_MAX_BYTES`, `REVIEW_WEBHOOK_URL`

**Epistemic Review (prefix: `/data/`):**
- `/data/review-queue/` — triaged queue (filterable: all, new_claims, conflicts, flagged, expiring); supports `ordering`, `stale_days`, `contradictions_only`, `max_trust_tier_rank`, `min_worst_source_rank`, `my_domain`; each row includes `triage_priority`, `triage_breakdown`, `worst_source_tier`, `worst_source_type`
- `/data/review-queue/triage-policy/` — active `TriagePolicy` weights (JSON) for UI parity with scoring
- `/data/review-queue/queue_counts/` — count per queue type
- `GET /data/api/review-workspace/<uuid>/` — three-panel workspace data (includes the same triage fields as the queue row when the entity is in scope)
- `POST /data/api/review-workspace/<uuid>/decide/` — submit review decision
- `/data/review-flags/` — CRUD + resolve action
- `/data/reviewer-roles/` — role management + my_role/assign actions
- `GET /data/api/reviewer-dashboard/` — reviewer stats and metrics

**Schema extension proposals (prefix: `/data/`; see spec 006):**
- `/data/schema-extension-proposals/` — list/create proposals (authors see their own; staff and `Moderators` see all)
- `/data/schema-extension-proposals/<uuid>/submit/`, `withdraw/`, `approve/`, `reject/`, `publish/`, `audit/` — lifecycle + append-only audit trail
- Env: `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` — writable LinkML overlay path for publish (documented in `heritage_graph/.env.example`)
- Ops: `python manage.py seed_triage_policy` — ensure default active `TriagePolicy` row exists after migrate

**Knowledge graph proposals (prefix: `/data/` and `/cidoc/`; see spec 007 and [`specs/007-entity-relationship-proposals/README.md`](specs/007-entity-relationship-proposals/README.md)):**
- `/data/entity-proposals/` and `/data/relationship-proposals/` — moderator-gated drafts (`Moderators` or staff approve/reject; authors see own rows); lifecycle actions `submit/`, `withdraw/`, `approve/`, `reject/`, `audit/`
- `/cidoc/relationship-predicates/` — controlled vocabulary for `relationship.*` assertions (public read)
- `GET /cidoc/entity-clusters/suggest-duplicates/` — canonical-label substring hints (`q`, optional `type_scope`; authenticated)
- Ops: `python manage.py seed_relationship_predicates` — seed predicate rows after migrate

**Public graph hygiene (see [`documentation/knowledge-graph/RDF_ENGINE.md`](documentation/knowledge-graph/RDF_ENGINE.md) §Operations):**
- `python manage.py kg_purge_orphans [--apply]` — remove `graph/public` subjects whose Postgres row was deleted. `rdf_rebuild` iterates live rows and cannot see them, so out-of-band deletions leave ghosts that render as real heritage in the KG projection, Atlas, and Museum. Pair as `rdf_rebuild && kg_purge_orphans --apply`
- Publication requires an identifying label: `has_publishable_label` (`apps/cidoc_data/publication_policy.py`) withholds rows whose `name`/`title` is blank or a single stray character, regardless of approval status
- Local dev only: a process with no writer handle caches a point-in-time `Store.read_only` snapshot, so a running dev server will not see writes made by a management command until restarted (`apps/graph/kg_engine/store.py`)

**OCR / Document processing (prefix: `/data/`, also available under `/api/v1/data/`):**
- `POST /data/ocr-documents/upload/` — multipart upload: creates `heritage_data.Media` and enqueues `document_processing.UploadedDocument` processing
- `GET /data/ocr-documents/<uuid>/` — OCR run status (includes JSON `processing_progress` while jobs run)
- `GET /data/ocr-documents/<uuid>/suggestions/` — JSON map of `ExtractedField` suggestions
- `GET /data/ocr-documents/<uuid>/review/` — supervised ingestion bundle (pages + OCR blocks + extracted fields + `saved_review_state`)
- `GET/PATCH /data/ocr-documents/<uuid>/review-state/` — persist contributor OCR / semantic draft (`field_decisions`, `block_corrections`, `ontology_handoff_key`)
- `POST /data/ocr-documents/<uuid>/finalize-review/` — stamp review completion (`finalized_at`) on draft JSON
- `GET /data/ocr-documents/<uuid>/compile-preview/` — server-side entity/relation sketch + `validation_errors` (no RDF in UI)
- `GET /data/ocr-documents/<uuid>/events/` — SSE stream of `{status, processing_progress}` (browser clients without Bearer on EventSource typically rely on polling the detail endpoint instead)
- `POST /data/ocr-documents/<uuid>/retry/` — staff-only requeue
- Chunked uploads (standalone ingestion): `POST /data/ocr-chunk-uploads/` (init JSON body), `POST /data/ocr-chunk-uploads/<uuid>/append/` (multipart `chunk`), `POST /data/ocr-chunk-uploads/<uuid>/complete/` → creates `Media` + OCR job (same signal-driven pipeline as multipart upload)
- Tabular (CSV / `.xlsx`): `POST /data/tabular-import-jobs/` (multipart file + provenance fields), `GET/PATCH /data/tabular-import-jobs/<uuid>/` (mapping + `row_review_state`), `GET /data/tabular-import-jobs/<uuid>/compile-preview/`

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

- `/` — **public UNESCO entry experience** (long-scroll editorial; works signed out). Facts come from `src/lib/unesco/ground-truth.ts`, photography from `src/data/unesco-imagery.json` (regenerate with `node scripts/freeze-unesco-imagery.mjs`). **Never render `node.unescoStatus` or UNESCO claims found in graph `rdfs:comment` literals** — both assert "World Heritage Site" on individual monument zones, and on Nyatapola Temple and the city of Bhaktapur, which are not zones at all. Resolve status through `src/lib/unesco/status.ts` instead.
- `/dashboard` — dashboard home (authenticated shell); moved off `/` in the 2026-08 entry redesign
- `/preview/entry-a`, `/preview/entry-b` — the two compositional directions the entry was chosen from; `noindex`, retained for comparison and safe to delete
- `/knowledge/<domain>` — knowledge base (entity, person, location, event, period, tradition, source)
- `/contribute/<domain>` — contribution forms (add `?id=<recordId>` to edit an existing CIDOC record)
- `/contribute/pattern/<slug>` — guided **semantic workflows** (`tools/semantic-patterns.yaml`; registry key as slug)
- `/curation/contributions` — moderation queue
- `/curation/activity` — activity log
- `/curation/review` — triaged epistemic review queue
- `/curation/projects-review` — contributor project dossiers in `in_review`
- `/curation/review/<id>` — three-panel review workspace (triage strip uses workspace payload)
- `/curation/schema-extensions` — schema extension proposals (authors + moderators)
- `/contribute/entity-proposal` — propose canonical identity clusters (contributors)
- `/contribute/relationship-proposal` — propose binary relationship assertions (contributors); draft load via **`?id=<uuid>`**; optional URL hints **`subjectType`**, **`objectType`**, **`subjectId`**, **`objectId`**, **`predicateCode`**, **`temporal`** (for deep-links from semantic pattern steps)
- `/curation/kg-proposals` — moderate submitted entity and relationship proposals (moderators)
- `/curation/conflicts` — conflict resolution queue
- `/curation/dashboard` — reviewer dashboard
- `/community/contributors` — contributor list
- `/graphview` — graph visualization
- `/atlas` — Heritage Atlas (Cesium globe): demo corpus by default; **live mode consumes the authoritative KG projection** `GET /api/v1/cidoc/kg/graph/` (same as the Museum) via `lib/atlas-kg-hydrate.ts` — IRI node ids, tiered coord provenance (verified/inherited/gazetteer/unmapped, shared `lib/kg-geo.ts`), real comments/media, assertion-backed edge provenance (no synthetic assertions); URL-synced `source`/`selected`/`panel`/`year`; curator Reviewed/All scope toggle; 5-min sessionStorage cache
- `/heritage-museum` — narrative knowledge graph: **Graph** (d3-force), **Map** (Leaflet), **Stories** (cinematic photo-essay reader). The Stories tab is *not* XR — `ImmersiveScene` is DOM/CSS. The three.js + WebXR `PanoramaViewer` is offered only when a hero image measures ~2:1 (`lib/heritage-museum/panorama-support.ts`), because wrapping an ordinary photo onto a sphere adds no immersion. Cross-links to Atlas via `lib/cross-surface-links.ts` (live mode only — demo corpora have unrelated ids)
- `/platform-admin` — In-app user and reviewer role management (staff / expert curator)

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
| `oxigraph` | ghcr.io/oxigraph/oxigraph | 7878 | — (internal RDF/SPARQL) |

---

## 🔄 Celery & Async Task Processing

**Status:** Infrastructure present; **OCR worker suspended** in active Docker compose.

HeritageGraph uses **Celery + Redis** when async tasks are enabled:
- Broker: Redis (`redis://localhost:6379` in dev, env-based in prod)
- Result backend: Redis (separate database)
- Development: `CELERY_TASK_ALWAYS_EAGER=True` (tasks run synchronously for debugging)
- Production: OCR `ocr-worker` service is **not** in the active stack (`OCR_ENABLED` defaults false)

**Key Files:**
- `heritage_graph/celery_app.py` — Celery app initialization
- `heritage_graph/settings/base.py` — Celery configuration
- `requirements.txt` — `celery`, `redis` dependencies
- `requirements-ocr.txt` — Heavy OCR-specific dependencies (separate)

---

## 📄 OCR & Document Processing Pipeline

**Status:** ⚠️ **Suspended** — `OCR_ENABLED` defaults false; `ocr-worker` removed from active compose. See [`documentation/pipelines/OCR.md`](documentation/pipelines/OCR.md).

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
- [`documentation/pipelines/OCR.md`](documentation/pipelines/OCR.md) — OCR pipeline architecture, implementation guide, and troubleshooting

---

## 🧪 Testing

- Platform E2E: `make test-e2e` (see [`tests/README.md`](tests/README.md))
- Backend unit: `cd heritage_graph && python manage.py test apps.cidoc_data`
- Frontend: No test framework configured yet
- Docker validation: `docker compose config --quiet`

---

## 📚 Related Documentation

| File | Purpose |
|------|---------|
| [`documentation/contribution/FORMS.md`](documentation/contribution/FORMS.md) | **How forms work** — registry-driven **`OntologyForm`**, semantic patterns |
| [`documentation/contribution/CONTRIBUTION_FLOW.md`](documentation/contribution/CONTRIBUTION_FLOW.md) | Contribution pipeline (form → review → graph), endpoints, de-fragmentation record |
| [`documentation/contribution/CONTRIBUTION_UI_REPORT.md`](documentation/contribution/CONTRIBUTION_UI_REPORT.md) | Contribution UI audit + live functionality verification matrix |
| [`documentation/auth/AUTH.md`](documentation/auth/AUTH.md) | Authentication — NextAuth + Google OAuth + Django verification |
| [`documentation/auth/AUTH_GUIDE.md`](documentation/auth/AUTH_GUIDE.md) | How to add new OAuth providers |
| [`documentation/api/VERSIONING.md`](documentation/api/VERSIONING.md) | API versioning (`/api/v1/...`) |
| [`documentation/testing/TESTING.md`](documentation/testing/TESTING.md) | E2E tests and validation (`make test-e2e`) |
| `CLAUDE.md` | Coding conventions for AI agents |
| [`documentation/developer/SKILLS.md`](documentation/developer/SKILLS.md) | Feature capabilities matrix |
| `ARCHITECTURE.md` | System design, data flow, component relationships |
| [`documentation/developer/CONVENTIONS.md`](documentation/developer/CONVENTIONS.md) | Code style and file organization |
| [`documentation/TROUBLESHOOTING.md`](documentation/TROUBLESHOOTING.md) | Known issues and debugging |
| [`documentation/i18n/TRANSLATION.md`](documentation/i18n/TRANSLATION.md) | i18n workflow |
| [`documentation/deployment/DEPLOYMENT.md`](documentation/deployment/DEPLOYMENT.md) | Production deployment |
| [`documentation/pipelines/OCR.md`](documentation/pipelines/OCR.md) | OCR pipeline (suspended) |
| [`specs/007-entity-relationship-proposals/README.md`](specs/007-entity-relationship-proposals/README.md) | Entity & relationship proposals (007) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contributor instructions |
