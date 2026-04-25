# Implementation Plan: Identity Layer (Claim-First)

**Branch**: `005-identity-layer` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-identity-layer/spec.md`

## Summary

Deliver a **claim-first identity layer**: `EntityCluster` as a stable anchor per heritage class scope; **same-referent membership** stored as `HeritageAssertion` rows with a dedicated `asserted_property` literal and a new **`entity_cluster` FK**; **derived** active membership and **competing-identities** detection from non-superseded accepted rows; **append-only** `ClusterAuditEvent` for merge/split/lock/unlock; **DRF** endpoints under `/api/v1/cidoc/`; **bootstrap** command for singleton clusters; **LinkML + registry** alignment; **Next.js** Identity Resolution Workspace (three-panel) plus knowledge-page **canonical label / aliases / competing view** extensions.

Design resolution: see [research.md](./research.md). Physical schema: [data-model.md](./data-model.md). API contract sketch: [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml). Verification steps: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: Python 3.13 (Dockerfile.backend), TypeScript / Next.js 15 for `heritage_graph_ui`  
**Primary Dependencies**: Django, Django REST Framework, NextAuth (Google), shadcn/ui, Tailwind, LinkML / registry generator (`tools/linkml_generate_registry.py`)  
**Storage**: PostgreSQL (production); SQLite acceptable for local dev migrations smoke tests  
**Testing**: `pytest` for backend; `npm run build` / `tsc` for frontend per repo scripts  
**Target Platform**: Linux containers (Docker / Compose / Traefik per repo)  
**Project Type**: Web application (Django API + Next.js App Router dashboard)  
**Performance Goals**: Identity list and member endpoints remain usable at **10k+** entities (indexed FK + property filters; avoid N+1 on members)  
**Constraints**: Constitution — no committed secrets; Bearer auth for protected routes; ruff + TS gates; append-only audit (no update/delete HTTP for audit)  
**Scale/Scope**: ~16 CIDOC entity types receive bootstrap; reviewer queue MVP with rule-based candidates (no ML)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --- | --- | --- |
| Secrets & config | **Pass** | No new secrets; if new public env vars appear (e.g. feature flags), document in `.env.example` |
| Django/DRF + Next conventions | **Pass** | New models use UUID PK + `db_table` + timestamps; ViewSets + `DefaultRouter`; UI uses `NEXT_PUBLIC_*` + Bearer from session |
| Auth contract | **Pass** | Workspace and write endpoints require `Authorization: Bearer <accessToken>` |
| Quality gates | **Pass** | Ruff + TS build for touched paths |
| Deployability | **Pass** | Migrations reversible where feasible; rollout = migrate → bootstrap command → deploy UI; document order in quickstart |

### Post–Phase 1 re-check

Design artifacts introduce **no** constitution violations. Breaking API additions are additive (new routes + optional query params on assertions list).

## Project Structure

### Documentation (this feature)

```text
specs/005-identity-layer/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions (R-001 … R-008)
├── data-model.md        # Phase 1 — entities and validation
├── quickstart.md        # Phase 1 — dev verification
├── contracts/
│   └── openapi-identity-layer.v1.yaml
└── tasks.md             # Produced by /speckit.tasks (not this command)
```

### Source Code (repository root)

```text
heritage_graph/apps/cidoc_data/
├── models.py                 # EntityCluster, ClusterAuditEvent, HeritageAssertion.entity_cluster, IdentityResolutionCandidate
├── migrations/
├── serializers.py            # Cluster serializers; extend HeritageAssertionSerializer
├── views.py                  # EntityClusterViewSet; actions merge/split/lock/unlock/members/audit; extend assertion filters
├── urls.py                   # router.register entity-clusters, identity-candidates
├── permissions.py            # Optional thin wrappers; reuse heritage_data permissions
├── identity_constants.py     # NEW — predicate literal, source ordering helper
├── management/commands/
│   ├── bootstrap_identity_clusters.py
│   └── refresh_identity_candidates.py

ontology/
└── HeritageGraph.yaml        # EntityCluster class + membership predicate documentation

tools/
├── ui-classmap.yaml          # If cluster exposed in UI registry
└── contribute-hub.yaml       # Optional — reviewer-only may omit contributor intents

heritage_graph_ui/src/
├── app/(dashboard)/
│   └── curation/identity/    # NEW — workspace list + [pairId] three-panel page (or equivalent path)
├── components/knowledge/     # Extend why-we-believe / entity header for cluster + competing state
└── lib/api-client.ts         # Reuse apiFetchJson + Bearer

.specify/memory/constitution.md
```

**Structure Decision**: Backend changes live primarily in **`cidoc_data`** beside existing `HeritageAssertion` and router. Frontend mirrors **`(dashboard)/curation/review/[id]`** layout for the new workspace. Ontology changes follow the **004-yaml-driven-schema** pipeline.

## Complexity Tracking

No constitution violations required justification for this feature.

---

## Phase 0 — Research (complete)

All technical unknowns from the spec were resolved without blocking contradictions. Consolidated decisions: [research.md](./research.md).

## Phase 1 — Design & contracts (complete)

| Artifact | Path |
| --- | --- |
| Data model | [data-model.md](./data-model.md) |
| OpenAPI sketch | [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml) |
| Dev verification | [quickstart.md](./quickstart.md) |

## Phase 2 — Tasks

`/speckit.tasks` should break down: migrations + models, serializers/views/router, services (merge/split with `@transaction.atomic`), bootstrap + refresh commands, ontology + registry keys, UI workspace pages, knowledge extensions, pytest coverage, `AGENTS.md` / `ARCHITECTURE.md` updates if topology changes.

**Stop**: Per Spec Kit workflow, **`tasks.md` is not created by `/speckit.plan`** — invoke `/speckit.tasks` next.
