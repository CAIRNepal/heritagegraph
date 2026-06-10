# ARCHITECTURE.md — System Design & Data Flow

> **Purpose:** This file documents how HeritageGraph's services communicate, how data flows through the system, and why the architecture is structured this way. Read this to understand the big picture before making changes.

---

## 🏗️ System Architecture

```
                        ┌──────────────────────────────────────────────────────┐
                        │                    INTERNET                          │
                        └───────────────────────┬──────────────────────────────┘
                                                │
                                         ┌──────▼──────┐
                                         │   Traefik   │
                                         │  :80 / :443 │
                                         │ (rev proxy) │
                                         └──────┬──────┘
                                                │
                    ┌───────────────┬───────────┼───────────────────────────┐
                    │               │           │                           │
              ┌─────▼─────┐  ┌─────▼─────┐ ┌───▼───┐              ┌──────▼──────┐
              │ Frontend   │  │  Landing  │ │Backend│              │  Traefik    │
              │ Next.js 15 │  │ Next.js 15│ │Django │              │  Dashboard  │
              │ :3000      │  │ :3000     │ │:8000  │              │  :8080      │
              └─────┬──────┘  └───────────┘ └───┬───┘              └─────────────┘
                    │                           │
                    │    ┌──────────────────────┘
                    │    │
                    │    ▼
                    │  ┌───────────────┐     ┌────────────┐     ┌────────────┐
                    │  │  PostgreSQL   │     │   Redis    │     │ Oxigraph   │
                    │  │   :5432       │     │   :6379    │     │   :7878    │
                    │  │ heritage_db   │     │ cache/queue│     │ RDF/SPARQL │
                    │  └───────────────┘     └────────────┘     └────────────┘
                    │
                    │ (API calls with Bearer token)
                    └──────────► Backend :8000
```

---

## 🌐 Network Topology

### Docker Networks

| Network | Purpose | Services |
|---------|---------|----------|
| `proxy` | Traefik-routed traffic (external access) | traefik, backend, frontend, landing |
| `backend` | Internal service-to-service communication | postgres, backend, redis, oxigraph |

### Routing Rules (Traefik Labels)

| Host | Service | Port |
|------|---------|------|
| `localhost` / `frontend.localhost` | frontend | 3000 |
| `backend.localhost` | backend | 8000 |
| `landing.localhost` | landing | 3000 |
| `traefik.localhost` | traefik dashboard | 8080 |

In production, replace `.localhost` with your domain (e.g., `api.example.com`).

---

## 🔄 Authentication Flow

```
┌────────┐     ┌──────────┐     ┌──────────┐
│ Browser │────▶│ Frontend │────▶│  Google  │
│         │     │ Next.js  │     │  OAuth   │
└────┬───┘     └────┬─────┘     └────┬─────┘
     │              │                │
     │  1. Click    │  2. Redirect   │
     │  "Sign In"   │  to Google     │
     │              │  consent       │
     │              │                │
     │              │  3. User logs  │
     │              │  in at Google  │
     │              │                │
     │              │  4. Google     │
     │              │◀─ issues ──────┤
     │              │  id_token      │
     │              │                │
     │  5. NextAuth │                │
     │◀─ stores ────┤                │
     │   session    │                │
     │              │                │
     │  6. API call │                │
     │  with Bearer │                │
     │  id_token    │                │
     │              ▼                │
     │         ┌─────────┐          │
     │         │ Backend │          │
     │         │ Django  │          │
     │         └────┬────┘          │
     │              │               │
     │              │ 7. Verify     │
     │              │ Google ID     │
     │              │ token via     │
     │              │ google-auth   │
     │              │               │
     │              │ 8. Auto-create│
     │              │ User + Profile│
     │              ▼               │
     │         ┌─────────┐          │
     │         │  Django  │          │
     │         │   DB     │          │
     │         └─────────┘          │
```

### Token Flow Details

1. **Frontend** uses NextAuth v4 with Google OAuth provider
2. **NextAuth callbacks:**
   - `jwt` callback: stores Google's `account.id_token` into JWT
   - `session` callback: exposes `accessToken` (the Google ID token) on session object
   - `signIn` callback: verifies the provider token against Django (`GET /data/api/testme/`) before creating a session; failures redirect to `/auth/login?error=…` with a specific code
3. **Backend** `GoogleTokenAuthentication`:
   - Verifies Google ID token using `google-auth` library
   - Checks token signature, expiry, issuer (`accounts.google.com`), and audience
   - Auto-creates Django `User` + `UserProfile` from Google claims (email, given_name, family_name, sub)

