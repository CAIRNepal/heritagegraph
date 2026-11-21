# Tasks: In-place submission edit (pre-filled contribute + secure PATCH)

**Input**: Design documents from `specs/002-in-place-submission-edit/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Tests**: Omitted (not requested in `spec.md`); add later if you want TDD for permissions.

**Organization**: Phases by user story (P1–P3 in `spec.md`); Foundational = CIDOC auth for edits (blocks production-safe US1).

## Constitution Gates (apply to all tasks)

Reference `.specify/memory/constitution.md` and `specs/002-in-place-submission-edit/plan.md`: no committed secrets; new env vars in `.env.example` if any; no hardcoded `http://localhost` in new/changed UI calls (use `getPublicApiUrl()` / `NEXT_PUBLIC_API_URL`); protected writes with `Authorization: Bearer <accessToken>`; ruff on Python; typecheck/build on TS for touched files; document behavior changes in `AGENTS.md` (and breaking API/permission changes if external clients exist).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Safe to run in parallel (different files, no ordering dependency)
- **[USn]**: User story from `spec.md` (US1= P1, US2= P2, US3= P3)
- **Foundational & Polish**: no story label

---

## Phase 1: Setup (shared prep)

**Purpose**: Small repo alignment before touch-heavy work.

- [X] T001 [P] In `heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/view/[id]/page-client.tsx` import and use `getPublicApiUrl()` from `heritage_graph_ui/src/lib/api-base.ts` for the view fetch (remove or narrow raw `process.env` + `http://localhost:8000` fallback) so the knowledge view and future edit use the same base URL contract.
- [X] T002 [P] In `heritage_graph_ui/src/components/ontology-form.tsx` ensure API base uses `getPublicApiUrl()` / `apiBaseUrl` prop consistently (no new hardcoded host strings) for all fetches in that file.

**Checkpoint**: UI API base pattern matches `plan.md` / constitution.

---

## Phase 2: Foundational (blocking: secure CIDOC updates)

**Purpose**: **Must** complete before treating edit as production-ready. Closes `AllowAny` on mutate paths per `research.md` R-004 and `plan.md` summary.

**⚠️** No US1 work should ship to production without this phase for the same release.

- [X] T003 In `heritage_graph/apps/cidoc_data/permissions.py` (create if missing) add a DRF permission class implementing object-level rules: `update`/`partial_update`/`destroy` allowed if `request.user` is staff/superuser **or** `instance.contributor` matches `request.user.username` (and `IsAuthenticated` for those actions). Read-only unauthenticated `retrieve`/`list` can stay public if that remains product intent.
- [X] T004 In `heritage_graph/apps/cidoc_data/views.py` update `ContributionFlowMixin.get_permissions()` (and, if required, add `get_queryset` / `check_object_permissions` patterns) so **create** stays `IsAuthenticated`, while **update**, **partial_update**, and **destroy** use `IsAuthenticated` **plus** the new object permission from `heritage_graph/apps/cidoc_data/permissions.py`. Document any intentional difference for `api/v1` includes.
- [X] T005 [P] Run `ruff format` and `ruff check` on `heritage_graph/apps/cidoc_data/permissions.py` and `heritage_graph/apps/cidoc_data/views.py` (and any new imports) from `heritage_graph/`.

**Checkpoint**: Anonymous `PATCH` to `/cidoc/...` must return **401/403**; contributor + Bearer can update own row (verify per `specs/002-in-place-submission-edit/quickstart.md` §2).

---

## Phase 3: User Story 1 — Edit with full current values visible (Priority: P1) — MVP

**Goal**: From knowledge view, **Edit** opens contribute with the **same** record id, form shows **authoritative** stored values, and UI clearly says **editing** (per `spec.md` US1, FR-001–FR-003, FR-008–FR-010).

**Independent test**: Open `/knowledge/{domain}/view/{id}` → **Edit** → all populated fields match GET detail; no empty “new” form; failed load shows error, not a blank form (`quickstart.md` §1–§3).

