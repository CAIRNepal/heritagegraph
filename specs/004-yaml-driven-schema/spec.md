# Feature Specification: YAML-Driven Schema, Database, and UI Form Generation

**Feature Branch**: `004-yaml-driven-schema`  
**Created**: 2026-04-19  
**Status**: Draft  
**Input**: User description: "Plan for this type yaml driven database and UI form generation — make the LinkML YAML ontology (HeritageGraph.yaml) the single source of truth so that Django models/serializers, API schema endpoints, the frontend ontology registry (registry.ts), validation schemas, and RDF/OWL exports are all generated from it. Decouple the hardcoded TypeScript registry from the ontology shape, introduce a per-tenant schema registry and extension configs, add a schema-serving API, wire the frontend to load the registry at runtime, and add a write-through RDF sidecar so reuse and SPARQL/LOD work without breaking current PostgreSQL-backed typed models. Update API docs and UI accordingly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ontology maintainer edits a single YAML and sees it everywhere (Priority: P1)

A HeritageGraph ontology maintainer adds a new slot (e.g., `patron_inscription`) to the `Temple` class — or a brand new class such as `Manuscript` — in `Heritagegraph.yaml`. After running one command (or letting the pipeline run), the Django API exposes the new field/class, the contribute form for that class shows the new field with the right label and widget, the knowledge table offers the new column, and validation (both server and client) rejects invalid values. No TypeScript registry file and no Django model file had to be hand-edited.

**Why this priority**: This is the core value of the whole feature. Without it, we still have three drifting sources of truth (YAML ↔ `registry.ts` ↔ Django) and reuse by other institutions is blocked. Shipping just this slice already eliminates the current manual sync burden.

**Independent Test**: Add a benign slot to one LinkML class in the YAML, run the generator + restart (or trigger the refresh endpoint), and verify that (a) the schema API returns the new slot, (b) the contribute form renders the new input with correct label/type, (c) the knowledge table can display it, and (d) server validation accepts a valid value and rejects an invalid one — without modifying `registry.ts` or any Django model by hand.

**Acceptance Scenarios**:

1. **Given** the LinkML YAML is the source of truth and no `registry.ts` edits are made, **When** a maintainer adds a new slot to an existing class in the YAML and runs the regeneration step, **Then** the schema API exposes the slot, the contribute form renders the correct widget (text/select/date/relation/etc.) using labels/descriptions from the YAML, and the knowledge table offers a matching column.
2. **Given** a new class is added to the YAML with `class_uri`, slots, and UI hints, **When** regeneration runs, **Then** the new class appears in the sidebar/catalog (if marked navigable), a contribute form is available, a list view with columns is available, and it is addressable via a generated REST endpoint.
3. **Given** a required slot is declared in the YAML, **When** a user submits the form leaving that field empty, **Then** both client-side validation (from generated JSON Schema) and server-side validation (from LinkML-derived serializer) reject the submission with a human-readable error.
4. **Given** a slot has `slot_uri` (e.g., `crm:P14_carried_out_by`), **When** an entity is saved, **Then** the persisted record round-trips to RDF/SPARQL using that URI without any per-slot code change.

---

### User Story 2 — Frontend loads the ontology registry at runtime (Priority: P1)

A product developer starts the frontend with the Django API reachable. The contribute forms, knowledge tables, and navigation are driven by a registry fetched from the schema API at runtime (with a sensible build-time fallback for offline/CI). Adding or changing a class on the backend does not require rebuilding the frontend — a page reload reflects the new schema.

**Why this priority**: This is the concrete decoupling step that unlocks per-tenant schemas and multi-institution reuse. It is paired with Story 1 because together they turn the YAML into a real single source of truth reachable end-to-end.

**Independent Test**: Point the frontend at a backend whose schema differs from any committed `registry.ts` snapshot (e.g., an added class). Verify the frontend renders the new class's form and table purely from the API response, with no code change and no rebuild.

**Acceptance Scenarios**:

1. **Given** the backend schema-serving endpoint returns a valid registry payload, **When** the frontend boots (or the user navigates to a contribute page), **Then** the forms, tables, and navigation are generated from that payload.
2. **Given** the schema endpoint is temporarily unreachable, **When** the frontend loads, **Then** it falls back to the last-good cached/generated registry and surfaces a non-blocking warning, so users can still view (read-only) previously known classes.
3. **Given** the schema endpoint returns an updated registry after a change, **When** the user reloads the page, **Then** new fields/classes appear without any frontend redeploy.
4. **Given** a class is marked `navigable: false` for the current tenant, **When** the user views the app, **Then** it is hidden from primary navigation but still reachable by direct URL if the user has permission.

