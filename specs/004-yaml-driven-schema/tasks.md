---
description: "Task list for 004-yaml-driven-schema (LinkML-driven schema, DB, UI, docs)"
---

# Tasks: YAML-driven schema, database, and UI form generation

**Input**: Design documents from `/specs/004-yaml-driven-schema/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi-schema-registry.v1.yaml`, `quickstart.md`

**Tests**: The feature spec does not explicitly request a TDD flow, so test tasks are minimal and limited to **contract assertions** tied directly to acceptance scenarios. Expand during `/speckit.implement` if desired.

## Constitution Gates (apply to all tasks)

Reference `.specify/memory/constitution.md`. Every task MUST respect:

- **Secrets/config**: no committed secrets; new env vars in `.env.example` (and `heritage_graph_ui/.env.example` for `NEXT_PUBLIC_*`); no hardcoded `http://localhost:*` in new frontend production paths.
- **Auth contract**: protected endpoints called with `Authorization: Bearer <accessToken>` from NextAuth session.
- **Quality gates**: `ruff format .` + `ruff check .` for touched Python under `heritage_graph/`; TypeScript build/typecheck for touched frontend under `heritage_graph_ui/`.
- **Deployability**: respect docker/compose/traefik; breaking changes include migration/rollout plan + docs updates (FORMS.md, ARCHITECTURE.md, AGENTS.md, API_VERSIONING.md, `.env.example`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete task).
- **[Story]**: user story tag (US1–US5). Setup/Foundational/Polish phases have no story label.

## Path Conventions

Repository is a web app:

- Backend: `heritage_graph/` (Django apps under `heritage_graph/apps/`).
- Frontend: `heritage_graph_ui/src/`.
- Generator scripts: `tools/` (new).
- Ontology source: `ontology/HeritageGraph.yaml` (canonical; reconcile with repo-root `Heritagegraph.yaml` in T004).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, env vars.

- [x] T001 [P] Add LinkML developer dependencies to `heritage_graph/requirements.txt` (or a new `heritage_graph/requirements-dev.txt`): pin `linkml` and `linkml-runtime` (latest stable compatible with Python 3.13); do not add them to the runtime-lean image unless the schema endpoint imports them.
- [x] T002 [P] Create `tools/` directory at repo root with `tools/README.md` describing generator entry points and one-command regeneration flow referenced by `specs/004-yaml-driven-schema/quickstart.md`.
- [x] T003 [P] Add new env vars to `.env.example` (repo root) with safe defaults and comments: `HERITAGEGRAPH_SCHEMA_PATH` (default `ontology/HeritageGraph.yaml`), `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` (optional, empty default), `HERITAGEGRAPH_SCHEMA_CACHE_TTL` (default `60`), `RDF_ENDPOINT_URL` (empty default, only used if sidecar enabled), `RDF_SYNC_ENABLED` (default `false`).
- [x] T004 Reconcile ontology source-of-truth file name: pick canonical path `ontology/HeritageGraph.yaml`, fix `id:` typo (`HeritageGrap` → `HeritageGraph`), and either (a) move repo-root `Heritagegraph.yaml` into `ontology/` and delete the root copy, or (b) add a clear `ontology/README.md` stating the root file is a sync-only mirror; update `.gitignore`/paths so only one file is edited.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend + generator skeleton that **all** user stories build on.

**⚠️ CRITICAL**: No user-story work begins until this phase completes.

