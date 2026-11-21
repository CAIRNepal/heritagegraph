# Implementation Plan: Reviewer triage and schema extension approval

**Branch**: `006-reviewer-triage-and-approval` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/006-reviewer-triage-and-approval/spec.md`

## Summary

Deliver **composite triage scoring** on the existing **`CulturalEntity` review queue** (`ReviewQueueViewSet`): deterministic priority + human-readable breakdown, new **query params** for filters (stale days, min trust tier, contradictions compose with `queue_type`), **sort** by priority / oldest / updated, and **shareable view state** (URL query encoding without PII). Extend **`ContributionQueueSerializer`** (or parallel serializer method) and optionally annotate queryset for performance.

Deliver a **moderator-gated schema extension workflow**: persisted **`SchemaExtensionProposal`** + **`SchemaExtensionAuditEvent`** models, DRF ViewSet under **`heritage_data`** or **`cidoc_data`** (align with registry ownership), author draft/submit/withdraw, moderator approve/reject/publish with mandatory rationale on terminal decisions, **pre-publish validation** (duplicate keys, illegal removals), and **publish** step that materializes approved LinkML fragment to the configured extension path and **invalidates registry cache** so `schema_version` / `extension_hash` advance. **Follow-up**: ensure `ontology_builder.build_registry_document` (or pipeline) **merges** extension YAML into the effective schema if not already done — today `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` participates in **hashing** only ([research.md](./research.md) R-006).

Design: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: Python 3.13 (backend Docker image), TypeScript / Next.js 15 (`heritage_graph_ui`)  
**Primary Dependencies**: Django, Django REST Framework, NextAuth (Google), shadcn/ui, LinkML / `linkml_loader` / `ontology_builder`  
**Storage**: PostgreSQL (production); SQLite for local migration smoke tests  
**Testing**: `pytest` for backend; `npm run build` / `tsc` for frontend  
**Target Platform**: Linux containers (Docker / Compose / Traefik per repo)  
**Project Type**: Web application (Django API + Next.js App Router dashboard)  
**Performance Goals**: Queue list with triage annotations stays under **~500 ms p95** for 200 visible rows (annotate + prefetch sources/flags; avoid N+1)  
**Constraints**: Constitution — env-driven config; Bearer auth; no committed secrets; ruff + TS gates; triage weights in DB or `django-constance` / JSON settings file with validation bounds  
**Scale/Scope**: One queue API extension + 2–4 UI pages/sections (curation review list, optional detail strip, moderator proposal list + detail); ~2 new tables + migrations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --- | --- | --- |
| Secrets & config | **Pass** | New public env vars only if needed (e.g. feature flags); document in `.env.example`. Publish path continues to use existing `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` — no secrets in YAML. |
| Django/DRF + Next conventions | **Pass** | New models: UUID PK, `db_table`, timestamps; ViewSets + router; permissions reuse `IsCommunityReviewer` / `Moderators` group check pattern from `heritage_data/permissions.py` |
| Auth contract | **Pass** | Queue remains reviewer-authenticated; proposal writes use Bearer; moderator actions use dedicated permission class |
| Quality gates | **Pass** | Ruff + TS for touched paths |
| Deployability | **Pass** | Migrations ordered before UI; publish documented as “migrate → deploy API → run registry check / `make ontology-check` in CI”; rollback = new proposal reverting file + audit |

### Post–Phase 1 re-check

Design adds **additive** API fields and new routes; no removal of existing queue params. Schema publish touches **filesystem** on app server — document ops requirement (single writer, backup) in quickstart.

## Project Structure

### Documentation (this feature)

```text
specs/006-reviewer-triage-and-approval/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── openapi-reviewer-triage.v1.yaml
│   └── openapi-schema-extension-proposals.v1.yaml
└── tasks.md             # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
heritage_graph/apps/heritage_data/
├── models.py                 # SchemaExtensionProposal, SchemaExtensionAuditEvent (or new models.py slice)
├── migrations/
├── serializers.py            # Extend ContributionQueueSerializer — triage_priority, triage_breakdown, worst_source_tier
├── views.py                  # ReviewQueueViewSet — new filters, ordering by annotation; optional separate action for triage config GET
├── permissions.py            # IsModeratorForSchemaProposals (group-based) + reuse IsAuthenticated
├── urls.py                   # register schema-extension-proposals viewset
├── services/
│   ├── triage_scoring.py     # NEW — pure functions: score + breakdown from entity + flags + sources
│   └── schema_proposal_publish.py  # NEW — validate, write YAML, bump cache, record version

heritage_graph/apps/cidoc_data/
├── linkml_loader.py          # Optional — ensure publish clears _CACHE after file write
├── ontology_builder.py       # If needed — merge extension YAML into build_registry_document

heritage_graph_ui/src/
├── app/(dashboard)/curation/review/page.tsx    # Sort, filters, badges, share URL sync
├── app/(dashboard)/curation/review/[id]/page.tsx  # Triage breakdown strip (optional)
├── app/(dashboard)/curation/schema-extensions/   # NEW — list + [id] moderator/author UI
├── hooks/use-user-roles.ts   # Reuse isModerator
└── lib/api-client.ts         # Bearer — existing patterns

.env.example                    # Document any new NEXT_PUBLIC_* or backend-only vars
```

**Structure Decision**: Triage logic stays in **`heritage_data`** beside `ReviewQueueViewSet`. Schema proposals can live in **`heritage_data`** (curation domain) or **`cidoc_data`** (ontology domain); this plan places **models + API in `heritage_data`** to co-locate with review permissions, with **publish** calling **`cidoc_data`** helpers for registry rebuild / cache invalidation.

## Complexity Tracking

No constitution violations requiring justification.

---

## Phase 0 — Research (complete)

Consolidated decisions: [research.md](./research.md).

## Phase 1 — Design & contracts (complete)

| Artifact | Path |
| --- | --- |
| Data model | [data-model.md](./data-model.md) |
| Review queue contract | [contracts/openapi-reviewer-triage.v1.yaml](./contracts/openapi-reviewer-triage.v1.yaml) |
| Schema proposals contract | [contracts/openapi-schema-extension-proposals.v1.yaml](./contracts/openapi-schema-extension-proposals.v1.yaml) |
| Dev verification | [quickstart.md](./quickstart.md) |

## Phase 2 — Tasks

`/speckit.tasks` should break down: triage service + unit tests, queryset annotations, serializer fields, queue UI (sort/filter/share URL), proposal models + migrations + ViewSet + permissions, publish pipeline + ontology merge gap if any, OpenAPI alignment, pytest + Playwright/smoke optional, `AGENTS.md` / `ARCHITECTURE.md` if routes or ops topology change.

**Stop**: **`tasks.md` is not created by `/speckit.plan`** — invoke `/speckit.tasks` next.
