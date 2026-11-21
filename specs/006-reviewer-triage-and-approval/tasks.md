# Tasks: Reviewer triage and schema extension approval

**Input**: Design documents from `/specs/006-reviewer-triage-and-approval/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi-reviewer-triage.v1.yaml](./contracts/openapi-reviewer-triage.v1.yaml), [contracts/openapi-schema-extension-proposals.v1.yaml](./contracts/openapi-schema-extension-proposals.v1.yaml), [quickstart.md](./quickstart.md)

**Tests**: Not requested in [spec.md](./spec.md); no dedicated test tasks. Add focused `pytest` for `triage_scoring` and publish validation if desired during implementation.

**Organization**: Phases follow user-story priority from [spec.md](./spec.md) (US1 + US2 are both P1; US3 is P2). Constitution gates apply to every task (see below).

## Constitution Gates (apply to all tasks)

Reference `.specify/memory/constitution.md`. When implementing each task:

- **Secrets/config**: No committed secrets; any new env vars in `heritage_graph/.env.example` and/or root `.env.example` as appropriate; frontend uses `process.env.NEXT_PUBLIC_*` only (no hardcoded `localhost` URLs).
- **Auth**: Protected UI calls use `Authorization: Bearer <accessToken>` from NextAuth session (`heritage_graph_ui/src/lib/api-client.ts` patterns).
- **Quality**: `ruff format` + `ruff check` on touched Python; TypeScript build/typecheck for touched `heritage_graph_ui/`.
- **Deployability**: Migrations reversible where feasible; rollout order in [quickstart.md](./quickstart.md) (migrate → seed policy → deploy API → UI).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel-safe (different files, no ordering dependency on incomplete sibling)
- **[USn]**: User story label from [spec.md](./spec.md)

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Config documentation and Python package layout for new services.

- [x] T001 Document `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` (and any triage-related backend env vars introduced) in `heritage_graph/.env.example` with non-secret placeholder comments per [plan.md](./plan.md).
- [x] T002 Create `heritage_graph/apps/heritage_data/services/__init__.py` so `services.triage_scoring` and `services.schema_proposal_publish` modules can live beside existing app code.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Persisted policy and proposal schema, permissions, and default triage policy row — **no user story API/UI work before this checkpoint**.

**⚠️ CRITICAL**: Phases 3–5 must not start until Phase 2 is complete.

- [x] T003 Add `TriagePolicy`, `SchemaExtensionProposal`, and `SchemaExtensionAuditEvent` models (UUID PK, `db_table`, timestamps, statuses, FKs) in `heritage_graph/apps/heritage_data/models.py` per [data-model.md](./data-model.md).
- [x] T004 Create Django migration under `heritage_graph/apps/heritage_data/migrations/` for all Phase-2 models (reversible where feasible).
- [x] T005 Register the new models in `heritage_graph/apps/heritage_data/admin.py` with list filters for `status` / `is_active` for operational use.
- [x] T006 Add moderator permission helper (e.g. `IsSchemaExtensionModerator`) in `heritage_graph/apps/heritage_data/permissions.py` requiring `Moderators` group (and document interaction with `is_staff` if any).
- [x] T007 Add management command `heritage_graph/apps/heritage_data/management/commands/seed_triage_policy.py` to insert or update the default active `TriagePolicy` row matching [spec.md](./spec.md) Assumptions and [research.md](./research.md) R-008.

**Checkpoint**: Migrated database, default triage policy present, admin can inspect proposal tables.

---

## Phase 3: User Story 1 — Reviewer sees a prioritized review queue (Priority: P1) 🎯 MVP (triage half)

**Goal**: Composite `triage_priority`, human-readable `triage_breakdown`, worst-source tier, deterministic ordering, new filters and sort on `GET /api/v1/data/review-queue/`, plus curation queue UI badges and controls.

**Independent Test**: Reviewer calls review queue with `ordering=-triage_priority` and filter query params; values match `heritage_graph/apps/heritage_data/services/triage_scoring.py` on fixture entities; UI shows badges and correct tab + filter combination per [spec.md](./spec.md) FR-016.

### Implementation for User Story 1

- [x] T008 [US1] Implement deterministic scoring and breakdown in `heritage_graph/apps/heritage_data/services/triage_scoring.py` per [research.md](./research.md) R-001 (normalize age/flags/conflict/source; tie-breakers; load active `TriagePolicy`).
- [x] T009 [US1] Implement worst-tier resolution from `HeritageAssertion` + `DataSource` for a `CulturalEntity` subject in `heritage_graph/apps/heritage_data/services/triage_sources.py` (import `cidoc_data` models; handle “unknown” per [research.md](./research.md) R-002).
- [x] T010 [US1] Extend `ContributionQueueSerializer` in `heritage_graph/apps/heritage_data/serializers.py` to emit `triage_priority`, `triage_breakdown`, `worst_source_tier`, and `worst_source_type` using T008–T009 (avoid N+1 in serializer — prefer annotated/prefetched data from the view).
- [x] T011 [US1] Extend `ReviewQueueViewSet` in `heritage_graph/apps/heritage_data/views.py`: prefetch/`select_related` plan for flags, assertions, and sources; apply `stale_days`, `contradictions_only`, `max_trust_tier_rank` query filters with documented precedence per [research.md](./research.md) R-003.
- [x] T012 [US1] Extend `ReviewQueueViewSet` in `heritage_graph/apps/heritage_data/views.py` to support `ordering=triage_priority` and `ordering=-triage_priority` alongside existing `created_at` / `updated_at` fields; set default ordering to triage-first when no `ordering` param (product choice — document in viewset docstring).
- [x] T013 [US1] Add `GET` detail=False action or sibling route `triage_policy/` on the review queue API in `heritage_graph/apps/heritage_data/views.py` returning active `TriagePolicy` JSON for reviewers per [contracts/openapi-reviewer-triage.v1.yaml](./contracts/openapi-reviewer-triage.v1.yaml).
- [x] T014 [US1] Update `heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx` to pass `ordering`, `stale_days`, `contradictions_only`, `max_trust_tier_rank`, and `my_domain` query params to the review-queue client using existing API base + Bearer patterns.
- [x] T015 [US1] Render triage priority, breakdown tooltips or inline badges, trust tier, stale and contradiction indicators per row in `heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx`.
- [x] T016 [P] [US1] Add optional triage breakdown panel or strip on `heritage_graph_ui/src/app/(dashboard)/curation/review/[id]/page.tsx` using the same policy + row fields as the list (FR-002).

**Checkpoint**: US1 independently demonstrable via API + curation review list (and optional detail strip).

---

## Phase 4: User Story 2 — Moderator schema extension approval (Priority: P1)

**Goal**: CRUD + lifecycle for `SchemaExtensionProposal`, append-only audit, moderator-only approve/reject/publish, YAML materialization, registry cache invalidation, and moderator/author UI.

**Independent Test**: Non-moderator receives 403 on approve/publish; moderator flow creates audit rows and updates `published_schema_version` / `extension_hash` after publish per [quickstart.md](./quickstart.md).

### Implementation for User Story 2

- [x] T017 [US2] Add `SchemaExtensionProposalSerializer`, `SchemaExtensionAuditEventSerializer`, and validation serializers (create/patch/submit) in `heritage_graph/apps/heritage_data/serializers.py` including `change_summary` structure for moderator UI per [data-model.md](./data-model.md).
- [x] T018 [US2] Implement human-readable `change_summary` builder (classes/slots/enums touched) in `heritage_graph/apps/heritage_data/services/schema_extension_summary.py` consumed by serializer or view.
- [x] T019 [US2] Implement `publish_proposal` (validate YAML, collision keys, atomic file write to `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH`, append audit, refresh versions) in `heritage_graph/apps/heritage_data/services/schema_proposal_publish.py`.
- [x] T020 [US2] Extend `heritage_graph/apps/cidoc_data/ontology_builder.py` (and/or loader entrypoints) so effective registry build **merges** extension LinkML per [research.md](./research.md) R-006; keep `compute_schema_version` consistent with on-disk extension bytes.
- [x] T021 [US2] Ensure `heritage_graph/apps/cidoc_data/linkml_loader.py` clears in-process cache after successful publish so `get_effective_registry_payload` returns fresh `schema_version` / `extension_hash`.
- [x] T022 [US2] Add `SchemaExtensionProposalViewSet` in `heritage_graph/apps/heritage_data/views.py` with list/retrieve/create/partial_update and `@action` methods `submit`, `withdraw`, `approve`, `reject`, `publish`, and `audit` per [contracts/openapi-schema-extension-proposals.v1.yaml](./contracts/openapi-schema-extension-proposals.v1.yaml); enforce permissions from T006.
- [x] T023 [US2] Register `router.register(r'schema-extension-proposals', ...)` in `heritage_graph/apps/heritage_data/urls.py` so routes appear under `/api/v1/data/` per `heritage_graph/urls.py`.
- [x] T024 [US2] Implement proposal **collision detection** (overlapping `conflict_keys` for concurrent `submitted`/`approved`) in submit/publish path per [research.md](./research.md) R-007 inside `heritage_graph/apps/heritage_data/services/schema_proposal_publish.py` or co-located validator.
- [x] T025 [US2] Add moderator/author list page `heritage_graph_ui/src/app/(dashboard)/curation/schema-extensions/page.tsx` with status filters and role-appropriate empty states.
- [x] T026 [US2] Add proposal detail workspace `heritage_graph_ui/src/app/(dashboard)/curation/schema-extensions/[id]/page.tsx` with YAML editor/viewer, change summary, audit timeline, and action buttons gated by `heritage_graph_ui/src/hooks/use-user-roles.ts` (`isModerator`).
- [x] T027 [US2] Add navigation entry for schema extensions under `heritage_graph_ui/src/app/(dashboard)/curation/layout.tsx` or `heritage_graph_ui/src/app/(dashboard)/curation/dashboard/page.tsx` visible to authors/moderators per product decision.

**Checkpoint**: US2 independently demonstrable end-to-end (API + UI) without US3 URL polish.

---

## Phase 5: User Story 3 — Reviewer shares filtered/sorted queue view (Priority: P2)

**Goal**: Filter, sort, `queue_type`, and `my_domain` restorable from URL; share link omits unsafe params; copy explains per-viewer `my_domain` semantics.

**Independent Test**: Two reviewers open the same query-only URL: identical tab/filter/sort; with `my_domain=true`, each sees their own expertise filter with on-screen explanation per [spec.md](./spec.md) US3.

### Implementation for User Story 3

- [x] T028 [US3] Initialize list state from `URLSearchParams` on load and push updates with `history.replaceState` or Next.js router in `heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx` for `queue_type`, `ordering`, `stale_days`, `contradictions_only`, `max_trust_tier_rank`, and `my_domain` (exclude raw `search` from “share link” payload per [research.md](./research.md) R-004).
- [x] T029 [US3] Add **Copy share link** control in `heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx` that copies the current query string (or warns when `search` is active).
- [x] T030 [US3] Add explicit helper text when `my_domain=true` is present in the URL that the filter uses the **current** reviewer’s `expertise_areas` in `heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx`.

**Checkpoint**: US3 verified without breaking US1 list behavior.

---

## Phase 6: Polish & cross-cutting concerns

**Purpose**: Contracts, docs, quality gates, and operational notes.

- [x] T031 [P] Update `specs/006-reviewer-triage-and-approval/contracts/openapi-reviewer-triage.v1.yaml` and `specs/006-reviewer-triage-and-approval/contracts/openapi-schema-extension-proposals.v1.yaml` to match final paths, param names, and response shapes once implemented.
- [x] T032 [P] Update `specs/006-reviewer-triage-and-approval/quickstart.md` with any divergences (exact action names, admin URLs, feature flags).
- [x] T033 [P] Update `AGENTS.md` with new models, management command, and API routes for this feature.
- [x] T034 [P] Update `ARCHITECTURE.md` if review queue or schema publish changes top-level data flows.
- [x] T035 Run `ruff format .` + `ruff check .` from `heritage_graph/` and `npm run build` from `heritage_graph_ui/` on touched paths to satisfy constitution quality gates.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user stories**.
- **Phase 3 (US1)** and **Phase 4 (US2)**: Both depend on Phase 2 only; may proceed **in parallel** after Phase 2 if staffed (touch mostly different files; coordinate if sharing `serializers.py` / `views.py` merges).
- **Phase 5 (US3)**: Depends on **Phase 3** list page existing (`curation/review/page.tsx`) — sequence after US1 UI tasks or merge in same PR series.
- **Phase 6 (Polish)**: Depends on completion of intended user story phases.

### User Story Dependencies

- **US1**: After Phase 2 — no dependency on US2/US3.
- **US2**: After Phase 2 — no hard dependency on US1 (different surfaces); soft dependency: reuse API client patterns from US1 UI work.
- **US3**: After US1 review page supports triage params — extends same file for URL sync.

### Within Each User Story

- **US1**: Services (T008–T009) before serializer/view (T010–T013) before UI (T014–T016).
- **US2**: Serializers/summary (T017–T018) before publish + ontology (T019–T021) before viewset/urls (T022–T024) before UI (T025–T027).
- **US3**: URL read path before copy button before helper text.

### Parallel Opportunities

| After phase | Parallel tracks |
|-------------|-----------------|
| Phase 2 | Developer A: US1 T008–T016; Developer B: US2 T017–T024 (merge conflicts possible on `views.py` / `serializers.py` — split by file sections or pair program). |
| Phase 3 | T016 can proceed in parallel with T014–T015 once T010–T013 API is stable. |
| Phase 6 | T031–T034 are parallel documentation tasks. |

---

## Parallel Example: After Phase 2

```bash
# Track A — US1 backend
Tasks T008–T013 in heritage_graph/apps/heritage_data/

