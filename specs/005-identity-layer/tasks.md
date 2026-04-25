# Tasks: Identity Layer (Claim-First)

**Input**: Design documents from `/specs/005-identity-layer/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml), [quickstart.md](./quickstart.md)

**Tests**: Not requested in [spec.md](./spec.md); no dedicated test tasks. Add pytest coverage opportunistically during implementation if desired.

**Organization**: Phases follow user-story priority (US1 = MVP). Constitution gates apply to every task (see below).

## Constitution Gates (apply to all tasks)

Reference `.specify/memory/constitution.md`. When implementing each task:

- **Secrets/config**: No committed secrets; any new env vars in `.env.example`; frontend uses `process.env.NEXT_PUBLIC_*` only (no hardcoded `localhost` URLs).
- **Auth**: Protected UI calls use `Authorization: Bearer <accessToken>` from NextAuth session (`heritage_graph_ui/src/lib/api-client.ts` patterns).
- **Quality**: `ruff format` + `ruff check` on touched Python; TypeScript build/typecheck for touched `heritage_graph_ui/`.
- **Deployability**: Migrations reversible where feasible; rollout order documented in [quickstart.md](./quickstart.md) (migrate → bootstrap → UI).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel-safe (different files, no ordering dependency on incomplete sibling)
- **[USn]**: User story label from [spec.md](./spec.md)

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Constants and ontology/registry alignment before schema work.

- [x] T001 Add `heritage_graph/apps/cidoc_data/identity_constants.py` with `IDENTITY_SAME_REFERENT_PROPERTY`, `SOURCE_TYPE_CONFLICT_ORDER` (or equivalent) per [research.md](./research.md) R-003 and R-005.
- [x] T002 [P] Extend `ontology/HeritageGraph.yaml` with `EntityCluster` class, document same-referent membership predicate, and wire slots needed for registry/UI per [plan.md](./plan.md).
- [x] T003 [P] Update `heritage_graph/apps/cidoc_data/cidoc_registry_keys.py` for any new registry-backed class keys introduced in T002.
- [x] T004 Regenerate committed registry artifacts with `make ontology` / `make ontology-check` so `heritage_graph_ui/src/lib/ontology/registry.generated.json` and `registry.generated.ts` match YAML (depends on T002–T003).

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Database schema, validation hooks, and bootstrap — **no user story work before this checkpoint**.

**⚠️ CRITICAL**: Phases 3–8 must not start until Phase 2 is complete.

- [x] T005 Add `EntityCluster`, `ClusterAuditEvent`, `IdentityResolutionCandidate`, and `HeritageAssertion.entity_cluster` FK (plus `EntityCluster.version`, `merged_into`, indexes) in `heritage_graph/apps/cidoc_data/models.py` per [data-model.md](./data-model.md).
- [x] T006 Create Django migration under `heritage_graph/apps/cidoc_data/migrations/` for all Phase-2 schema additions (reversible where feasible).
- [x] T007 Add optional `heritage_graph/apps/cidoc_data/identity_validation.py` (or co-located validators) enforcing membership row invariants from [data-model.md](./data-model.md); invoke from serializers or model `clean()`.
- [x] T008 Register new models in `heritage_graph/apps/cidoc_data/admin.py` (list_display, filters) for operational debugging.
- [x] T009 Implement idempotent `heritage_graph/apps/cidoc_data/management/commands/bootstrap_identity_clusters.py` per [quickstart.md](./quickstart.md) and FR-010/FR-011 in [spec.md](./spec.md).

**Checkpoint**: Migrated DB + bootstrap command runs; foundation ready for API and UI stories.

---

## Phase 3: User Story 1 — Reviewer resolves name variants (Priority: P1) 🎯 MVP

**Goal**: Reviewers can create/link **same-referent** membership assertions and manage `EntityCluster` anchors so two rows share one cluster with provenance.

**Independent Test**: Create two person records, attach accepted membership assertions to one cluster via API (reviewer token); assert both rows resolve to the same `entity_cluster` via list filters.

### Implementation for User Story 1

- [x] T010 [US1] Extend `heritage_graph/apps/cidoc_data/serializers.py`: `HeritageAssertionSerializer` includes `entity_cluster`; validate identity rows (`asserted_property`, subject `type_scope`, FK presence) using T007 helpers.
- [x] T011 [US1] Extend `heritage_graph/apps/cidoc_data/views.py` `HeritageAssertionViewSet.get_queryset` with filters `entity_cluster`, `asserted_property` (identity predicate), preserving existing `entity_type` / `entity_id` behavior.
- [x] T012 [US1] Add `EntityClusterSerializer` (read/write rules) in `heritage_graph/apps/cidoc_data/serializers.py` with `expected_version` for optimistic concurrency on updates.
- [x] T013 [US1] Add `EntityClusterViewSet` in `heritage_graph/apps/cidoc_data/views.py` with permissions: reads per product decision; creates/updates using `IsAuthenticated` + `IsExpertCurator` (or stricter read—document in viewset docstring) aligned with [research.md](./research.md) R-004.
- [x] T014 [US1] Register `router.register(r'entity-clusters', ...)` in `heritage_graph/apps/cidoc_data/urls.py` and ensure routes appear under `/api/v1/cidoc/` per `heritage_graph/urls.py`.

**Checkpoint**: US1 API path complete — reviewer can materialize identity claims and clusters.

---

## Phase 4: User Story 2 — Viewer sees canonical label and aliases (Priority: P2)

**Goal**: Knowledge surfaces show cluster canonical label, alias entities, and drill-down to membership claims within two clicks from summary.

**Independent Test**: With US1 data, open a public/authenticated knowledge view; verify canonical label + alias list + assertion links without using reviewer workspace.

### Implementation for User Story 2

- [x] T015 [US2] Add read helpers in new `heritage_graph/apps/cidoc_data/identity_services.py` for derived members of a cluster and active membership / conflict flags for a subject entity per [data-model.md](./data-model.md).
- [x] T016 [US2] Expose `GET` identity summary endpoint (new view or action on `EntityClusterViewSet`) in `heritage_graph/apps/cidoc_data/views.py` returning canonical label, alias list, membership assertion ids, and `competing` boolean — align fields with [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml) member/summary shapes.
- [x] T017 [US2] Update `heritage_graph_ui/src/components/knowledge/why-we-believe-panel.tsx` to fetch identity summary / membership assertions and render canonical label + aliases + links.
- [x] T018 [US2] Wire identity summary UI into `heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/view/[id]/page.tsx` and/or `heritage_graph_ui/src/app/(dashboard)/knowledge/entity/view/[id]/page.tsx` (whichever backs entity detail for the tested domain) using `getPublicApiUrl()` / existing `apiFetchJson` patterns.

**Checkpoint**: US2 independently demonstrable on knowledge pages.

---

## Phase 5: User Story 3 — Moderator splits incorrectly merged cluster (Priority: P2)

**Goal**: Merge/split with supersession semantics, optimistic concurrency, and append-only `ClusterAuditEvent` rows (FR-005, FR-018).

**Independent Test**: Merge two clusters then split per [spec.md](./spec.md) US3; verify audit entries and alias restoration in API responses.

### Implementation for User Story 3

- [x] T019 [US3] Implement `merge_clusters`, `split_cluster`, `lock_cluster`, `unlock_cluster` in `heritage_graph/apps/cidoc_data/identity_services.py` using `@transaction.atomic`, `version` checks (409 on mismatch), and `ClusterAuditEvent` creation per [research.md](./research.md) R-002 and R-007.
- [x] T020 [US3] Add `@action` handlers on `EntityClusterViewSet` in `heritage_graph/apps/cidoc_data/views.py` for `merge/`, `split/`, `lock/`, `unlock/` matching [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml); enforce `IsExpertCurator` for mutations.
- [x] T021 [US3] Add read-only list action `audit/` on `EntityClusterViewSet` in `heritage_graph/apps/cidoc_data/views.py` returning `ClusterAuditEvent` rows (no update/delete endpoints).

**Checkpoint**: US3 moderator flows and audit trail live.

---

## Phase 6: User Story 4 — Reviewer triages unresolved-identity queue (Priority: P3)

**Goal**: Materialized candidates, refresh command, list/resolve API, and three-panel Identity Resolution Workspace UI.

**Independent Test**: Seed five `IdentityResolutionCandidate` rows, accept/reject/defer via API and UI; queue counts update.

### Implementation for User Story 4

- [x] T022 [US4] Add `IdentityResolutionCandidateSerializer` and `IdentityCandidateViewSet` (list + `resolve` action) in `heritage_graph/apps/cidoc_data/serializers.py` and `views.py` with reviewer permissions per [research.md](./research.md) R-006.
- [x] T023 [US4] Register candidate routes in `heritage_graph/apps/cidoc_data/urls.py` (router prefix `identity-candidates` or equivalent consistent with contract).
- [x] T024 [US4] Implement `heritage_graph/apps/cidoc_data/management/commands/refresh_identity_candidates.py` to populate/refresh `IdentityResolutionCandidate` using rule-based signals from [spec.md](./spec.md) FR-013.
- [x] T025 [US4] Add queue page `heritage_graph_ui/src/app/(dashboard)/curation/identity/page.tsx` listing candidates with filters (status tabs).
- [x] T026 [US4] Add three-panel workspace `heritage_graph_ui/src/app/(dashboard)/curation/identity/[candidateId]/page.tsx` mirroring layout patterns from `heritage_graph_ui/src/app/(dashboard)/curation/review/[id]/page.tsx` (context / evidence / decision columns).

**Checkpoint**: US4 workspace usable end-to-end.

---

## Phase 7: User Story 5 — Moderator locks canonical cluster (Priority: P3)

**Goal**: Locked clusters block reviewer merges; moderators can override with explicit audit (US5 acceptance scenarios).

**Independent Test**: Lock cluster as moderator; reviewer merge returns 403; moderator override merge succeeds and audit contains `lock_override` semantics.

### Implementation for User Story 5

- [x] T027 [US5] Enforce `locked` + `lock_override` request flag in `heritage_graph/apps/cidoc_data/identity_services.py` merge path and `EntityClusterViewSet` actions in `heritage_graph/apps/cidoc_data/views.py` (clear error payloads).
- [x] T028 [US5] Add moderator lock/unlock controls and error surfacing to `heritage_graph_ui/src/app/(dashboard)/curation/identity/[candidateId]/page.tsx` or a small shared component under `heritage_graph_ui/src/components/curation/` (reuse shadcn/ui primitives; do not edit `src/components/ui/` primitives directly).

**Checkpoint**: US5 lock policy visible in UI and API.

---

## Phase 8: User Story 6 — Competing identities surfaced (Priority: P3)

**Goal**: When multiple accepted active memberships disagree, API and UI show competing clusters with source-weighted ordering (FR-016, FR-017).

**Independent Test**: Create conflicting accepted membership rows; `identity_conflict` filter and knowledge UI both surface both sides distinctly.

### Implementation for User Story 6

- [x] T029 [US6] Implement `identity_conflict` queryset branch (or dedicated action) on `HeritageAssertionViewSet` in `heritage_graph/apps/cidoc_data/views.py` per [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml).
- [x] T030 [US6] Add `heritage_graph_ui/src/components/knowledge/competing-identities-panel.tsx` using `SOURCE_TYPE_CONFLICT_ORDER` exposure from API (server computes ordered groups); integrate beside identity summary on knowledge pages touched in T018.

**Checkpoint**: US6 competing state visible without silent winner.

---

## Phase 9: Polish and cross-cutting concerns

**Purpose**: Docs, quality gates, and quickstart validation.

- [x] T031 [P] Update `AGENTS.md` and `ARCHITECTURE.md` at repository root with identity layer overview (data flow: cluster ↔ assertions ↔ audit ↔ UI) per constitution doc-update expectations.
- [x] T032 Run `ruff format` + `ruff check` on touched Python under `heritage_graph/`; run `npm run build` (or project-standard typecheck) in `heritage_graph_ui/` and fix any regressions from identity UI work.
- [x] T033 Execute manual steps in `specs/005-identity-layer/quickstart.md` and adjust that file if final URLs or payload field names differ from the sketch.

---

## Dependencies and execution order

### Phase dependencies

| Phase | Depends on | Notes |
| --- | --- | --- |
| 1 Setup | — | T004 depends on T002–T003 |
| 2 Foundational | Phase 1 complete | Blocks all user stories |
| 3 US1 | Phase 2 | MVP |
| 4 US2 | Phase 3 | Uses clusters + membership assertions |
| 5 US3 | Phase 3 | Mutations assume clusters/assertions exist |
| 6 US4 | Phase 2–3 | Candidates reference real entities; resolve creates assertions |
| 7 US5 | Phase 5 | Lock enforcement sits on merge path from T019–T020 |
| 8 US6 | Phase 4 | Reuses summary/list endpoints and knowledge wiring |
| 9 Polish | All targeted stories done | |

### User story dependency graph

```text
Foundational (Phase 2)
        │
        ├──► US1 (P1) ──► US2 (P2)
        │         │
        │         └──► US3 (P2) ──► US5 (P3)  [lock on merge path]
        │
        └──► US4 (P3)  [workspace; can parallelize with US2/US3 after US1 API exists]