---

### User Story 3 — Institution-specific (per-tenant) schema extension (Priority: P2)

A partner institution (e.g., a museum) needs a class that does not exist in the core heritage ontology (e.g., `Collection`) and wants to relabel some existing fields for their staff. An administrator provides a tenant extension config that adds the new class, overrides a few labels/UI hints, and marks some core classes non-navigable. Their deployment sees the merged schema; the core HeritageGraph project is unchanged.

**Why this priority**: This is the reusability/multi-tenant story. It is not required for the first internal release, but it is the reason we are doing this work at all. It depends on Stories 1 and 2.

**Independent Test**: Provision two tenants with different extension configs. Verify each tenant's frontend shows exactly the classes, labels, and sections they configured, that data for tenant A is not visible to tenant B, and that the base HeritageGraph schema continues to work unchanged for tenants with no extension.

**Acceptance Scenarios**:

1. **Given** a tenant provides an extension config that introduces a new class `Collection`, **When** the tenant's users load the app, **Then** `Collection` is available for create/read/update/delete and appears in their navigation, while other tenants do not see it.
2. **Given** a tenant overrides a core slot label (e.g., `ArchitecturalStructure.name` → "Object Name"), **When** the tenant's users open the form, **Then** the overridden label is shown; other tenants continue to see the original label.
3. **Given** a tenant disables a core class via `navigable: false`, **When** the tenant's users load the app, **Then** that class is hidden from their navigation without removing data.
4. **Given** an extension config contains an invalid reference (e.g., overrides a slot that does not exist), **When** the server loads it, **Then** the server refuses to serve that tenant's schema, logs an actionable error, and the platform remains healthy for other tenants.

---

### User Story 4 — SPARQL / LOD reuse via a write-through RDF sidecar (Priority: P3)

A researcher or partner platform wants to query HeritageGraph data with SPARQL or dereference entities as Linked Open Data using the CIDOC-CRM and PROV-O URIs already declared in the YAML. Writes still go through Django (the authoritative store), but an RDF sidecar (triplestore) is kept in sync so that SPARQL queries and LOD dereference return consistent results.

**Why this priority**: This is the long-term interoperability payoff. It depends on Stories 1–2 (because it relies on schema-driven `class_uri`/`slot_uri` mapping) and is additive — the core app keeps working if the sidecar is unavailable.

**Independent Test**: Create/update/delete a handful of entities through the Django API, then run a set of SPARQL queries against the sidecar that use the CIDOC/PROV URIs from the YAML and confirm results match Django. Stop the sidecar and confirm the Django API still serves reads and writes (writes queue for later sync or are re-driven from a background job).

**Acceptance Scenarios**:

1. **Given** an entity is created/updated/deleted via the Django API, **When** the write commits, **Then** the triplestore reflects the change (eventually, within a bounded lag) with triples that use the YAML's `class_uri`/`slot_uri`.
2. **Given** the triplestore is temporarily unavailable, **When** users write through the Django API, **Then** writes still succeed, failures to sync are retried, and no data is silently lost.
3. **Given** a SPARQL query using CIDOC-CRM URIs, **When** executed against the sidecar, **Then** it returns results consistent with the Django API for the same conceptual question.

---

### User Story 5 — Updated API docs and developer-facing documentation (Priority: P2)

A backend developer (or external integrator) opens the API docs and the repository docs and can discover: how to add a class/slot via YAML only, how the schema endpoint works, how tenant extensions merge, and what guarantees exist about the RDF sidecar. API endpoints for dynamic/extension entities are documented the same way as current CIDOC endpoints.

**Why this priority**: Required for the feature to be usable by the team and by partners, but not a blocker for internal dogfooding.

**Independent Test**: A developer who was not involved in the implementation follows only the updated docs to add a new class to the YAML, regenerate, and create/read an entity of that class end to end.

**Acceptance Scenarios**:

1. **Given** the updated docs, **When** a new developer follows them, **Then** they can add a class to the YAML and exercise it via the API and the UI without reading source code.
2. **Given** the schema endpoint and any generated/extension endpoints, **When** a developer opens the API reference (OpenAPI or equivalent), **Then** each is documented with parameters, responses, and auth requirements.

---

### Edge Cases

