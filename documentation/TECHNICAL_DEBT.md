# Technical Debt & Architectural Redundancy

> **Purpose:** An honest, reviewer-facing record of known redundancy and technical debt,
> for scientific transparency (Nature-style "Known limitations"). None of the items below
> break the verified contribution → review → projection → graph workflow; they are
> consolidation opportunities that need a deliberate decision rather than an ad-hoc removal.
>
> Status date: 2026-06-01.

---

## 1. Two graph/SPARQL backends — RESOLVED

There were previously two graph/SPARQL surfaces: the Django-integrated
`heritage_graph/apps/graph/kg_engine/` (canonical — registry→RDF projection, named-graph
partitions, outbox, `/cidoc/kg/*` API) and a separate standalone FastAPI `graph-api` service
(`semantic_backend/`). The application never consumed `graph-api` (no frontend reference), so
it has been **retired**: the `semantic_backend/` directory, the `graph-api` compose service,
its Traefik routing, the `NEXT_PUBLIC_GRAPH_URL` env, and the stale repo-root `Heritage.ttl`
it served were all removed. **`kg_engine` is now the single authoritative knowledge-graph
backend.**

---

## 2. Legacy `Submission` data model coexists with `CulturalEntity`

`ARCHITECTURE.md` documents two parallel data systems:

- **Legacy:** `Submission` (80+ flat `CharField`s) — "being phased out."
- **Current:** `CulturalEntity` → `Revision` (JSONField, versioned, review workflow).

**Debt:** dual write/read models increase surface area and reviewer confusion.
**Recommendation:** migrate remaining `Submission` consumers to `CulturalEntity` and remove
the legacy model + its serializers/views/migrations once no endpoint depends on it.

---

## 3. Suspended OCR / AI ingestion pipeline — DISABLED by default

The OCR pipeline and the 5-agent KG ingestion pipeline
(`heritage_graph/apps/document_processing/services/agents/`) are **suspended (future
functionality)** and have been switched off in the active configuration:

- `OCR_ENABLED` now **defaults to `false`** (`settings/base.py`, `.env.example`). The upload
  signal short-circuits gracefully when off — document uploads still succeed; no OCR/agent
  task is enqueued.
- The `ocr-worker` Celery service has been **removed from all active Docker stacks**
  (`docker-compose.yml`, `-dokploy`, `-coolify`), replaced by a `SUSPENDED` comment. Its full
  definition and the fat `ocr-worker` image target remain in git history / `Dockerfile.backend`.

**Remaining cleanup (optional):** the pipeline source and its standalone test scripts
(`tests/test_agents.py`, `tests/test_pipeline_smoke.py`) still live in the tree for revival;
move them to a branch/sub-package if you prefer them out of the submission artifact entirely.
**To revive:** set `OCR_ENABLED=true` and restore the `ocr-worker` service.

---

## 4. Legacy local-dev schema seeder

`heritage_graph/apps/graph/management/commands/oxigraph_seed_schema.py` seeds the local
Oxigraph store from repo-root `final_schema.yaml` / `schema.yaml`. This duplicates the
canonical TBox-loading path (`make rdf-load-tbox` → `ontology/Heritage.ttl`).

**Debt:** keeps two extra root-level schema files alive (`schema.yaml`, `final_schema.yaml`)
that otherwise look like stray scratch. They were **not** deleted during cleanup because this
command still references them. **Recommendation:** retire the command and delete both YAMLs,
standardising on `rdf_load_tbox`.

---

## 5. Environment/version consistency

- **Python version (RESOLVED):** standardised on **3.12** across `Dockerfile.backend`,
  `pyproject.toml`, `CLAUDE.md`, and CI. (A local dev venv may still be 3.11 — recreate it
  with 3.12 to match the deployable image.)
- **Migration drift (RESOLVED):** models had uncommitted schema changes (index removals,
  field-option syncs). Migrations were regenerated (`cidoc_data 0014`, `graph 0002`,
  `heritage_data 0025`, all non-destructive) so `makemigrations --check` is clean. The new
  `backend-tests` CI workflow now guards against re-introducing drift.
- **Dependency warning:** `requests`/`urllib3`/`charset-normalizer` emit a
  `RequestsDependencyWarning` at runtime; pin a mutually-compatible set.

---

## 6. Documentation sprawl

**Addressed (2026-06):** Topic guides live under `documentation/<topic>/`. E2E runners in
`tests/`. Root keeps `README`, `DOCS`, `AGENTS`, `CLAUDE`, `ARCHITECTURE`, `CONTRIBUTING`,
`CHANGELOG` only. Internal planning notes consolidated under `documentation/internal/`.