- [X] T006 [US1] In `heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/view/[id]/page-client.tsx` change the **Edit** `Button` to `router.push(\`/contribute/${ontologyClass.key}?id=${encodeURIComponent(String(id))}\`)` (or agreed query key from `research.md` R-002) so the record id is always present.
- [X] T007 [US1] In `heritage_graph_ui/src/components/ontology-form.tsx` add `useSearchParams()` (or props from a thin server wrapper) to read `id` / `edit` mode; if `id` is absent, keep current **create** behavior (POST only).
- [X] T008 [US1] In `heritage_graph_ui/src/components/ontology-form.tsx` when `id` is present, show a **loading** state until the detail `GET` completes; on failure, render error UI with safe navigation (fulfill **FR-008**; no empty form as success).
- [X] T009 [US1] In `heritage_graph_ui/src/components/ontology-form.tsx` implement `GET` to `{getPublicApiUrl()}{ontologyClass.apiEndpoint}{id}/` with `Accept: application/json` and `Authorization: Bearer` when in edit mode, mirroring the view page’s data source in `page-client.tsx`.
- [X] T010 [US1] In `heritage_graph_ui/src/components/ontology-form.tsx` map response JSON to `formData` for every `OntologyField` (coordinates string ↔ UI object, name/title handling) per `specs/002-in-place-submission-edit/data-model.md`.
- [X] T011 [US1] In `heritage_graph_ui/src/components/ontology-form.tsx` in edit mode, submit with `PATCH` to the same resource URL and Bearer token; keep create path as `POST`. Surface `apiFetchJson` / `getApiErrorMessage` errors (403/400) without dropping loaded form state.
- [X] T012 [US1] In `heritage_graph_ui/src/components/ontology-form.tsx` add clear **editing** affordance: title/subtitle, record `id`, and `status`/`contributor` read-only context (fulfill **FR-002**).

**Checkpoint**: MVP for `spec.md` P1 and `quickstart.md` §3; pair with Phase 2 before production deploy.

---

## Phase 4: User Story 2 — Frictionless correction without retyping (Priority: P2)

**Goal**: Single-field fixes do not require re-filling the rest; optional fields left empty in storage show empty, not fake defaults (`spec.md` US2, FR-004–FR-006).

**Independent test**: Edit one field, save, reload view — all other fields unchanged; optional blank sections stay blank.

- [X] T013 [US2] In `heritage_graph_ui/src/components/ontology-form.tsx` ensure multi-step `sections` in edit mode retain values when moving between steps and that `PATCH` payload does not clear keys unintentionally (only send what the API accepts; align with **FR-005**).
- [X] T014 [US2] In `heritage_graph_ui/src/components/ontology-form.tsx` confirm optional/empty server fields are not replaced with non-empty UI defaults on load (fulfill **FR-003** edge for optional sections).

**Checkpoint**: P2 acceptance scenarios from `spec.md` covered.

---

## Phase 5: User Story 3 — Favorable in-place / inline experience (Priority: P3)

**Goal**: Shared load/save logic for future inline editors; no second source of truth (`spec.md` US3, **FR-007**).

**Independent test**: (After refactor) one field value equals GET detail and post-PATCH full form; optional: inline defers if not building UI in this tranche.

- [X] T015 [P] [US3] Add `heritage_graph_ui/src/lib/ontology/ontology-edit-helpers.ts` exporting `mapCidocRecordToFormData(ontologyClass, record: Record<string, unknown>)` used by `heritage_graph_ui/src/components/ontology-form.tsx` so the view page / future inline edit can reuse the same mapping (**FR-007** prep).
- [X] T016 [US3] (Optional) In `heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/view/[id]/page-client.tsx` or a small child component, add a minimal “Quick edit” entry that deep-links to the same `?id=` contribute URL, **or** document P3 inline as deferred in `AGENTS.md` if not implementing UI now.

**Checkpoint**: P3 data-path consistency ready; full inline-on-view is **optional** per `plan.md` Summary.

---

## Phase 6: Polish & cross-cutting