---

## 📊 Data Model Architecture

### Two Parallel Systems

The codebase has two data architectures that co-exist:

#### 1. Legacy System: `Submission` (being phased out)
```
User ──creates──▶ Submission (80+ flat fields)
                      │
                      ├──▶ MediaAttachment (files)
                      ├──▶ ModerationRecord (review)
                      ├──▶ EditSuggestion (community edits)
                      ├──▶ VersionHistory (versions)
                      └──▶ Notification (alerts)
```
- Heritage data stored as individual `CharField` fields
- Rigid schema — adding new fields requires migrations
- Used by legacy `/data/api/form-submit/` and flat-field submission APIs (no dedicated UI route)

#### 2. New System: `CulturalEntity` → `Revision` (preferred)
```
User ──creates──▶ CulturalEntity
                      │
                      ├──▶ Revision (JSONField data)
                      │       └── Versioned snapshots
                      ├──▶ Activity (audit trail)
                      └──▶ Comment (discussion)
```
- Heritage data stored as flexible `JSONField` in `Revision`
- Schema-less — any data shape without migrations
- Supports contribution/moderation workflow with state machine:
  ```
  draft → pending_review → accepted
                         → rejected → (revise) → pending_review
  ```
- Used by `/contribute/entity/` and ontology-driven CIDOC forms

#### 3. CIDOC-CRM Ontology: `cidoc_data` app

Ontology **v1.0.0** in `ontology/HeritageGraph.yaml` — event-centric CIDOC-CRM + PROV-O. Exposed
types are listed in `tools/ui-classmap.yaml` (see [`documentation/ontology/ONTOLOGY.md`](documentation/ontology/ONTOLOGY.md)).

```
Spatiotemporal & actors          Tangible heritage              Events (lifecycle)
────────────────────────         ─────────────────              ──────────────────
Person, Location                 ArchitecturalStructure         HistoricalEvent
HistoricalPeriod, CalendarSystem IconographicObject, Monument   RitualEvent, Festival
Deity, Tradition (ReligiousTrad.)                               Production, Consecration
Guthi, CasteGroup                                               Enshrinement, TransferOfCustody
                                                                KumariTenure/Selection/Retirement

Provenance & identity            LinkML-only (no forms)
─────────────────────            ─────────────────────
Source (InformationObject)       Material, Technique, DocumentationActivity
DataSource (lookup)              LinkedArt/LUX interop classes (Acquisition, Birth, …)
HeritageAssertion, EntityCluster
SyncreticRelationship
```

- Each mapped model has a ViewSet at the path in `ui-classmap.yaml` (e.g. `/cidoc/productions/`)
- Registry keys ↔ Django models: `cidoc_registry_keys.py`
- `PersonRevision` auto-tracks Person changes via `post_save` signal
- **Identity layer**: `EntityCluster` anchors referents per `type_scope`; same-referent
  membership is stored on `HeritageAssertion` rows (`asserted_property=identity.same_referent`,
  `entity_cluster` FK). Expert curators merge/split/lock clusters (optimistic `version`, append-only
  `ClusterAuditEvent`). Reviewers triage `IdentityResolutionCandidate` via
  `/api/v1/cidoc/identity-candidates/`; the Next.js queue lives at `/curation/identity`. Knowledge
  entity pages call `GET /api/v1/cidoc/identity-summary/` for canonical labels and competing
  clusters.

### Entity Relationship Map

```
Django Auth User
  │
  ├──1:1──▶ UserProfile (extended profile, Google-synced)
  ├──1:1──▶ UserStatistics (auto-calculated via signals)
  ├──1:1──▶ Contributor (metadata)
  │
  ├──1:N──▶ CulturalEntity (new workflow)
  │              ├──1:N──▶ Revision
  │              ├──1:N──▶ Activity
  │              ├──1:N──▶ Comment
  │              ├──1:N──▶ ReviewDecision (epistemic review verdicts)
  │              └──1:N──▶ ReviewFlag (quality/concern flags)
  │
  ├──1:1──▶ ReviewerRole (community_reviewer | domain_expert | expert_curator)
  │
  ├──1:N──▶ Submission (legacy workflow)
  │              ├──1:N──▶ MediaAttachment
  │              ├──1:1──▶ ModerationRecord
  │              ├──1:N──▶ EditSuggestion
  │              ├──1:N──▶ VersionHistory
  │              └──1:N──▶ Notification
  │
  ├──1:N──▶ Person, Location, Event, HistoricalPeriod, Tradition, Source (cidoc_data)
  │              └── Person → PersonRevision
  ├──1:N──▶ ArchitecturalStructure, IconographicObject, Monument, Deity, Guthi, …
  ├──1:N──▶ Production, Consecration, Enshrinement, TransferOfCustody, RitualEvent, Festival
  ├──1:N──▶ HeritageAssertion, EntityCluster, SyncreticRelationship
  └── (full registry ↔ model map: `cidoc_registry_keys.py`)
```