- A slot is removed from the YAML but data for that slot still exists in the database — reads MUST not crash; the system MUST expose a clearly defined behavior (hide the field from forms/tables, preserve the data, and surface it in an "extra fields" view or migration warning).
- A slot's type changes in the YAML (e.g., `text` → `select` with enum) — the system MUST detect the incompatibility at generation/load time, refuse to serve an inconsistent schema, and surface a migration required error instead of corrupting data.
- Two tenants define classes with the same key but different shapes — each tenant MUST see only its own merged schema; cross-tenant reads MUST not be possible through the schema endpoint.
- The LinkML YAML has a parsing or validation error — the schema endpoint MUST serve the last known-good schema (or clearly fail) and MUST NOT crash the whole API; an operator alert MUST be produced.
- A tenant extension references a core class that was removed — the system MUST refuse to serve that tenant's schema, log an actionable error, and continue serving other tenants.
- The frontend is offline when first loaded — it MUST fall back to the last cached registry (if available) or a build-time generated snapshot, and clearly indicate read-only / degraded mode.
- Regeneration is triggered while write traffic is in flight — regeneration MUST not produce partial or inconsistent schema responses; readers either see the old schema or the new one, never a mix.
- The RDF sidecar drifts from Django (queue lag, outage) — the system MUST provide a way to detect drift and resync, and Django MUST remain the source of truth.
- Existing frontend code paths that import `registry.ts` statically continue to work during migration (Phase 1 must be backward compatible until the full runtime loader is adopted).

## Requirements *(mandatory)*

### Functional Requirements

**Schema as single source of truth**

- **FR-001**: The LinkML YAML (`Heritagegraph.yaml`) MUST be the authoritative source for ontology classes, slots, enums, class URIs, slot URIs, cardinality, required-ness, and permissible values used by the backend, the frontend, validation, and RDF export.
- **FR-002**: The system MUST provide an automated generation step that produces, from the YAML, at minimum: (a) server-side validation for API write paths, (b) a frontend-consumable registry equivalent to today's `OntologyClass`/`OntologyField`/`OntologyColumn` shape, (c) JSON Schema for client-side validation, and (d) a mapping from each slot/class to its RDF URI.
- **FR-003**: After regeneration, the generated artifacts MUST be consistent with each other (same class keys, same slot keys, same types/enums) — inconsistencies MUST fail the generation step.

**Schema-serving API**

- **FR-004**: The backend MUST expose an endpoint (authentication not required; same payload as the committed generated snapshot) that returns the full effective ontology registry for the caller's tenant, including classes, slots, enums, sections, UI hints, and RDF URIs, in a shape the frontend can consume directly.
- **FR-005**: The registry response MUST be cacheable (with an explicit cache key/version) and MUST change its version when the underlying schema changes, so that clients can detect when to refresh.
- **FR-006**: The schema endpoint MUST serve only the requesting tenant's effective schema (core + that tenant's extensions); it MUST NOT leak other tenants' classes, slots, or labels.
- **FR-007**: If the YAML fails to parse or a tenant extension is invalid, the endpoint MUST serve the last-known-good schema for that tenant (or return a well-defined error) and MUST NOT serve a corrupt/partial schema.

**Frontend runtime registry**

- **FR-008**: The frontend MUST load the ontology registry from the schema-serving API at runtime, and render contribute forms, knowledge tables, and navigable entity types from that response.
- **FR-009**: The frontend MUST tolerate temporary unavailability of the schema endpoint by falling back to the most recent cached registry (or a build-time snapshot) and indicating a degraded/read-only state.
- **FR-010**: `registry.ts` MUST no longer contain hand-maintained per-class field/column/section definitions for classes defined in the YAML by the end of this feature; any UI-only metadata that cannot be expressed in the YAML MUST be expressed via a well-defined override mechanism (e.g., tenant UI overrides, generator config), not hand-edited maps.
- **FR-011**: Any static registry module that remains in the frontend MUST be a generated artifact (checked in as a fallback snapshot) and MUST NOT be edited by hand.

**Per-tenant schema extension**

- **FR-012**: The system MUST support per-tenant schema extensions that can (a) add new classes and slots, (b) override labels/descriptions/UI hints for core classes and slots, and (c) toggle `navigable` and category for core classes — without modifying the core YAML.
- **FR-013**: Tenant data MUST be isolated: entities created under tenant A's extensions MUST NOT be visible to tenant B and MUST NOT appear in tenant B's list/search/knowledge views.
- **FR-014**: A tenant extension MUST be validated at load time against the core schema; incompatible extensions MUST be rejected with an operator-actionable error and MUST NOT be served.

