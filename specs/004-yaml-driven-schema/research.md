# Research: YAML-driven schema & UI generation (004-yaml-driven-schema)

**Date**: 2026-04-19  
**Spec**: `spec.md` | **Plan**: `plan.md`

## R-001 — LinkML as the parser and generator hub

**Decision:** Use **LinkML** (`linkml` + `linkml-runtime`) with **`SchemaView`** over the merged schema file(s) to enumerate classes, induced slots, enums, URIs (`class_uri`, `slot_uri` / mappings), and cardinality. Wrap standard generators where they fit; add **one custom emitter** that outputs the existing frontend **`OntologyRegistry`** JSON shape (classes + enums) so the UI does not need a parallel mental model.

**Rationale:** LinkML is the native tooling for the YAML already in the repo; duplicating parsing with ad-hoc PyYAML would reintroduce drift. `SchemaView.class_induced_slots()` matches “what the API should expose per class.”

**Alternatives considered:**

- **Manual PyYAML only** — rejected: no slot inheritance, no validation, high bug risk.
- **JSON Schema alone as source** — rejected: loses LinkML semantics and CRM alignment already encoded in YAML.

---

## R-002 — Mapping LinkML ranges to UI field types

**Decision:** Define an explicit **mapping table** (in generator config, not scattered `if` in UI) from LinkML ranges / slot patterns to `FieldType` (`text`, `textarea`, `select`, `relation`, …). Relations: detect slots whose range is another class (or use `any_of` / foreign key conventions already in YAML) and emit `relation` + `relationEndpoint` derived from a **stable convention** (e.g., class key → existing `/cidoc/{plural}/` route table). Until every relation is expressible in YAML, allow **generator-side overrides** in a small `ui-mapping.yaml` checked in next to LinkML.

**Rationale:** The current `registry.ts` encodes presentation rules; moving them to a **data file** preserves single-edit workflow without forcing all UI hints into LinkML annotations immediately.

**Alternatives considered:**

- **Put all UI in LinkML annotations** — deferred: high migration cost; can converge later.
- **Hardcode mapping in TypeScript** — rejected: violates FR-010/FR-011.

---

## R-003 — Server validation strategy (typed vs dynamic)

**Decision:** **Two tracks:** (1) **Typed models** — keep `ModelSerializer` + DB constraints; augment with **JSON Schema** or **Pydantic** models generated from LinkML for “extra” slots or for a validation pass that compares submitted keys to induced slots (reject unknown keys in strict mode). (2) **Dynamic/extension entities** — store `JSONField` payload validated entirely against **merged schema** (JSON Schema or dynamic DRF fields generated from `SchemaView`).

**Rationale:** Big-bang EAV for core CIDOC tables is out of scope (FR-015); dynamic path is required for tenant-only classes (FR-016).

**Alternatives considered:**

- **EAV for everything** — rejected by spec (performance, FKs, migrations).
- **Only JSONField for all entities** — rejected: loses queryability for core resources.

---

## R-004 — Tenancy phasing (repo has no `Tenant` model today)

**Decision:** **Phase A (M1–M2):** Single deployment / single logical tenant — `SchemaRegistry` keyed by **schema version** only; extension config path via env (`HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` optional). API shape includes **`tenant_id: null` or `"default"`** for forward compatibility. **Phase B:** Introduce **`Tenant`** model + FK on `SchemaRegistry`, dynamic entities, and extension storage; enforce isolation (FR-013).

**Rationale:** Grep shows no existing tenant table; building full multi-tenant DB before the schema API works delays P1 stories. Spec allows incremental rollout (Assumptions).

**Alternatives considered:**

- **Require full multi-tenant schema before any release** — rejected: blocks M1 delivery.
- **Never add tenants** — rejected: contradicts P2 user stories.

---

## R-005 — Schema API caching and versioning

**Decision:** Compute **`schema_version`** as a hash of (core YAML bytes + extension bytes + generator version). Expose in JSON body and **`ETag`** / **`Cache-Control`** headers. Django process holds in-memory copy; invalidate when hash changes on deploy or admin refresh.

**Rationale:** Meets FR-005 and SC-004 without Redis (optional later).

**Alternatives considered:**

- **Timestamp-only version** — weaker: same content could bump unnecessarily.
- **No caching** — fails p95 target for large registries.

---

## R-006 — Frontend loading strategy

**Decision:** **`loadOntologyRegistry()`** using existing **`apiUrl()`** + **`apiFetchJson`** with Bearer token when session exists. **SWR** or **React Query** for dedupe + stale-while-revalidate. **Fallback:** import **`generated-registry.snapshot.json`** (or generated `registry.generated.ts`) produced at build time; show non-blocking banner when API fails.

**Rationale:** Matches constitution (`NEXT_PUBLIC_API_URL`), FR-008/FR-009, FR-024.

**Alternatives considered:**

- **Only static import** — fails FR-008.
- **Service worker cache only** — unnecessary complexity for v1.

---

## R-007 — RDF sidecar and sync mechanism

**Decision:** Use **`rdflib`** (or existing RDF utilities if added) to build triples from **typed model instances + dynamic JSON** using YAML **`class_uri` / `slot_uri`**. Emit to sidecar via **HTTP SPARQL Update** (Oxigraph, Fuseki, GraphDB) or ** Celery task + retry queue**. Django write **always succeeds** first; sync **async** with dead-letter visibility (FR-019).

**Rationale:** Repo has `oxigraph_db/` directory but no compose service in root `docker-compose.yml` — implementation will add a **documented** sidecar container or external endpoint via env (`RDF_ENDPOINT_URL`).

**Alternatives considered:**

- **Synchronous triplestore on every request** — rejected: availability coupling.
- **RDF as primary store** — rejected by spec (Postgres is SoR).

---

## R-008 — Documentation alignment

**Decision:** Update **`FORMS.md`** as the primary contributor-facing doc for “how forms are built”; **`ARCHITECTURE.md`** for data flow; **`AGENTS.md`** for automation/agent rules; **`API_VERSIONING.md`** when routes are versioned. Keep **spec contracts** in `specs/004-yaml-driven-schema/contracts/` as the source of truth for payload shapes; **drf-spectacular** should expose the same operations in `/schema/` when implemented.

**Rationale:** Satisfies FR-021/FR-022 and user request to plan markdown updates.

---

## Open items (implementation tasks, not blockers for planning)

- Canonical path: unify **`ontology/HeritageGraph.yaml`** vs root **`Heritagegraph.yaml`** (typo in `id:` may need cleanup).
- Whether LinkML runs in **CI** on every PR or only when `ontology/**` changes (recommend path filter).
- Exact **OpenAPI** operationIds for schema routes once chosen (`/api/v1/cidoc/schema/` vs `/api/v1/schema/`).
