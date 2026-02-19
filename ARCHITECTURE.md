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
              │ Next.js 15 │  │ Next.js 14│ │Django │              │  Dashboard  │
              │ :3000      │  │ :3000     │ │:8000  │              │  :8080      │
              └─────┬──────┘  └───────────┘ └───┬───┘              └─────────────┘
                    │                           │
                    │    ┌──────────────────────┘
                    │    │
                    │    ▼
                    │  ┌───────────────┐
                    │  │  PostgreSQL   │
                    │  │   :5432       │
                    │  │               │
                    │  │ ┌───────────┐ │
                    │  │ │heritage_db│ │  ← Django's DB
                    │  │ │ database  │ │
                    │  │ └───────────┘ │
                    │  └───────────────┘
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
| `backend` | Internal service-to-service communication | postgres, backend |

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
   - `signIn` callback: calls Django backend to initialize user (`GET /data/testme/`)
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
- Used by the `/dashboard/contribute/places/` form

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
- Used by `/dashboard/contribute/entity/` form

#### 3. CIDOC-CRM Ontology: `cidoc_data` app
```
Person ──────┐
Location ────┤
Event ───────┤── Independent CRUD models
Period ──────┤   following CIDOC-CRM ontology
Tradition ───┤
Source ──────┘
     │
     └──▶ PersonRevision (auto-created via signals)
```
- Structured models for specific heritage domains
- Each has its own ViewSet at `/cidoc/<model>/`
- `PersonRevision` auto-tracks changes via `post_save` signal
- Plans for revision models on all entities (currently commented out)

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
  ├──1:N──▶ Person (cidoc_data)
  │              └──1:N──▶ PersonRevision
  ├──1:N──▶ Location (cidoc_data)
  ├──1:N──▶ Event (cidoc_data)
  ├──1:N──▶ HistoricalPeriod (cidoc_data)
  ├──1:N──▶ Tradition (cidoc_data)
  └──1:N──▶ Source (cidoc_data)
```

---

## 🖥️ Frontend Architecture

### App Router Structure

```
src/app/
├── layout.tsx                 ← Root: fonts, SessionProvider, ThemeProvider
├── page.tsx                   ← Landing page (/)
├── SessionProvider.tsx        ← NextAuth client wrapper
│
├── api/auth/[...nextauth]/    ← NextAuth API route
│
└── dashboard/
    ├── layout.tsx             ← Dashboard: SidebarProvider, AppSidebar
    ├── page.tsx               ← Dashboard home (/dashboard)
    │
    ├── knowledge/             ← Knowledge base (read/browse)
    │   ├── entity/
    │   ├── person/
    │   ├── location/
    │   ├── event/
    │   ├── period/
    │   ├── tradition/
    │   ├── source/
    │   └── places/
    │
    ├── contribute/            ← Contribution forms (create/edit)
    │   ├── entity/
    │   │   ├── edit/
    │   │   └── revise/
    │   ├── person/
    │   ├── location/
    │   ├── event/
    │   ├── period/
    │   ├── tradition/
    │   └── source/
    │
    ├── curation/              ← Moderation & review tools
    │   ├── contributions/     ← Contribution queue
    │   ├── activity/          ← Activity log
    │   ├── review/            ← Triaged epistemic review queue
    │   │   └── [id]/          ← Three-panel review workspace
    │   ├── conflicts/         ← Conflict resolution queue
    │   └── dashboard/         ← Reviewer dashboard
    │
    ├── community/             ← Community pages
    │   ├── contributors/
    │   └── organizations/
    │
    ├── graphview/             ← Knowledge graph visualization
    ├── moderate/              ← Legacy moderation page
    ├── leaderboard/           ← Contributor leaderboard
    ├── notification/          ← Notification center
    ├── versionviewer/         ← Version diff viewer
    ├── infobox/               ← Entity info display
    ├── team/                  ← Team page
    ├── account/               ← Account settings
    └── test/                  ← Development test page
```

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
  ├── 2. traefik starts (no dependencies)
  │       └── reads docker labels for routing
  │
  ├── 3. backend starts (depends: postgres healthy)
  │       └── entrypoint.sh:
  │           ├── wait for DB connection
  │           ├── run migrations
  │           ├── collect static files
  │           ├── create superuser
  │           └── exec gunicorn (4 workers)
  │       └── healthcheck: /health/
  │
  ├── 4. frontend starts (no strict dependency)
  │       └── Next.js production server
  │       └── healthcheck: GET /
  │
  └── 5. landing starts (no strict dependency)
          └── Next.js production server
          └── healthcheck: GET /
```

### Build Stages

**Backend (`Dockerfile.backend`):**
```
builder (python:3.13-slim)
  └── install build deps, create pip wheels

runtime (python:3.13-slim)
  └── install runtime deps only, copy wheels
  └── non-root user: django (1000)
  └── CMD: gunicorn with 4 workers
```

**Frontend (`heritage_graph_ui/Dockerfile`):**
```
dependencies (node:20-alpine)
  └── npm ci --only=production

builder (node:20-alpine)
  └── npm ci (all), npm run build

runner (node:20-alpine)
  └── copy prod node_modules + .next
  └── non-root user: nextjs (1001)
  └── CMD: npm run start
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
