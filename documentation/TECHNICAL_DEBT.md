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
canonical TBox-loading path (`make rdf-load-tbox` → `ontology/HeritageGraph.ttl`).

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

## 6. Contribute forms and Django models have diverged

**Found 2026-07-26** while verifying the ontology 1.1.0 upgrade. Pre-existing: the same
counts hold on the 1.0.0 tree, so the upgrade neither caused nor worsened it.

Contribute forms render from the schema registry, which projects **ontology slots**. The
Django models implement a different, largely disjoint vocabulary. Nothing reconciles them,
so the registry happily advertises fields the API cannot accept.

**Symptom A — inputs that discard what is typed.** 171 of 262 registry form fields (65%)
have no matching serializer field. DRF's `ModelSerializer` ignores unknown keys, so the
value is dropped silently — no error, no stored data. Meanwhile real columns are missing
from the form: `person` offers `birth_timespan` / `member_of_group` / `expertise_area`
(none stored) while `biography`, `birth_date`, `death_date`, `occupation` and `aliases`
never appear.

**Symptom B — 12 forms that could not submit at all. Fixed 2026-07-26.** When such a slot
is also marked `required`, the class becomes un-POSTable: the serializer drops the field,
then the `registry_jsonschema` gate rejects the payload for omitting it. This affected
`consecration`, `enshrinement`, `event`, `festival`, `kumari_retirement`,
`kumari_selection`, `kumari_tenure`, `monument`, `production`, `ritual`, `source` and
`transfer_of_custody`. Each blocker needed a different answer, because "unbacked" was not
uniformly true:

| Blocker | Scope | Resolution |
| --- | --- | --- |
| `has_timespan` | unbacked on **every** model | `ui_hidden` in `tools/ui-presentation.yaml`. No model reifies `TimeSpan`; the columns are `date_earliest` / `date_latest`. |
| `has_current_location` | backed on `structure`, absent on `monument` | Dropped the unconditional `required: true` on `ArchitecturalStructure`, which contradicted the `rules:` block directly above it — the alpha.5 comment said enforcement should be conditional on `ExistenceStatus`, but the flag was never removed. |
| `name` | backed everywhere except `source` | `SourceSerializer` accepts `name` as a write alias for `title`, so it survives into `validated_data` where the gate reads it. |

Hiding `has_timespan` unblocks those ten forms but leaves them with **no date input at
all**, since `date_earliest` / `date_latest` are not projected as slots. That is a
deliberate trade — a submittable form with a missing field beats a form that returns 400
for every contribution — but exposing the literal date columns as slots is the real fix
and is still outstanding.

Note that `ContributionFlowMixin._payload_for_registry_validation` validates
`serializer.validated_data` rather than the request body, which is what turns a dropped
field into a "required property missing" error. Fixing that alone is **not** an
improvement: those endpoints would start accepting records and then discard the required
value silently. Loud failure is preferable until the models and the registry agree.

**Recommendation:** pick one contract per slot — add the backing column, or stop
projecting the slot into forms (`ui_hidden`, as done for the PROV-O mixin slots in
`tools/ui-presentation.yaml`), or store unbacked slots generically.

The gap is now measured rather than estimated. `make registry-alignment` regenerates
[`documentation/ontology/REGISTRY_MODEL_ALIGNMENT.md`](ontology/REGISTRY_MODEL_ALIGNMENT.md)
with the per-domain counts, and `make check` fails when it is stale. Behaviour is pinned
by `apps/cidoc_data/test_registry_contribution_matrix.py`, which drives every domain
through form → review → browse → graph; all 26 now complete the round trip, so a
regression back to an unsubmittable form fails the suite.

---

## 7. Documentation sprawl

**Addressed (2026-06):** Topic guides live under `documentation/<topic>/`. E2E runners in
`tests/`. Root keeps `README`, `DOCS`, `AGENTS`, `CLAUDE`, `ARCHITECTURE`, `CONTRIBUTING`,
`CHANGELOG` only. Internal planning notes consolidated under `documentation/internal/`.