**Dynamic/extension data storage**

- **FR-015**: The system MUST continue to support the existing typed Django models for the CIDOC-CRM core (for queryability, FK constraints, and migrations); it MUST NOT require a big-bang rewrite to EAV.
- **FR-016**: The system MUST support storing entities of classes that are defined only in a tenant extension (i.e., that have no typed Django model), including create/read/update/delete, listing, and validation against the YAML-derived schema.
- **FR-017**: Schema-driven CRUD (both for generated-from-YAML classes and for tenant-extension classes) MUST enforce permissions consistent with the existing CIDOC API (including tenant scoping and existing auth contract).

**RDF / SPARQL sidecar**

- **FR-018**: The system MUST provide a write-through RDF sync that, for entities defined in the schema (core and extension), writes triples using the YAML-declared `class_uri` and `slot_uri` values to a triplestore sidecar on every successful Django write.
- **FR-019**: Django MUST remain the system of record: triplestore sync failures MUST NOT block or corrupt Django writes; sync MUST be retriable and MUST support a full re-materialization job.
- **FR-020**: The sidecar MUST expose SPARQL read access suitable for LOD/research consumers; it is not required to serve the interactive UI.

**API documentation and developer ergonomics**

- **FR-021**: Every new or changed endpoint (schema-serving endpoint, extension-entity CRUD endpoints, regeneration/refresh endpoints, sync status endpoint) MUST be documented in the project's API documentation with method, path, parameters, responses, and auth requirements.
- **FR-022**: The repository documentation (`AGENTS.md`, `ARCHITECTURE.md`, and/or `FORMS.md` as applicable) MUST be updated to describe: (a) that the YAML is the single source of truth, (b) how to add a class/slot, (c) how regeneration works, (d) how tenant extensions work, and (e) how the RDF sidecar relates to Django.
- **FR-023**: There MUST be a one-command developer workflow to regenerate all generated artifacts locally (frontend registry snapshot, validation schemas, URI mappings) from the YAML.

**Migration and backward compatibility**

- **FR-024**: During migration, the frontend MUST continue to work against the current hand-maintained `registry.ts` until the runtime loader is in place; switching over MUST be possible per deployment without a code-freeze.
- **FR-025**: Existing CIDOC API endpoints, URLs, and response shapes currently consumed by the frontend MUST remain backward compatible for the duration of the migration; breaking changes MUST follow the existing API versioning practice.

### Constitution-driven Constraints *(mandatory)*

- **C-001**: The implementation MUST NOT introduce committed secrets; any new env vars (e.g., triplestore endpoint, schema cache TTL, extension config path) MUST be added to `.env.example` using `UPPER_SNAKE_CASE` (and `NEXT_PUBLIC_*` where client-visible).
- **C-002**: Frontend network calls to the schema endpoint MUST use `process.env.NEXT_PUBLIC_*` configuration (no hardcoded `http://localhost:*`).
- **C-003**: Protected API calls (including the schema-serving endpoint and any new extension-entity CRUD endpoints) MUST use `Authorization: Bearer <accessToken>` sourced from the NextAuth session.
- **C-004**: The implementation MUST remain compatible with repository quality gates — `ruff format .` / `ruff check .` for changed Python, and the frontend's TypeScript build/typecheck for changed TS — for all touched code.
- **C-005**: Backend additions MUST follow repo conventions (DRF `ModelViewSet` with `DefaultRouter`, explicit permissions, UUID PKs, explicit `db_table`, timestamps); frontend additions MUST follow Next.js App Router + TypeScript conventions (named exports, `"use client"` only where needed, no direct edits to `src/components/ui/`, Tailwind via CSS variables).
- **C-006**: Schema/database changes MUST be expressed as Django migrations and SHOULD be reversible when feasible; breaking API changes MUST include a migration/rollout plan per the constitution.

### Key Entities *(include if feature involves data)*

