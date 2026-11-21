# HeritageGraph — System Overview

> **Purpose:** A single, top-to-bottom map of HeritageGraph: what the platform is, the
> parts it is built from, what each part does, how data flows between them, and — most
> importantly — *why* each major design choice was made. Start here, then drill into the
> focused docs ([ARCHITECTURE.md](../ARCHITECTURE.md), [knowledge-graph/RDF_ENGINE.md](knowledge-graph/RDF_ENGINE.md),
> [ontology/ONTOLOGY.md](ontology/ONTOLOGY.md), [auth/AUTH.md](auth/AUTH.md), [contribution/FORMS.md](contribution/FORMS.md))
> when you need detail.

---

## 1. What HeritageGraph Is

HeritageGraph (a CAIR-Nepal initiative) is a **Cultural Heritage Linked Open Data
platform**. Its goal is to digitally preserve, publish, and *democratize access to*
knowledge about cultural heritage — primarily Nepalese heritage — so that:

- 🕸️ **Crawlers** can index it,
- 🤖 **Agents / chatbots** can reason over it,
- 👩‍💻 **Developers** can query it (SPARQL + REST), and
- 💬 **Users** can ask questions and get grounded answers.

The platform is not just a database — it is a **knowledge graph** built on the
**CIDOC-CRM** cultural-heritage ontology, fed by **community contributions**, governed by a
**multi-tier human review workflow**, and published as **queryable RDF**.

---

## 2. The Big Picture (at a glance)

```
                  Contributors / Reviewers / Public
                                │
                         ┌──────▼──────┐
                         │   Traefik    │  reverse proxy, TLS, routing
                         └──────┬──────┘
            ┌───────────────────┼────────────────────┐
            ▼                   ▼                     ▼
     ┌────────────┐      ┌────────────┐        ┌────────────┐
     │  Frontend   │      │  Landing    │        │  Backend    │
     │  Next.js 15 │      │  Next.js 15 │        │  Django DRF │
     │  (dashboard)│      │  (marketing)│        │  (the API)  │
     └─────┬───────┘      └────────────┘        └─────┬──────┘
           │  Bearer (Google ID token)                │
           └──────────────────────────────────────────┤
                                                       │
              ┌──────────────┬───────────────┬───────────────────┐
              ▼              ▼               ▼                   ▼
        ┌──────────┐  ┌────────────┐  ┌──────────┐      ┌────────────┐
        │PostgreSQL │  │  Oxigraph  │  │  Redis +  │      │ OpenRouter │
        │ system of │  │  RDF / KG  │  │  Celery   │      │   (chat    │
        │  record   │  │  (SPARQL)  │  │  (async)  │      │ assistant) │
        └──────────┘  └────────────┘  └──────────┘      └────────────┘
```

**Two-store design is the heart of the system:**

| Store | Role | Why |
|-------|------|-----|
| **PostgreSQL** | *System of record* — forms, users, contributions, review state, audit | Relational integrity, transactions, mature Django tooling for CRUD/workflow |
| **Oxigraph** | *Knowledge graph runtime* — publishable RDF, SPARQL 1.1, named graphs | The graph is the *product*; Postgres rows are projected into RDF for query/publish |