# Track B — US2 backend (coordinate merges on serializers/views)
Tasks T017–T024 in heritage_graph/apps/heritage_data/ + heritage_graph/apps/cidoc_data/
```

---

## Parallel Example: User Story 1 UI

```bash
# After T013 merged:
Task T014 — heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx
Task T016 — heritage_graph_ui/src/app/(dashboard)/curation/review/[id]/page.tsx  # [P] parallel with T014–T015 once API stable
```

---

## Implementation Strategy

### MVP First (US1 triage only)

1. Complete Phase 1 + Phase 2.  
2. Complete Phase 3 (US1).  
3. **STOP and VALIDATE** against [quickstart.md](./quickstart.md) queue triage section.  
4. Ship/demo reviewer throughput improvement before schema proposals.

### Full P1 (US1 + US2)

1. Complete through Phase 4.  
2. Validate publish path on staging with real `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` (backup file first).

### Incremental Delivery

1. Setup + Foundational → **Checkpoint** Phase 2.  
2. Add US1 → validate queue triage.  
3. Add US2 → validate moderator gate + publish + audit.  
4. Add US3 → validate share links + `my_domain` messaging.  
5. Polish phase.

---

## Notes

- Total tasks: **35** (T001–T035).  
- **US1 task count**: 9 implementation tasks (T008–T016).  
- **US2 task count**: 11 implementation tasks (T017–T027).  
- **US3 task count**: 3 tasks (T028–T030).  
- **Setup + Foundational**: 7 tasks (T001–T007).  
- **Polish**: 5 tasks (T031–T035).  
- Every implementation line includes at least one concrete file path; `[P]` only where parallel-safe.  
- Optional pytest not listed — add under T008 or T019 if team wants regression locks.