---

## 🖥️ Frontend Architecture

### App Router Structure

```
src/app/
├── layout.tsx                      ← Root: fonts, SessionProvider, ThemeProvider
├── api/auth/[...nextauth]/         ← NextAuth API route
│
└── (dashboard)/                    ← Route group (URLs have NO /dashboard prefix)
    ├── layout.tsx                  ← Sidebar shell, ontology provider, chat
    ├── page.tsx                    ← Dashboard home (/)
    │
    ├── knowledge/                  ← Browse (entity, person, location, structure, …)
    ├── contribute/                 ← OntologyForm per domain + semantic patterns
    │   ├── entity/, person/, location/, structure/, production/, consecration/, …
    │   ├── pattern/[slug]/       ← Guided semantic workflows
    │   ├── entity-proposal/, relationship-proposal/
    │   └── projects/             ← Contributor project dossiers
    │
    ├── curation/                   ← Review & moderation
    │   ├── contributions/, activity/, review/[id]/
    │   ├── identity/, conflicts/, kg-proposals/, schema-extensions/
    │   └── dashboard/            ← Reviewer metrics
    │
    ├── atlas/                      ← Heritage Atlas (Cesium globe + live KG)
    ├── heritage-museum/            ← Museum XR / narrative graph
    ├── graphview/                  ← Cytoscape graph visualization
    ├── platform-admin/             ← Staff / expert-curator user management
    ├── community/, leaderboard/, notification/, account/, …
    └── …
```

**Auth gating:** `middleware.ts` protects `/curation`, `/platform-admin`, `/moderate`,
`/account`, `/notification`, `/progression`. `/contribute` uses `RequireAuth` in
`(dashboard)/contribute/layout.tsx`.

### Component Hierarchy

```
RootLayout (fonts, providers)
  └── SessionProvider
      └── ThemeProvider
          └── DashboardLayout
              ├── SidebarProvider
              │   ├── AppSidebar
              │   │   ├── NavGroup (Knowledgebase)
              │   │   ├── NavGroup (Curation)
              │   │   ├── NavGroup (Community)
              │   │   └── NavUser (auth + avatar)
              │   └── SidebarInset
              │       ├── SiteHeader (search, nav links)
              │       └── {page content}
              └── Sonner (toast notifications)
```

### Data Flow Pattern

```
Page Component
  │
  ├── useSession() → get accessToken
  │
  ├── useEffect() → fetch from backend API
  │       │
  │       ├── GET /data/... or /cidoc/...
  │       │   headers: { Authorization: Bearer <token> }
  │       │
  │       └── Response → useState → render
  │
  └── DataTable component
      ├── TanStack React Table (sorting, filtering, pagination)
      ├── dnd-kit (row reordering)
      └── Drawer (row detail view)
```

### Epistemic Review Flow

```
Contribution submitted (CulturalEntity → pending_review)
        │
        ▼
┌─────────────────────────┐
│  Review Queue (Triaged)  │
│  ├── New Claims          │  (no prior reviews)
│  ├── Conflicts           │  (competing assertions)
│  ├── Flagged             │  (community-flagged concerns)
│  └── Expiring            │  (stale reviews > 14 days)
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Three-Panel Review Workspace               │
│  ┌───────────┬──────────────┬─────────────┐ │
│  │  Context   │  Submission  │  Decision   │ │
│  │  - entity  │  - revision  │  - verdict  │ │
│  │  - flags   │  - data      │  - conflict │ │
│  │  - history │  - contrib   │  - override │ │
│  │  - reviews │  - record    │  - feedback │ │
│  └───────────┴──────────────┴─────────────┘ │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Review Decision     │
│  ├── Accept          │ → entity.status = accepted
│  ├── Accept w/ Edits │ → entity.status = accepted
│  ├── Request Changes │ → entity.status = changes_requested
│  ├── Reject          │ → entity.status = rejected
│  └── Escalate        │ → escalated_to = expert curator
└────────┬────────────┘
         │
         ▼ (if conflicts)
┌─────────────────────┐
│  Conflict Resolution │
│  ├── Supersedes      │ → old assertion superseded
│  ├── Coexist         │ → both assertions valid
│  ├── Existing Stands │ → new assertion dismissed
│  ├── Refines         │ → adds nuance
│  └── Disputed        │ → marked for further review
└─────────────────────┘
```