Postgres holds the editable truth; the KG engine *materializes* the accepted subset
into RDF. See [§6 Knowledge Graph Engine](#6-knowledge-graph-engine-oxigraph).

---

## 3. The Parts of the System

### 3.1 Backend — Django REST Framework (`heritage_graph/`)

The API and data brain. Organized into focused Django apps under `heritage_graph/apps/`:

| App | Responsibility |
|-----|----------------|
| **`heritage_data`** | The contribution & governance core: `CulturalEntity` → `Revision` workflow, `ReviewerRole` / `ReviewDecision` / `ReviewFlag` (epistemic review), `Submission` (legacy), `Project`, `Organization`, schema-extension proposals, notifications, auth views |
| **`cidoc_data`** | Ontology **v1.0.0** (event-centric CIDOC-CRM + PROV-O): 26 navigable registry types including lifecycle events (`Production`, `Consecration`, `Enshrinement`, `TransferOfCustody`), tangible heritage (`ArchitecturalStructure`, `IconographicObject`, `Monument`), Kumari lifecycle, `HeritageAssertion`, identity (`EntityCluster`), LinkML schema registry, SHACL, RDF projection — see [ontology/ONTOLOGY.md](ontology/ONTOLOGY.md) |
| **`graph`** | The Knowledge Graph engine (`kg_engine/`): projects Postgres → RDF, talks to Oxigraph, serves KG stats / neighborhood / SPARQL, retries via outbox |
| **`document_processing`** | Document upload (storage/metadata). *(OCR and AI document-to-graph ingestion are currently **suspended** — `OCR_ENABLED` defaults to false and the `ocr-worker` service is removed from the active stack.)* |
| **`assistant`** | In-app chatbot — retrieval + grounding + OpenRouter chat completion, with a navigation allowlist |
| **`users`** | User profiles, auth auditing |

Settings are split (`settings/base.py` + `development.py` / `production.py`,
dispatched by `DJANGO_ENV`). Secrets come from the environment; never hardcoded.

### 3.2 Frontend — Next.js 15 dashboard (`heritage_graph_ui/`)

The App-Router UI where authenticated users browse, contribute, review, and visualize.
Major route groups under `src/app/(dashboard)/` (URLs have **no** `/dashboard` prefix):

- **`knowledge/`** — read/browse per domain (entity, person, location, structure, monument,
  production, consecration, festival, guthi, deity, ritual, entity_cluster, … — one route per registry key).
- **`contribute/`** — create/edit forms per domain (forms are **ontology-driven**, generated
  from the registry — see [contribution/FORMS.md](contribution/FORMS.md)).
- **`curation/`** — the review & moderation tools: triaged review queue, three-panel
  review workspace, conflict resolution, identity curation, reviewer dashboard.
- **`atlas/`**, **`heritage-museum/`**, **`graphview/`** — globe, museum XR, and Cytoscape graph.
- **`platform-admin/`** — in-app user/reviewer management (staff or expert curator).
- **`community/`**, **`leaderboard/`**, **`notification/`**, **`account/`** — engagement.

UI conventions: TypeScript + Tailwind v4 + shadcn/ui ("new-york"), named exports,
`process.env.NEXT_PUBLIC_API_URL` for the API base, Bearer-token fetches via NextAuth.

### 3.3 Landing — Next.js 15 marketing site (`heritage_graph_landing/`)

A separate app with different needs (Three.js, heavy animation, independent deploy cadence).
Kept apart so its build weight never slows the dashboard.

### 3.4 Ontology assets (`ontology/`, `tools/`, `HeritageGraph.ttl`)

The semantic backbone: **`ontology/HeritageGraph.yaml`** (LinkML v1.0.0), the CIDOC-CRM TBox
(`HeritageGraph.ttl`), generated SHACL shapes, and codegen tooling (`make generate`). UI exposure
is driven by **`tools/ui-classmap.yaml`** (26 navigable types). A generated registry ships to
the frontend (`registry.generated.json/.ts`) so forms and validation stay in sync. LinkedArt/LUX
interop classes in the YAML are RDF-only (not in the classmap). See [ontology/ONTOLOGY.md](ontology/ONTOLOGY.md).

### 3.5 Infrastructure

- **Traefik** — reverse proxy / TLS / routing via Docker labels.
- **PostgreSQL** — single database, system of record.
- **Oxigraph** — RDF triple store + SPARQL endpoint.
- **Redis** — Django cache (when `REDIS_URL` set) and Celery broker. OCR worker is **suspended** in active compose.
- **OpenRouter** — external LLM for the in-app assistant (chat).

---

## 4. Core Functionality (what the platform actually does)

### 4.1 Contribute knowledge

Users submit heritage data through **ontology-driven forms**. Contributions land as a
`CulturalEntity` with a versioned `Revision` (data stored as flexible `JSONField`).
Structured CIDOC domains (Person, Festival, Monument, …) also have dedicated models.

### 4.2 Review knowledge (epistemic workflow)

Every contribution moves through a **state machine** and a **multi-tier human review**:

```
draft → pending_review → accepted
                       → changes_requested → (revise) → pending_review
                       → rejected
```

The review queue is **triaged** into *New Claims*, *Conflicts*, *Flagged*, and *Expiring*,
and worked in a **three-panel workspace** (Context · Submission · Decision). Verdicts:
Accept / Accept-with-edits / Request changes / Reject / Escalate. Conflicts get their own
resolution outcomes (Supersedes / Coexist / Existing-stands / Refines / Disputed).

Reviewer tiers (see [§7 roles](#7-roles--permissions)): community reviewer → domain expert
→ expert curator.

### 4.3 Process documents (OCR) — suspended

Users can upload heritage documents (stored with metadata).

> **Note:** OCR text extraction **and** automated AI document-to-graph ingestion
> (LLM extraction → validation → graph assertions) are **currently suspended** and not part
> of the active platform. `OCR_ENABLED` defaults to false (uploads still succeed; no OCR
> runs) and the `ocr-worker` service is removed from the active Docker stacks. The code and
> docs are retained for future revival.

### 4.4 Resolve identity

The platform tracks when different rows refer to the *same* real-world referent via
`EntityCluster` + `HeritageAssertion(identity.same_referent)`. Reviewers triage
`IdentityResolutionCandidate`s; expert curators merge/split/lock clusters (optimistic
versioning + append-only audit). Knowledge pages fetch canonical labels from the
identity summary endpoint.

### 4.5 Publish & query the graph

Accepted data is projected into Oxigraph and served as **SPARQL 1.1** plus convenience
endpoints (`/cidoc/kg/stats/`, `/cidoc/kg/neighborhood/`, `/cidoc/kg/query/`). This is the
public, machine-readable product — the "linked open data" promise.

### 4.6 Ask the assistant

An in-app chatbot (`assistant` app) retrieves grounded context and answers via OpenRouter,
constrained to a navigation allowlist so it stays on-rails.

### 4.7 Extend the schema safely

Heritage domains evolve. Moderators propose schema extensions
(`SchemaExtensionProposal`: draft → submitted → approved → published). Publishing validates
LinkML, checks for conflicts, merges an overlay into the effective registry, and audits the
change — so the ontology grows without breaking existing data.

---

## 5. How Data Flows

### 5.1 Authentication

```
Browser → Frontend (NextAuth v4) → Google OAuth → id_token
Browser → Backend  (Bearer id_token) → google-auth verifies → auto-create User + Profile
```

The frontend obtains a Google **ID token** through NextAuth and sends it as a Bearer token.
Django's `GoogleTokenAuthentication` verifies signature/expiry/issuer/audience and
auto-provisions the Django user. See [auth/AUTH.md](auth/AUTH.md).

### 5.2 Contribution → Graph

```
Form (ontology-driven)
   → POST /api/v1/...            (Django)
   → CulturalEntity + Revision   (PostgreSQL — system of record)
   → review workflow             (accepted)
   → kg_engine projection        (Postgres row → RDF triples)
   → Oxigraph public named graph (queryable)
   ↺ RDFSyncOutbox retries failed writes
```

---

## 6. Knowledge Graph Engine (Oxigraph)

`apps/graph/kg_engine/` is the **single orchestration layer** between Postgres and RDF.
It partitions the graph for clean governance:

| Partition | Contents |
|-----------|----------|
| **PUBLIC** | Published CIDOC data + merged entities |
| **SCHEMA** | TBox from `HeritageGraph.ttl` |
| **DOCUMENT** | Reserved per-document partition (`graph/document/{uuid}`) — supports document-level retraction |
| **PROV** | Provenance bundles |

Operations: `make rdf-rebuild`, `make rdf-load-tbox`, `make rdf-diagnose`,
`make rdf-drain-outbox`. Master switch: `RDF_SYNC_ENABLED`. Full detail in
[knowledge-graph/RDF_ENGINE.md](knowledge-graph/RDF_ENGINE.md).

---

## 7. Roles & Permissions

| Role | Capabilities |
|------|--------------|
| Anonymous | Read public data, view API docs |
| Authenticated User | Create submissions, view own data, comment |
| Contributor | Create/edit own entities, suggest edits |
| Community Reviewer | Review assigned queue, flag, give feedback |
| Domain Expert | + override confidence, manage domain content |
| Expert Curator | + resolve conflicts, assign reviewer roles, identity merge/split, full moderation |
| Staff / Superuser | Admin / everything |

Defense-in-depth: Traefik (TLS, headers) → Docker network isolation → non-root containers
→ Django (CORS/CSRF/auth) → Google OAuth verification → Postgres least-privilege.

---

## 8. Why These Approaches? (design rationale)

This is the section to read if you're wondering *why* the system looks the way it does.

| Decision | Why |
|----------|-----|
| **Two stores: Postgres + Oxigraph** | The knowledge graph is the product, but graph stores are weak at transactional CRUD and workflow. Keep editable truth in Postgres (integrity, migrations, Django admin), *project* the accepted subset into RDF for query/publish. Best of both. |
| **CIDOC-CRM ontology** | The international standard for cultural-heritage knowledge. Adopting it makes the data interoperable and credible rather than a bespoke schema nobody else can use. |
| **LinkML registry drives forms + validation** | One source of truth for the schema generates backend serializers *and* frontend forms (`registry.generated.*`). Forms never drift from the ontology, and new domains need no hand-written UI. |
| **`JSONField` Revisions (new) vs 80+ CharFields (legacy `Submission`)** | Heritage schemas vary enormously by domain; rigid columns require a migration per field and don't scale. Flexible JSON snapshots support versioning and arbitrary shapes. The legacy flat model is being phased out. |
| **Epistemic review workflow (not simple approve/reject)** | Heritage knowledge is contested and uncertain. Triage + tiered reviewers + conflict resolution + confidence levels (`certain`/`likely`/`uncertain`) treat truth as *provenanced claims*, not binary facts. |
| **Google OAuth over self-hosted Keycloak** | Simpler ops — no auth server to run/patch; Google handles login security and UI; fewer containers. |
| **Django + Next.js split** | Django excels at data modeling/API/admin; Next.js excels at interactive UIs. Each tool does what it's best at. |
| **Separate landing app** | Heavy 3D/animation deps and an independent release cadence shouldn't bloat or block the dashboard build. |
| **Traefik over Nginx** | Native Docker service discovery via labels, automatic Let's Encrypt, no manual vhost config. |
| **Celery + Redis for async work** | OCR and other background jobs are I/O/compute-heavy; running them async keeps the API responsive and lets workers scale independently. |
| **Schema-extension proposals (governed)** | The ontology must evolve without breaking live data. A draft→approved→published flow with LinkML validation, conflict checks, and audit lets the schema grow safely. |
| **Identity clusters with optimistic versioning + audit** | Same-referent decisions are expert judgments that change over time and must be reversible and accountable — hence append-only audit and lock/merge/split semantics. |
| **Outbox for RDF sync** | Postgres write and Oxigraph write aren't atomic; the `RDFSyncOutbox` queues and retries failed projections so the graph eventually reflects accepted data. |

---

## 9. Where to Go Next

| Topic | Doc |
|-------|-----|
| Services, networks, data model, auth flow (detailed) | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Knowledge graph engine, partitions, SPARQL API | [knowledge-graph/RDF_ENGINE.md](knowledge-graph/RDF_ENGINE.md) |
| Ontology, CIDOC-CRM mapping, LinkML registry | [ontology/ONTOLOGY.md](ontology/ONTOLOGY.md) |
| Ontology-driven contribution forms | [contribution/FORMS.md](contribution/FORMS.md) |
| Authentication & roles | [auth/AUTH.md](auth/AUTH.md), [AUTH_ROLES_DEVELOPER_GUIDE.md](auth/AUTH_ROLES_DEVELOPER_GUIDE.md) |
| OCR pipeline | [pipelines/OCR.md](pipelines/OCR.md) |
| Deployment | [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) |
| Coding conventions for contributors / AI agents | [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md) |
| Testing & validation | [testing/TESTING.md](testing/TESTING.md) |
```