- **Ontology Schema (LinkML YAML)**: The authoritative ontology — classes, slots, enums, class URIs, slot URIs, cardinality, UI hints expressible in LinkML (label/description). One per project (core) plus optional per-tenant extensions.
- **Schema Registry (backend)**: A server-side, tenant-scoped object that holds the parsed, validated, merged effective schema (core + tenant extension) and a version identifier used for caching and change detection. Rebuilt when inputs change; referenced by the schema-serving endpoint.
- **Tenant**: An institution/deployment scope that owns its data and (optionally) its schema extension; controls which core classes are navigable and how core labels/sections are presented to its users.
- **Tenant Schema Extension**: A declarative configuration, owned by a tenant, that adds classes/slots, overrides labels/UI hints, and toggles navigability — validated against the core schema before being served.
- **Generated Frontend Registry Snapshot**: A build-time artifact produced from the core YAML (plus any default UI config), checked into the frontend as a fallback for offline/CI/early-boot; never hand-edited.
- **Entity (typed core)**: A record of a CIDOC-CRM core class stored in an existing typed Django model (e.g., `Person`, `Temple`), still used for queryability and FK integrity.
- **Entity (dynamic/extension)**: A record of a class that is defined only in a tenant extension, stored in a schema-aware dynamic store with tenant scoping, validated against the merged schema, and round-trippable to RDF.
- **RDF Triple (sidecar)**: The triplestore projection of any entity using the YAML-declared `class_uri`/`slot_uri`; eventually consistent with Django; read-only for external SPARQL/LOD consumers.
- **Schema Version Identifier**: A monotonically changing value exposed by the schema endpoint and used by the frontend to invalidate caches and by the sidecar to detect re-materialization needs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding or changing a slot (or adding a new class) in the LinkML YAML flows to the contribute form, the knowledge table, and server-side validation with zero hand-edits to `registry.ts` or Django model files in 100% of agreed-in-scope cases.
- **SC-002**: Time-to-ship a new ontology class end-to-end (YAML edit → deployed form + table + API) is reduced from the current multi-file workflow to a single-file edit plus one regeneration/deploy, measured to complete in under 30 minutes by someone who has not touched the ontology code before.
- **SC-003**: At least 95% of the fields currently defined by hand in `registry.ts` for CIDOC-CRM core classes are generated from the YAML at the end of the feature (the remaining ≤5% documented as intentional UI-only overrides).
- **SC-004**: The schema-serving endpoint responds in under 200 ms at the p95 under normal load for a registry of at least 50 classes and 500 slots, and serves a cached response when the schema version is unchanged.
- **SC-005**: The frontend is demonstrably schema-driven: reviewers can add a valid class to the YAML (in a staging environment), reload the app, and see the new class's contribute form and table without any frontend code change or rebuild.
- **SC-006**: Tenant isolation is enforced: in an automated check across two tenants with different extensions, 0 cases of cross-tenant class/slot/data leakage are observed.
- **SC-007**: Triplestore sync lag is under 60 seconds p95 for normal writes, and a full re-materialization job can rebuild the sidecar from Django without data loss or duplication.
- **SC-008**: All new and changed endpoints appear in the API documentation; a developer unfamiliar with the work can add a class to the YAML, exercise it via the UI and the API, and explain tenant extensions using only the updated docs.
- **SC-009**: No regression in the existing CIDOC API contracts used by the current frontend during the migration window — existing endpoints keep their URLs, request/response shapes, and auth requirements until a documented deprecation.

## Assumptions

- The LinkML YAML (`Heritagegraph.yaml`) is structurally valid and sufficient as the source of truth; minor cleanups may be required during implementation (e.g., filling missing `class_uri`/`slot_uri`, normalizing enum references), but no re-modeling of the ontology is in scope.
- The frontend's `OntologyClass`/`OntologyField`/`OntologyColumn` type shape is expressive enough to carry what is needed for rendering; if any UI hint cannot be expressed in LinkML directly, it will be expressed as an override config rather than by hand-editing `registry.ts`.
- PostgreSQL + Django remains the primary store; the RDF sidecar is an additional, read-oriented surface for SPARQL/LOD and is not on the critical path for interactive UX.
- Existing authentication (NextAuth → Bearer token → Django) is reused as-is for the schema endpoint and any new endpoints; no new auth flow is introduced by this feature.
- Tenancy is scoped per deployment/institution using the repo's existing notion of tenants (or a minimal addition if one does not yet exist); multi-tenancy inside a single deployment is desirable but can be rolled out incrementally — Story 3 is explicitly P2 so it can ship after Stories 1–2.
- The core CIDOC-CRM typed Django models (e.g., `Person`, `Temple`, `ArchitecturalStructure`) remain and continue to back the primary CIDOC endpoints; dynamic storage is additive for extension classes.
- Generation can run at build time and/or server startup; a live "edit YAML in production and refresh" capability is desirable for operators but not required for the first release.
- Existing quality gates (`ruff` for Python, TypeScript build for the frontend) continue to apply and will gate the generated artifacts as well as hand-written code.