### Schema extension approval & registry merge

Moderators manage `SchemaExtensionProposal` rows (draft → submitted → approved → published). **Publish** validates LinkML YAML, checks overlapping `conflict_keys` against other active proposals, writes bytes to `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH`, appends `SchemaExtensionAuditEvent`, and triggers `cidoc_data.linkml_loader` cache refresh so `get_effective_registry_payload` reflects the merged extension overlay (`ontology_builder.merge_extension_registry_overlay`).

The **`GET /api/v1/cidoc/schema/registry/`** response includes **`classes`**, **`enums`**, **`contribute_hub`**, **`semantic_patterns`** (from `tools/semantic-patterns.yaml`), and **`registry_jsonschema`**.

### Knowledge Graph Engine (Oxigraph)

When **`RDF_SYNC_ENABLED`** is set, **`apps/graph/kg_engine/`** is the single orchestration layer: registry projection → **public named graph**, optional SHACL, agent promotion on auto-accept, and **`RDFSyncOutbox`** retries. HTTP: `GET /cidoc/kg/stats/`, `GET /cidoc/kg/neighborhood/?uri=…`, `POST /cidoc/kg/query/`. See **`documentation/knowledge-graph/RDF_ENGINE.md`**. Ops: `make rdf-rebuild`, `make rdf-diagnose`, `make rdf-load-tbox`, `make rdf-drain-outbox`.

---

## 🐳 Docker Architecture

### Container Lifecycle

```
docker-compose up --build
  │
  ├── 1. postgres starts
  │       └── init-scripts/01-init-databases.sh creates DBs
  │       └── healthcheck: pg_isready
  │
  ├── 2. redis starts (no dependencies)
  │       └── listens on :6379
  │       └── used as Celery broker + result backend
  │       └── healthcheck: redis-cli ping
  │
  ├── 3. traefik starts (no dependencies)
  │       └── reads docker labels for routing
  │
  ├── 4. oxigraph starts (no strict dependency)
  │       └── SPARQL endpoint on :7878
  │
  ├── 5. backend starts (depends: postgres healthy)
  │       └── heritage_graph/entrypoint.sh:
  │           ├── wait for DB connection
  │           ├── run migrations (+ optional MIGRATION_AUTO_REPAIR)
  │           ├── collect static files (production)
  │           ├── create superuser (if env set)
  │           ├── seed relationship predicates
  │           ├── rdf_load_tbox + rdf_rebuild --if-empty (when RDF_SYNC_ENABLED)
  │           ├── bootstrap_identity_clusters + refresh_identity_candidates --auto-merge
  │           └── exec gunicorn (4 workers)
  │       └── healthcheck: /health/
  │
  ├── 6. frontend starts (no strict dependency)
  │       └── Next.js production server
  │       └── healthcheck: GET /
  │
  └── 7. landing starts (no strict dependency)
          └── Next.js production server
          └── healthcheck: GET /

  # ocr-worker — SUSPENDED (comment block in docker-compose.yml; OCR_ENABLED defaults false)
```

### Build Stages

**Backend (`Dockerfile.backend`) — Multi-Stage Build:**
```
Stage 1: base-builder (python:3.12-slim-bookworm)
  └── install build deps, create pip wheels for main requirements

Stage 2: ocr-builder (python:3.12-slim-bookworm) — for suspended OCR worker target only
  └── install tesseract, PyTorch system deps
  └── create pip wheels for requirements-ocr.txt

Stage 3: runtime-lean (python:3.12-slim-bookworm) ← MAIN BACKEND IMAGE (active)
  └── install runtime deps only (libpq, curl, postgresql-client)
  └── copy wheels from base-builder
  └── non-root user: django (1000)
  └── CMD: gunicorn with 4 workers
  └── Size: ~600MB (lightweight, no OCR)

Stage 4: ocr-worker (python:3.12-slim-bookworm) ← SUSPENDED (not in active compose)
  └── install full runtime + OCR deps (tesseract, libsm6, libgomp1)
  └── copy wheels from both builders
  └── non-root user: django (1000)
  └── CMD: celery worker (processes OCR tasks)
  └── Size: ~3GB (includes torch, transformers, etc.)
```

**Design Rationale:**
- Separate images allow lean main backend (~600MB) vs. fat OCR worker (~3GB)
- Faster deployment iteration on backend (small image)
- Flexible scaling: run multiple generic backends, fewer expensive OCR workers
- Development: both stages available for local testing