- [x] T005 Create Django app or module to host schema serving code, e.g. `heritage_graph/apps/cidoc_data/schema_registry.py` (single-tenant default) + `heritage_graph/apps/cidoc_data/urls.py` router additions; respect DRF conventions (explicit permissions, UUID, timestamps) per constitution.
- [x] T006 Add model `SchemaRegistry` to `heritage_graph/apps/cidoc_data/models.py` per `specs/004-yaml-driven-schema/data-model.md` (fields: `id` UUID PK, `schema_version`, `core_hash`, `extension_hash` nullable, `tenant` FK nullable, `registry_json` JSONField, `jsonschema_blob` JSONField nullable, `created_at`, `updated_at`, explicit `db_table`); create and include Django migration that is reversible.
- [x] T007 Add model `DynamicOntologyEntity` to `heritage_graph/apps/cidoc_data/models.py` per `data-model.md` (fields: `id` UUID PK, `tenant` FK nullable, `class_key`, `class_uri`, `uri` unique-per-tenant, `data` JSONField, `created_at`, `updated_at`); create reversible Django migration. Do not yet wire CRUD routes — those are per-story.
- [x] T008 [P] Implement LinkML loader/cache module `heritage_graph/apps/cidoc_data/linkml_loader.py`: reads `HERITAGEGRAPH_SCHEMA_PATH`, builds `SchemaView`, computes `schema_version = sha256(core_bytes + extension_bytes + GENERATOR_VERSION)`, holds a per-worker in-memory cache, and exposes `get_effective_registry(tenant=None)`; on parse failure, return last-known-good `SchemaRegistry` row and log a structured error per spec FR-007.
- [x] T009 [P] Implement the range→UI-type mapping config at `tools/ui-mapping.yaml` (LinkML range / slot pattern → `text|textarea|number|date|select|multiselect|boolean|url|coordinates|relation|float`) per `research.md` R-002; keep it side-by-side with the LinkML YAML so both can be edited without touching TS/Python code.
- [x] T010 [P] Implement core generator `tools/linkml_generate_registry.py` using `SchemaView.class_induced_slots`: emits (a) `heritage_graph_ui/src/lib/ontology/registry.generated.json` matching the `OntologyRegistryResponse` shape in `specs/004-yaml-driven-schema/contracts/openapi-schema-registry.v1.yaml`, and (b) `heritage_graph_ui/src/lib/ontology/registry.generated.ts` exporting a typed constant of the same shape. Include `--out-json`, `--out-ts`, and `--check` flags (the `--check` flag must exit non-zero when generated files are out of date).
- [x] T011 [P] Add a single-command regeneration entry point: either a `Makefile` target (`make ontology`) or an `npm run generate:ontology` script in `heritage_graph_ui/package.json` that shells out to `tools/linkml_generate_registry.py`. Document in `tools/README.md` and `specs/004-yaml-driven-schema/quickstart.md`.
- [x] T012 Keep backward compatibility: preserve `heritage_graph_ui/src/lib/ontology/registry.ts` as the current hand-maintained file for now; add a header comment and a TODO-to-remove tag pointing at US1 switchover; ensure nothing currently imports the `.generated.*` files yet (FR-024).
- [ ] T013 Apply `ruff format .` and `ruff check .` to all newly-touched Python; run `pnpm --filter heritage_graph_ui build` (or the repo's `npm run build`) to confirm no TS regressions from the added generator outputs.

**Checkpoint**: Foundation ready — generator produces artifacts, models exist, loader can compute a version. User-story phases may now run in parallel (if staffed).

---

## Phase 3: User Story 1 — Single YAML edit flows end-to-end (Priority: P1) 🎯 MVP

**Goal**: A maintainer adds a new slot/class to the LinkML YAML and, after regeneration, the schema API exposes it, server-side validation applies, and RDF URIs are available — without hand-edits to `registry.ts` or Django models.

**Independent Test**: Add a benign slot to one existing LinkML class, run the generator, restart Django, `GET /api/v1/cidoc/schema/registry/` with a Bearer token, and confirm the slot appears with correct type/required flag; POST an invalid value and confirm server rejects it.

### Implementation for User Story 1

- [x] T014 [US1] Implement DRF view + URL for the schema registry endpoint in `heritage_graph/apps/cidoc_data/views.py` (class e.g. `OntologySchemaRegistryView`) and register it in `heritage_graph/apps/cidoc_data/urls.py` under `schema/registry/`; include it in `heritage_graph/urls.py` such that it resolves under `/api/v1/cidoc/schema/registry/`. Use explicit permission class (authenticated-only) consistent with existing CIDOC viewsets.
- [x] T015 [P] [US1] Implement response shape exactly per `specs/004-yaml-driven-schema/contracts/openapi-schema-registry.v1.yaml`: top-level `schema_version`, `generated_at`, `tenant_id` (null for now), `degraded` (false by default), `classes`, `enums`. Source data from `linkml_loader.get_effective_registry()`.
- [x] T016 [US1] Add HTTP caching: `ETag` header = quoted `schema_version`; `Cache-Control: private, max-age=<HERITAGEGRAPH_SCHEMA_CACHE_TTL>`; honor `If-None-Match` → `304 Not Modified`.
- [x] T017 [US1] Add strict-mode serializer validation helper in `heritage_graph/apps/cidoc_data/serializers.py` (new function `validate_against_linkml(class_key, data)`) that uses `linkml_loader` to reject unknown keys and enforce required slots for routes opting in; apply it to at least one representative viewset (e.g. `PersonViewSet`) to demonstrate the flow.
- [x] T018 [US1] Expose `slot_uri` / `class_uri` in the registry payload `OntologyField.slot_uri` and `OntologyClass.classUri` so RDF round-tripping (acceptance scenario US1-4) is possible at any write-path.
- [x] T019 [US1] Add a management command `heritage_graph/apps/cidoc_data/management/commands/rebuild_schema_registry.py` that rebuilds the in-memory cache and writes a new `SchemaRegistry` row; wire `tools/linkml_generate_registry.py --check` into a CI-friendly path so drift is caught.
- [x] T020 [US1] Contract-level verification: add one lightweight Django test at `heritage_graph/apps/cidoc_data/tests.py` (or a dedicated test module) that (a) calls the registry endpoint with a Bearer-simulated authenticated client, (b) asserts required top-level keys per `openapi-schema-registry.v1.yaml`, and (c) asserts `ETag` round-trip returns `304`.
- [x] T021 [US1] Run `ruff format . && ruff check .` on every changed `heritage_graph/**.py` file and resolve findings; re-run the test above green.

**Checkpoint**: YAML → API is live. Acceptance scenarios US1-1, US1-3, US1-4 pass end-to-end; US1-2 additionally requires the frontend work in US2.

---

## Phase 4: User Story 2 — Frontend loads the ontology registry at runtime (Priority: P1) 🎯 MVP

**Goal**: Contribute forms, knowledge tables, and navigation render from the live schema API with a graceful fallback to the generated snapshot.

**Independent Test**: Point the frontend at a backend whose effective schema differs from the committed `registry.generated.*` snapshot; verify new class/slot renders without any frontend code change or rebuild; stop Django and verify the UI falls back to the snapshot with a non-blocking banner.

### Implementation for User Story 2

- [x] T022 [P] [US2] Create `heritage_graph_ui/src/lib/ontology/load-registry.ts` exporting an async `loadOntologyRegistry(opts?)` that uses `apiUrl('/api/v1/cidoc/schema/registry/')` and `apiFetchJson` (both from `src/lib/api-client.ts` / `src/lib/api-base.ts`) with an optional Bearer token from the NextAuth session; cache responses in memory keyed by `schema_version`.
- [x] T023 [P] [US2] Create `heritage_graph_ui/src/lib/ontology/OntologyProvider.tsx` (React context, named export, `"use client"`) that: on mount, calls `loadOntologyRegistry()`; on failure, imports `registry.generated.json` (or `registry.generated.ts`) and flips a `degraded: true` flag in context; exposes `{ registry, enums, schemaVersion, degraded, reload() }`.
- [x] T024 [US2] Wrap the Next.js app with `<OntologyProvider>` at the appropriate layout in `heritage_graph_ui/src/app/...` (the narrowest layout that covers contribute + knowledge routes).
- [x] T025 [P] [US2] Add a small banner component `heritage_graph_ui/src/components/ontology/DegradedSchemaBanner.tsx` (named export, Tailwind via CSS variables, no direct shadcn edits) shown when `degraded: true`; non-blocking, dismissible.
- [x] T026 [US2] Refactor contribute form rendering to consume the provider: in the contribute pages under `heritage_graph_ui/src/app/` (and/or shared form components in `heritage_graph_ui/src/components/`), replace direct imports from `src/lib/ontology/registry.ts` with `useOntology()` from the new provider; keep the old `registry.ts` importable in the same module for the migration window (FR-024).
- [x] T027 [US2] Refactor knowledge-table rendering to consume the provider (columns + endpoints come from registry payload); reuse existing `generic-data-table` types.
- [x] T028 [US2] Client-side validation hook: add `heritage_graph_ui/src/lib/ontology/useValidation.ts` that derives field-level required/type rules from the registry payload (JSON-Schema-ish) so forms short-circuit before calling the API (acceptance scenario US1-3 client side).
- [x] T029 [US2] Navigation respects `navigable`: update sidebar / catalog in `heritage_graph_ui/src/components/` (or wherever primary nav is rendered) to iterate `Object.values(registry.classes).filter(c => c.navigable)`.
- [x] T030 [US2] Regenerate snapshot (`make ontology` / `npm run generate:ontology`) so `registry.generated.json` and `registry.generated.ts` reflect current YAML; confirm both are committed.
- [x] T031 [US2] Run frontend typecheck/build (`npm run build` in `heritage_graph_ui/`) and verify no hardcoded `http://localhost` URLs were introduced.

**Checkpoint**: Together with US1, the app is schema-driven; SC-005 demonstrable.

---

## Phase 5: User Story 3 — Per-tenant schema extension (Priority: P2)

**Goal**: A tenant adds classes, overrides labels, and toggles `navigable` via a declarative extension without touching core YAML; tenant data is isolated.

**Independent Test**: Provision two tenants with distinct extensions; verify each sees only its own merged schema and entity data; a third tenant with no extension sees the unmodified core schema.

### Implementation for User Story 3

- [ ] T032 [P] [US3] Add `Tenant` model (or reuse existing scope if one appears later) in `heritage_graph/apps/cidoc_data/models.py` (fields: `id` UUID PK, `slug` unique, `name`, `created_at`, `updated_at`, explicit `db_table`); reversible Django migration.
- [ ] T033 [US3] Add `tenant` FK to `SchemaRegistry` and `DynamicOntologyEntity` rows created in T006/T007 (migration: nullable FK → backfill default `null` → optional follow-up to `NOT NULL`); keep single-tenant path working (`tenant=None` = "default").
- [ ] T034 [P] [US3] Implement extension loader `tools/linkml_merge_extensions.py` that takes a core YAML + an extension YAML (`extends: HeritageGraph.yaml`, `classes:`, `slot_overrides:`, `ui_overrides:` per the feature input) and produces a merged `SchemaView`; validate references (reject if an overridden slot does not exist) and emit an actionable error message.
- [ ] T035 [US3] Extend `heritage_graph/apps/cidoc_data/linkml_loader.py::get_effective_registry(tenant=...)` to load the tenant's extension (env-path in single-tenant mode, or DB-stored extension in multi-tenant mode) and apply the merge; cache per-`tenant` + `schema_version`.
- [ ] T036 [US3] Update the schema endpoint (T014) to derive `tenant` from the authenticated request (header, subdomain, or user → tenant mapping — pick whichever already exists or add minimal mapping in `heritage_graph/apps/cidoc_data/permissions.py`); ensure the response never leaks classes/slots from another tenant.
- [ ] T037 [US3] Implement schema-driven CRUD viewset `DynamicOntologyEntityViewSet` in `heritage_graph/apps/cidoc_data/views.py` (DRF `ModelViewSet` with `DefaultRouter`) filtered by `tenant`; validate `data` against the merged schema via `validate_against_linkml` (T017) before save; register under `/api/v1/cidoc/entities/{class_key}/`.
- [ ] T038 [US3] Extend permissions: update `heritage_graph/apps/cidoc_data/permissions.py` so list/detail/create on `DynamicOntologyEntity` and the schema endpoint enforce tenant isolation (acceptance scenario US3-1, FR-013).
- [ ] T039 [P] [US3] Frontend: extend `OntologyProvider.tsx` (T023) to re-fetch when tenant context changes; no UI rewrite needed — forms and tables already derive from the provider.
- [ ] T040 [US3] Negative-path test: add a Django test that loads an invalid extension (e.g. references a removed core slot) and asserts the endpoint returns a well-defined error for that tenant only, while other tenants continue to get valid registries (spec edge case + FR-014).
- [ ] T041 [US3] Ruff + TS build sweep on touched files.

**Checkpoint**: Multi-institution deployments viable; SC-006 enforceable.

---

## Phase 6: User Story 5 — Updated API docs and developer-facing documentation (Priority: P2)

**Goal**: A new developer can extend the ontology using only the updated repository docs and the API reference.

**Independent Test**: A reviewer who did not work on the implementation follows updated `FORMS.md` / `ARCHITECTURE.md` / `AGENTS.md` to add a class to the YAML and exercise it via the API and UI.

### Implementation for User Story 5

- [ ] T042 [P] [US5] Update `FORMS.md`: replace "edit `registry.ts` by hand" guidance with the YAML-first workflow from `specs/004-yaml-driven-schema/plan.md` (Related repository documentation table); include the one-command regeneration flow from `quickstart.md`.
- [ ] T043 [P] [US5] Update `ARCHITECTURE.md`: add a diagram / textual flow `LinkML YAML → generator → {backend validation, registry.generated.*, JSON Schema, RDF URIs} → schema API → runtime UI`; mention optional RDF sidecar as a read-only projection.
- [ ] T044 [P] [US5] Update `AGENTS.md`: document (a) that `registry.generated.ts` / `registry.generated.json` are generator outputs and MUST NOT be hand-edited, (b) `tools/` location, (c) env vars added in T003, (d) "how to add a class" runbook.
- [ ] T045 [P] [US5] Update `API_VERSIONING.md`: register `/api/v1/cidoc/schema/registry/` and `/api/v1/cidoc/entities/{class_key}/` and note that responses include a `schema_version` field usable as a soft contract version.
- [ ] T046 [P] [US5] Add (or link) OpenAPI entries for the new endpoints so they appear in drf-spectacular's generated schema under `/api/v1/schema/`; ensure operation IDs match `openapi-schema-registry.v1.yaml` where applicable.
- [ ] T047 [US5] Cross-link the spec/plan/quickstart from `documentation/` or `docs/` index if one exists (no new site scaffolding).
- [ ] T048 [US5] Documentation dry-run: a reviewer walks the `quickstart.md` checklist end-to-end and files any gaps as follow-ups.

**Checkpoint**: SC-008 achievable — developer onboarding to ontology edits is self-serve.

---

## Phase 7: User Story 4 — SPARQL / LOD reuse via write-through RDF sidecar (Priority: P3)

**Goal**: Django writes project into a triplestore using the YAML's `class_uri`/`slot_uri`; Django stays the source of truth.

**Independent Test**: Create/update/delete entities; run SPARQL queries with CIDOC-CRM URIs against the sidecar and confirm results match Django. Stop the sidecar and confirm Django writes still succeed and sync eventually retries.

### Implementation for User Story 4

- [ ] T049 [P] [US4] Add `rdflib` (latest stable) to `heritage_graph/requirements.txt` (runtime) with a justification comment; or keep it to `requirements-dev.txt` if RDF sync runs only in workers that include dev deps — decide per repo convention.
- [ ] T050 [US4] Implement RDF triple builder `heritage_graph/apps/cidoc_data/rdf_serializer.py::to_triples(instance_or_dynamic)` that uses `linkml_loader` to look up each slot's `slot_uri` and the class's `class_uri`; handles both typed models (e.g. `Person`) and `DynamicOntologyEntity`.
- [ ] T051 [US4] Add optional RDF sync via `heritage_graph/apps/cidoc_data/signals.py`: on `post_save` for in-scope models (typed CIDOC core + `DynamicOntologyEntity`), enqueue a Celery task (repo already uses Celery — see `heritage_graph/celery_app.py`) that writes triples to `RDF_ENDPOINT_URL` via SPARQL UPDATE; gate on `RDF_SYNC_ENABLED`.
- [ ] T052 [US4] Add `RDFSyncState` model per `data-model.md` so failures are tracked and inspectable; reversible migration.
- [ ] T053 [US4] Add management command `rematerialize_rdf` that iterates entities and re-emits triples (supports FR-019 recovery); document in `quickstart.md`.
- [ ] T054 [US4] Add a minimal sidecar in `docker-compose.yml` behind a compose profile (e.g. `--profile rdf`), pointing to Oxigraph or Fuseki (repo already has `oxigraph_db/` directory — reuse or document); keep default `docker compose up` unchanged. Update `.env.example` entries `RDF_ENDPOINT_URL` and `RDF_SYNC_ENABLED` usage notes.
- [ ] T055 [US4] Resilience verification: a Django test that toggles `RDF_SYNC_ENABLED` and asserts writes always commit to Postgres; on sidecar unavailability, the corresponding `RDFSyncState` row records a retriable failure.
- [ ] T056 [US4] Ruff + TS sweep (frontend untouched by this story but re-run build for safety).

**Checkpoint**: LOD/SPARQL story live behind a feature flag; SC-007 measurable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: cleanup, quality gates, and final validation.

- [ ] T057 [P] Remove any still-unused hand-authored per-class maps from `heritage_graph_ui/src/lib/ontology/registry.ts` once all callers consume the provider; keep the file only as a thin re-export of `registry.generated.ts` (FR-010/FR-011).
- [ ] T058 [P] Add a CI check: run `python tools/linkml_generate_registry.py --check` (and/or `make ontology --check`) so PRs that change YAML without regenerating fail early.
- [ ] T059 Performance pass: measure `/api/v1/cidoc/schema/registry/` p95 under at least 50 classes / 500 slots; target SC-004 (<200 ms); adjust caching and worker startup loading if needed.
- [ ] T060 Tenant isolation pass: automated check across two tenants per SC-006; fix any leakage.
- [ ] T061 [P] Final docs sweep: verify `FORMS.md`, `ARCHITECTURE.md`, `AGENTS.md`, `API_VERSIONING.md`, and `.env.example` all reflect the final state (SC-008).
- [ ] T062 Run `ruff format . && ruff check .` and the frontend `npm run build` one last time on all touched paths; resolve findings.
- [ ] T063 Execute `specs/004-yaml-driven-schema/quickstart.md` end-to-end; file follow-up issues for any remaining edge-case behaviors (slot removal with legacy data, slot type change, YAML parse error last-known-good).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no deps; can start immediately.
- **Foundational (Phase 2)** → after Setup; **blocks all user stories**.
- **US1 (Phase 3, P1)** → after Foundational.
- **US2 (Phase 4, P1)** → after Foundational; can run in parallel with US1 but **acceptance scenario US1-2 needs US2 for full UI verification**.
- **US3 (Phase 5, P2)** → after US1 + US2 (needs the runtime loader and schema API to be stable); touches `SchemaRegistry` / `DynamicOntologyEntity` that were stubbed in Foundational.
- **US5 (Phase 6, P2)** → after US1 + US2 (documents their real behavior); can run in parallel with US3.
- **US4 (Phase 7, P3)** → after US1 (uses `slot_uri` in the registry) and ideally US3 (covers dynamic entities too).
- **Polish (Phase 8)** → last.

### User Story Dependencies

- **US1** and **US2** are the MVP pair (both P1). They are independently testable (schema endpoint / snapshot fallback), but together cover SC-005.
- **US3** assumes US1 + US2 are stable; it extends them without changing their contracts.
- **US4** is additive and gated by `RDF_SYNC_ENABLED`; it must not block other stories' deployability.
- **US5** follows the implementation state; re-verify after US3 and US4 land if they change the public interface.

### Within Each User Story

- Backend models / migrations / loaders → views / URLs → serializers → frontend consumption.
- Regenerate artifacts (T030) whenever the YAML or `tools/ui-mapping.yaml` changes.
- Commit after each story milestone (FORMS.md suggestion; not mandatory).

### Parallel Opportunities

- Setup tasks **T001, T002, T003** can run together.
- Foundational **T008, T009, T010, T011** can run together after **T005–T007** land.
- US1 and US2 can be staffed in parallel after Foundational completes.
- Within US2, **T022, T023, T025** touch different files and can parallelize.
- Docs tasks **T042–T046** are independent and parallel.
- RDF tasks **T049** (deps) and **T050** (serializer) can parallelize; **T051** depends on both.

---

## Parallel Example: Foundational phase

```bash
# After T005, T006, T007 land, run these in parallel:
Task: "Implement heritage_graph/apps/cidoc_data/linkml_loader.py (T008)"
Task: "Implement tools/ui-mapping.yaml (T009)"
Task: "Implement tools/linkml_generate_registry.py (T010)"
Task: "Wire the one-command regeneration entry point (T011)"
```

## Parallel Example: User Story 2

```bash
# After US1 ships, run these in parallel:
Task: "Create heritage_graph_ui/src/lib/ontology/load-registry.ts (T022)"
Task: "Create heritage_graph_ui/src/lib/ontology/OntologyProvider.tsx (T023)"
Task: "Create heritage_graph_ui/src/components/ontology/DegradedSchemaBanner.tsx (T025)"
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Phase 1 → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2).
2. Validate SC-001, SC-003, SC-004, SC-005 on staging.
3. Deploy.

### Incremental Delivery

1. MVP (US1 + US2) → ship.
2. US5 (docs) → ship (unlocks external contributors).
3. US3 (tenancy) → ship.
4. US4 (RDF sidecar) → ship behind feature flag.
5. Polish → verify SC-001 through SC-009.

### Parallel Team Strategy

- Dev A: US1 (backend).
- Dev B: US2 (frontend runtime loader).
- Dev C (after MVP): US3 + US5.
- Dev D (after MVP): US4 (RDF sidecar), can start design in parallel with US1/US2.

---

## Notes

- Every task reference path is explicit; no vague placeholders remain.
- Ontology file path is canonicalized in **T004** — all later tasks assume `ontology/HeritageGraph.yaml`.
- Tests: only contract-level / acceptance-level tests are wired in (T020, T040, T055). Expand during `/speckit.implement` if TDD desired.
- Constitution gates (secrets, auth, quality, deployability) are enforced per-task; a final sweep happens in T062.
- Docs tasks (Phase 6) are first-class implementation tasks, not afterthoughts, because the feature's value depends on discoverability for ontology maintainers.