- [X] T017 [P] In `AGENTS.md` add a short subsection: ontology contribute **edit** URL pattern (`/contribute/{domain}?id=...`), `GET`+`PATCH` contract, and new CIDOC permissions behavior in `heritage_graph/apps/cidoc_data/views.py`.
- [ ] T018 Run all steps in `specs/002-in-place-submission-edit/quickstart.md` and fix gaps until they pass. *(Manual QA in a running app.)*
- [X] T019 [P] Run `ruff format` + `ruff check` on all touched Python under `heritage_graph/` and the frontend typecheck/build script (e.g. from `heritage_graph_ui/package.json`) on changed TS/TSX files. *(Ruff: `apps/cidoc_data/permissions.py` OK. Full `next build` failed in this environment on fonts + missing `prom-client`, unrelated to this feature; no new tsc issues in changed files.)*

---

## Dependencies & execution order

### Phase dependencies

| Phase | Depends on | Notes |
|--------|------------|--------|
| Setup | — | T001, T002 parallel. |
| Foundational | Setup (recommended) | T003 → T004 → T005; T003 blocks T004. |
| US1 (P1) | Set up; **deploy requires Foundational** | T006 before T007–T012; T007–T012 order on `ontology-form.tsx`. |
| US2 (P2) | US1 core load/save | T013–T014. |
| US3 (P3) | US1 | T015–T016. |
| Polish | Desired stories done | T017–T019. |

### User story order

- **US1 (P1)**: Delivers pre-fill + clear edit; MVP.
- **US2 (P2)**: Polishes single-field and empty-default behavior; depends on US1 implementation existing.
- **US3 (P3)**: Refactor + optional UI; can slip to a follow-up PR if timeboxed.

### Parallel opportunities

- **T001** ∥ **T002** (different files).
- **T003** can start early; **T005** after T003–T004.
- **T015** ∥ **T017** ∥ **T019** after code stabilizes (P markers).
- Different developers: **T003–T005** (backend) in parallel with **T006** (one-line link) if coordination on query param name is agreed.

### Parallel example: Foundational (backend) vs first UI link

| Track A | Track B |
|---------|---------|
| T003, T004 in `heritage_graph/apps/cidoc_data/` | T001, T002, T006 in `heritage_graph_ui/...` |

**Note:** Full edit E2E needs both tracks before calling it done.

---

## Implementation strategy

### MVP (recommended)

1. Phase 1 + Phase 2 + Phase 3 (T001–T005, T006–T012) → **STOP** → `quickstart.md` §1–3 + API §2.
2. Add Phase 4 (T013–T014) before calling P2 “done”.

### Incremental

- Ship P1+Foundational as first PR (production-safe).
- P2 in a second PR (UX polish on same files).
- P3 + helpers (T015–T016) when ready for inline or reuse.

### Suggested MVP scope

- **MVP = Phase 1 + 2 + 3** (T001 through T005 and T006 through T012) + T018 manual pass + T019 for touched files.
- **Task counts**: 19 tasks total; **US1**: 7 (T006–T012), **US2**: 2 (T013–T014), **US3**: 2 (T015–T016, optional T016); **Setup** 2; **Foundational** 3; **Polish** 3.
- **Parallel [P] tasks**: T001, T002, T005, T015, T017, T019 = 6 parallel-capable (when dependencies allow).

---

## Format validation (self-check)

- [x] Every line uses `- [ ]` + `T###` + description including at least one concrete `path/`.
- [x] **Story** labels only on **US#** tasks (T006–T016 as marked).
- [x] **Foundational** and **Polish** tasks (T001–T005, T017–T019) have no `[US#]`.
- [x] **\[P\]** only where files do not block each other.
- [x] No TDD/contract test tasks (not requested in spec).

---

## Notes

- **CulturalEntity** / `contribute/entity/edit` is **out of scope** for this task list (see `plan.md` / `data-model.md` out-of-scope); a future spec can migrate URL-JSON to id-based `GET`/`PATCH`.
- **Legacy** `Submission` edit flows are a **follow-up** (same pattern: `?submission_id=` + `GET`/`PATCH` in `heritage_graph/apps/heritage_data/`), not in this P1 tranche.
- `tasks.md` is generated; implementation order may adjust after spikes—keep `research.md` as source of truth for permission semantics.