**Frontend (`heritage_graph_ui/Dockerfile`):** Docker build context is the **repository root** (compose sets `context: .`) so `npm run build` can run `python3 ../tools/gen_heritage_viz_config.py` with `ontology/` and `tools/` present. Builder installs `python3` and `py3-yaml` on Alpine.
```
dependencies (node:20-alpine)
  └── production npm install (optional cache stage)

builder (node:20-alpine + python3)
  └── COPY ontology, tools, heritage_graph_ui → npm run build (prebuild runs codegen)

runner (node:20-alpine)
  └── copy .next/standalone + static + public
  └── non-root user: nextjs (1001)
  └── CMD: node server.js
```

---

## 🔐 Security Architecture

### Defense in Depth

```
Internet
  │
  ▼
Traefik (TLS termination, rate limiting, security headers)
  │
  ▼
Docker Network (proxy) — only Traefik-connected services are reachable
  │
  ▼
Service (non-root containers, read-only where possible)
  │
  ▼
Django (CORS, CSRF, authentication middleware)
  │
  ▼
Google OAuth (ID tokens verified via google-auth library)
  │
  ▼
PostgreSQL (user-level access, connection limits)
```

### Permission Model

| Role | Source | Capabilities |
|------|--------|--------------|
| Anonymous | — | Read public data, view API docs |
| Authenticated User | — | Create submissions, view own data, comment |
| Contributor | "Contributors" | Create/edit own entities, suggest edits |
| Community Reviewer | `ReviewerRole(role='community_reviewer')` | Review assigned queue, flag submissions, provide feedback |
| Domain Expert | `ReviewerRole(role='domain_expert')` | All community reviewer permissions + override confidence, manage domain-specific content |
| Expert Curator | `ReviewerRole(role='expert_curator')` | All domain expert permissions + resolve conflicts, assign reviewer roles, full moderation |
| Staff | `is_staff=True` | Full admin access, user management |
| Superuser | `is_superuser=True` | Everything |

---

## 📡 Inter-Service Communication

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Browser | Traefik | HTTPS | All external traffic |
| Traefik | Frontend | HTTP | Proxy Next.js |
| Traefik | Backend | HTTP | Proxy Django API |
| Frontend | Google | HTTPS | OAuth consent flow (via NextAuth) |
| Frontend | Backend | HTTP (internal) | API calls (via browser, through Traefik) |
| Backend | Google | HTTPS | Verify ID tokens (via google-auth) |
| Backend | PostgreSQL | TCP | Database queries |
| Backend | Redis | TCP:6379 | Django cache (optional) + Celery broker when async tasks enabled |
| Backend | Oxigraph | HTTP:7878 | RDF UPDATE/QUERY (`RDF_ENDPOINT_URL`, `RDF_QUERY_URL`) |
| Backend | OpenRouter API | HTTPS | In-app chat (`/api/v1/assistant/chat/`; tiered models) |
| *(suspended)* OCR Worker | Redis / Postgres / Anthropic | — | OCR pipeline paused; `ocr-worker` not in active compose |
---

## 📐 Design Decisions & Rationale

| Decision | Why |
|----------|-----|
| **Traefik over Nginx** | Native Docker integration, automatic service discovery via labels, built-in Let's Encrypt |
| **Google OAuth over Keycloak** | Simpler ops — no self-hosted auth server to maintain, Google handles login UI/security, fewer Docker services |
| **JSONField for entity data** | Heritage data schemas vary widely; rigid columns don't scale |
| **Separate landing page app** | Different tech requirements (Three.js, heavy animations), independent deploy cycle |
| **Django + Next.js** | Django excels at data modeling/API; Next.js excels at interactive UIs |
| **PostgreSQL single database** | Simpler ops for small team; no longer need a separate Keycloak DB |
| **Multi-stage Docker builds** | Smaller images, faster deploys, no build tools in production |
| **Non-root containers** | Security best practice — limits blast radius of container escape |
| **Celery + Redis for async tasks** | OCR is I/O-heavy; async prevents blocking Django. Redis scales to multiple workers, persistent queues. Alternatives: RQ (simpler, less reliable), APScheduler (no queue). Celery is battle-tested. |
| **Separate OCR worker image** | Heavy deps (PyTorch, Tesseract) don't belong in main backend. Separate image: lean backend (~600MB) vs. fat worker (~3GB). Run fewer OCR workers, many generic backends. |
| **requirements-ocr.txt separate file** | OCR deps are massive; separating them clarifies what goes where. Easy to skip in lightweight builds. |