US2/US3/US4 ──► US6 (P3)  [competing view builds on read surfaces]
```

### Within-story order

- **US1**: serializers (T010) before viewsets (T011–T013); URLs (T014) last.
- **US3**: services (T019) before view actions (T020–T021).
- **US4**: API (T022–T023) can precede or follow refresh command (T024); UI (T025–T026) after API contracts stable.
- **US6**: backend filter (T029) before UI panel (T030).

### Parallel opportunities

| Phase | Parallel tasks |
| --- | --- |
| 1 | T002, T003 in parallel after T001 started; or T002 and T003 both [P] after T001 completes |
| 2 | T007 and T008 can proceed in parallel once T006 migration file exists (different files) |
| 9 | T031 [P] vs early prep for T032 if on separate branches |

**Example (Phase 1)**:

```bash
# After T001:
# Developer A: T002 (HeritageGraph.yaml)
# Developer B: T003 (cidoc_registry_keys.py)
# Then T004: single owner runs ontology generation
```

---

## Parallel example: User Story 4

```bash
# Backend command can ship after model + serializer exist:
T024 refresh_identity_candidates.py

# UI pages can be built against mocked API if contract frozen:
T025 identity/page.tsx
T026 identity/[candidateId]/page.tsx
```

---

## Implementation strategy

### MVP first (User Story 1 only)

1. Complete Phase 1–2 (Setup + Foundational).  
2. Complete Phase 3 (US1).  
3. **STOP** — run bootstrap, exercise assertion + cluster CRUD per [quickstart.md](./quickstart.md).  
4. Demo MVP before building knowledge surfaces.

### Incremental delivery

1. US1 → US2 (read surfaces) → US3 (moderator mutations) → US4 (scale/triage) → US5 (governance) → US6 (epistemic edge cases) → Polish.

### Parallel team strategy

- Developer A: Phases 3–5 (API + services).  
- Developer B: Phases 4 + 8 (knowledge UI) once T016 response shape is agreed.  
- Developer C: Phases 6–7 (workspace UI + candidates command).

---

## Task summary

| Metric | Value |
| --- | ---: |
| **Total tasks** | 33 |
| **Phase 1** | 4 |
| **Phase 2** | 5 |
| **US1** | 5 |
| **US2** | 4 |
| **US3** | 3 |
| **US4** | 5 |
| **US5** | 2 |
| **US6** | 2 |
| **Polish** | 3 |
| **Format** | All lines use `- [ ] Tnnn [P?] [USn?] …` with at least one file path |

### Task count per user story

| Story | Tasks |
| --- | ---: |
| US1 | 5 (T010–T014) |
| US2 | 4 (T015–T018) |
| US3 | 3 (T019–T021) |
| US4 | 5 (T022–T026) |
| US5 | 2 (T027–T028) |
| US6 | 2 (T029–T030) |

### Suggested MVP scope

- **Phases 1–3 only** (through **T014**): satisfies [spec.md](./spec.md) User Story 1 and unblocks manual identity curation via API.

---

## Notes

- Keep merge/split logic in `identity_services.py` to avoid bloating `views.py`.  
- When OpenAPI contract and implementation diverge during build, update **either** `contracts/openapi-identity-layer.v1.yaml` **or** quickstart — constitution prefers accurate docs.  
- Optional: add dashboard nav entry pointing to `curation/identity` in a layout file under `heritage_graph_ui/src/app/(dashboard)/` (small follow-up if not covered by T025).
