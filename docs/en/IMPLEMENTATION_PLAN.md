# HeritageGraph — Grounded Implementation Plan

> Derived from `docs/en/plan.md` (the end-to-end LOD workflow spec) and the actual repo state as of 2026-06-15.
> Branch: `v1`

---

## How to read this document

- **Status tags:** `[DONE]` = code exists · `[PARTIAL]` = scaffolded but incomplete · `[TODO]` = not yet built
- Each milestone lists the **exact files to create or modify**, the **Django/Next.js feature to use**, and a **verification step**.
- Phases match the 12-phase map in `plan.md`.

---

## What already exists (baseline audit)

| Area | Status | Location |
|------|--------|----------|
| Google OAuth / NextAuth auth | `[DONE]` | `heritage_graph_ui/src/lib/auth.ts`, `apps/users/` |
| CIDOC-CRM entity models (Temple, Deity, Guthi, etc.) | `[DONE]` | `apps/cidoc_data/models.py` |
| `HeritageAssertion` model with source/author/time | `[DONE]` | `apps/cidoc_data/models.py:1068` |
| `DataSource` model | `[DONE]` | `apps/cidoc_data/models.py:868` |
| `Project` / `ProjectMembership` / `ProjectAsset` / `ProjectSnapshot` models | `[DONE]` | `apps/heritage_data/models.py:2105–2390` |
| CARE validation logic | `[DONE]` | `apps/cidoc_data/care_validation.py` |
| Nanopublication TriG export | `[DONE]` | `apps/graph/kg_engine/nanopub_export.py` |
| RDF-star export | `[DONE]` | `apps/graph/kg_engine/rdfstar_export.py` |
| SKOS vocabulary TTL | `[DONE]` | `ontology/lod/skos-vocabularies.ttl` |
| VoID + DCAT TTL | `[DONE]` | `ontology/lod/void-dataset.ttl` |
| SHACL shapes | `[DONE]` | `ontology/shapes/generated-heritagegraph-minimal-shacl.ttl` |
| Reconciliation service skeleton | `[DONE]` | `apps/graph/reconciliation/service.py` |
| RDF sync outbox | `[DONE]` | `apps/graph/models.py` (RDFSyncOutbox) |
| Contribute forms (frontend) | `[DONE]` | `heritage_graph_ui/src/app/(dashboard)/contribute/` |
| Review / curation pages (frontend) | `[DONE]` | `heritage_graph_ui/src/app/(dashboard)/review/`, `curation/` |
| ORCID linking | `[TODO]` | — |
| Project-scoped named graphs (contributor isolation) | `[PARTIAL]` | `apps/graph/kg_engine/partitions.py` |
| Formal MergeRequest model + workflow | `[TODO]` | — |
| DL reasoning (HermiT/Pellet) integration | `[TODO]` | — |
| CARE enforcement at SPARQL query time | `[TODO]` | — |
| Dereferenceable URIs / content negotiation | `[PARTIAL]` | `apps/graph/lod_views.py` |
| DataCite DOI minting | `[TODO]` | — |
| schema.org + sitemaps | `[TODO]` | — |
| Supersession chain (nanopub retraction) | `[PARTIAL]` | `supersedes_assertion` field on HeritageAssertion |

---

## Phase 0 — Identity & Roles

### 0-A ORCID Linking `[TODO]`

**What:** Add OAuth2 ORCID flow so `was_attributed_to_agent` resolves to a globally-unique researcher identity.

**Files to create/modify:**
- `heritage_graph/apps/users/models.py` — add `orcid_id = models.CharField(max_length=64, blank=True)` to `UserProfile`
- `heritage_graph/apps/users/views.py` — add `orcid_connect` and `orcid_callback` views
- `heritage_graph/apps/users/urls.py` — wire `/api/users/orcid/connect/` and `/api/users/orcid/callback/`
- `heritage_graph/settings/base.py` — add `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET`, `ORCID_REDIRECT_URI` from env
- `heritage_graph_ui/src/app/(dashboard)/account/page.tsx` — add "Connect ORCID" button; call `/api/users/orcid/connect/`

**Django feature:** Standard `requests`-based OAuth2 code-exchange (no extra library needed). Store `orcid_id` on `UserProfile`.

**Verification:** After linking, `UserProfile.orcid_id` is non-empty; a HeritageAssertion created by that user has `was_attributed_to_agent` = ORCID URI.

---

### 0-B Role enforcement hardening `[PARTIAL]`

`ReviewerRole` and `Reviewers` group exist. Ensure **a contributor cannot approve their own MergeRequest** (enforced in Phase 7-B below).

---

## Phase 1 — Project Creation & PID Minting

### 1-A Project PID `[TODO]`

**What:** On `Project` creation, mint `w3id.org/heritagegraph/project/{uuid}` and store it.

**Files to modify:**
- `heritage_graph/apps/heritage_data/models.py:2105` (`Project`) — add `pid = models.URLField(max_length=512, blank=True)` and `prov_activity_uri = models.URLField(blank=True)`
- `heritage_graph/apps/heritage_data/signals.py` (create if absent) — `post_save` signal that calls `apps/graph/kg_engine/uris.py` to mint the PID and writes a `ProjectCreationActivity` triple to the graph outbox
- `heritage_graph/apps/heritage_data/apps.py` — import signal in `ready()`

**Django feature:** `post_save` signal + `RDFSyncOutbox` INSERT_NT operation.

**Verification:** `Project.objects.get(pk=…).pid` is non-empty after creation; `rdf_drain_outbox` management command succeeds.

---

### 1-B Project named graph isolation `[PARTIAL]`

**What:** Each Project must write assertions to its own named graph `…/project/{uuid}/graph`, isolated from the main graph.

**Files to modify:**
- `apps/graph/kg_engine/partitions.py` — add `PROJECT = "project"` partition variant; `ProjectPartition.uri(project_id)` returns `f"{RDF_RESOURCE_BASE_URI}/project/{project_id}/graph"`
- `apps/cidoc_data/models.py` (`HeritageAssertion`) — add `project = models.ForeignKey("heritage_data.Project", null=True, blank=True, on_delete=models.SET_NULL)` and `named_graph = models.URLField(blank=True)` (auto-set from project on save)
- `apps/graph/kg_engine/assertion_projection.py` — pass `named_graph` to SPARQL INSERT

**Verification:** After creating an assertion attached to a project, the triple appears under the project's named graph in Oxigraph (`SELECT * WHERE { GRAPH <…/project/{id}/graph> { ?s ?p ?o } }`).

---

## Phase 2 — Heterogeneous Ingest

### 2-A DataSource type classification `[PARTIAL]`

`DataSource` model exists but lacks `datacite_*` fields and typed subclasses.

**Files to modify:**
- `apps/cidoc_data/models.py` (`DataSource`, line 868) — add:
  ```python
  SOURCE_TYPE_CHOICES = [
      ("field_survey", "FieldSurveyDataset"),
      ("oral_history", "OralHistoryRecording"),
      ("archival", "ArchivalRecord"),
      ("image", "ImageDataset"),
      ("pdf", "PDFDocument"),
  ]
  source_type = models.CharField(max_length=32, choices=SOURCE_TYPE_CHOICES, default="field_survey")
  datacite_identifier = models.URLField(blank=True)
  datacite_creator = models.CharField(max_length=512, blank=True)
  datacite_publisher = models.CharField(max_length=256, blank=True, default="CAIR-Nepal")
  datacite_resource_type = models.CharField(max_length=64, blank=True)
  ```
- `apps/cidoc_data/migrations/` — generate migration: `python manage.py makemigrations cidoc_data`
- Frontend: `heritage_graph_ui/src/app/(dashboard)/contribute/data-source/page.tsx` — add `source_type` dropdown and DataCite metadata fields

**Verification:** POST to `/api/cidoc/data-sources/` with `source_type=oral_history` returns 201 and the type is stored.

---

### 2-B CARE / TK label enforcement at ingest `[PARTIAL]`

`care_validation.py` exists. Wire it as a DRF permission on `DataSource` and `HeritageAssertion` write endpoints.

**Files to modify:**
- `apps/cidoc_data/permissions.py` — add `CAREAccessPermission(BasePermission)` that reads `access_tier` from the object and compares to `request.user` groups
- `apps/cidoc_data/views.py` — add `permission_classes = [..., CAREAccessPermission]` to `DataSourceViewSet` and `HeritageAssertionViewSet`

---

### 2-C IIIF manifest generation `[TODO]`

**What:** When an image DataSource is uploaded, generate a IIIF Presentation v3 manifest.

**Files to create:**
- `apps/document_processing/iiif.py` — `generate_manifest(data_source) -> dict` using Cantaloupe or static manifest pattern
- `apps/document_processing/signals.py` — extend existing signal to call `generate_manifest` for `source_type=image`

**Django feature:** `post_save` signal; store manifest as JSON in `DataSource.iiif_manifest = models.JSONField(null=True)` (add field to model).

---

## Phase 3 — Model & Assert

### 3-A Event materialisation on form submit `[PARTIAL]`

Assertion capture works; the event layer (`Production`, `Enshrinement`, `Consecration`) is in the schema but not auto-materialised on every field save.

**Files to modify:**
- `apps/cidoc_data/rdf_signals.py` — in `on_assertion_saved`, detect `asserted_property` values that map to event predicates (`was_produced_by_event`, `enshrined_deity`, etc.) and INSERT the event node triple in the same named graph
- `apps/graph/kg_engine/engine.py` — add `materialise_event_node(assertion, event_class)` helper

**Tool:** Use the existing `RDFSyncOutbox` INSERT_NT operation; do not write directly to Oxigraph in the signal.

---

### 3-B Multi-calendar TimeSpan `[TODO]`

**What:** Store dates with `calendar_system` (Bikram Sambat, Nepal Sambat, Gregorian) and `date_precision`.

**Files to create:**
- `apps/cidoc_data/timespan.py` — `TimeSpan` dataclass + `to_rdf(graph, subject_uri)` that emits `crm:E52_Time-Span` with `calendar_system` and `date_precision` literals
- `apps/cidoc_data/models.py` — add `calendar_system` and `date_precision` to `HeritageAssertion`

**Frontend:** `heritage_graph_ui/src/components/CalendarDatePicker.tsx` — dropdown for calendar system + year/precision inputs; used in any contribute form with a date field.

---

## Phase 4 — Validation & Reasoning

### 4-A SHACL validation on submission `[TODO]`

**What:** Run SHACL shapes (`ontology/shapes/generated-heritagegraph-minimal-shacl.ttl`) against a project graph before a MergeRequest can be opened.

**Files to create:**
- `apps/graph/shacl_validate.py` — `validate_project_graph(project_id) -> ValidationReport` using `pyshacl` library
- `apps/graph/management/commands/shacl_validate.py` — `python manage.py shacl_validate --project <id>`

**Django feature:** `pyshacl` (add to `requirements.txt`). Call from MergeRequest `pre_save` signal to block opening if violations > 0.

**Verification:** `python manage.py shacl_validate --project <test-id>` exits 0 on a valid graph, non-zero on a shape violation.

---

### 4-B DL reasoning (ALCIQ-D consistency check) `[TODO]`

**What:** Run HermiT or Pellet via a subprocess or REST call to catch disjointness violations before merge.

**Files to create:**
- `apps/graph/reasoning.py` — `check_consistency(named_graph_uri) -> bool` — serialize graph to OWL/XML, call `hermit.jar` via `subprocess.run`, parse result
- `apps/graph/management/commands/reason_check.py` — CLI wrapper

**Tool:** `hermit.jar` (add to `infra/` or as a Docker sidecar). Pass the project graph export as input.

**Verification:** `python manage.py reason_check --project <id>` returns `CONSISTENT` on valid data, `INCONSISTENT` on a Temple+WaterStructure disjointness violation (write a unit test in `apps/graph/test_reasoning.py`).

---

### 4-C PID uniqueness check `[TODO]`

Add to `apps/cidoc_data/views.py` in `HeritageAssertionViewSet.create()`: before saving, SPARQL-query Oxigraph to verify the subject URI does not already exist in the main graph with a conflicting type. Return HTTP 409 if collision detected.

---

## Phase 5 — Reconciliation

### 5-A Wikidata / Getty reconciliation `[PARTIAL]`

`apps/graph/reconciliation/service.py` exists.

**What's missing:**
- Bulk reconciliation endpoint called on entity save
- Storing results as `skos:exactMatch` / `skos:closeMatch` on the entity in the named graph

**Files to modify:**
- `apps/graph/reconciliation/service.py` — add `reconcile_entity(entity_uri, label, entity_type) -> list[Match]` using Getty AAT SPARQL and Wikidata entity search API
- `apps/cidoc_data/rdf_signals.py` — call `reconcile_entity()` async via Celery task (`heritage_graph/celery_app.py` already exists) after assertion save; write matches to `RDFSyncOutbox`
- `apps/graph/tasks.py` (create) — `@shared_task def reconcile_async(entity_uri, label, entity_type)`

**Tool:** Celery (`celery_app.py` exists), `requests` for Getty/Wikidata APIs.

---

### 5-B Duplicate detection `[TODO]`

**Files to create:**
- `apps/cidoc_data/duplicate_detection.py` — `find_duplicates(entity_uri, label) -> list[str]` — SPARQL query against main graph for `skos:prefLabel` or `rdfs:label` similarity
- Called from `HeritageAssertionViewSet.create()` to warn (not block) when a near-duplicate exists

---

## Phase 6 — Preview (Git-like history)

### 6-A Assertion history view `[TODO]`

**What:** Show a timeline of `HeritageAssertion` records for a project as "commits."

**Frontend files to create:**
- `heritage_graph_ui/src/app/(dashboard)/contribute/projects/[slug]/history/page.tsx` — list assertions ordered by `generated_at_time` with author, property, value columns
- `heritage_graph_ui/src/app/(dashboard)/contribute/projects/[slug]/history/page.tsx` — "Rollback to this assertion" button (calls new API endpoint below)

**Backend:**
- `apps/heritage_data/views.py` — add `@action(detail=True) def assertion_history(self, request, pk=None)` on `ProjectViewSet`; returns paginated `HeritageAssertion` filtered by project

---

## Phase 7 — Merge Request

### 7-A MergeRequest model `[TODO]`

**What:** Formal model tracking the lifecycle of a merge request from a project graph into the main graph.

**Files to create/modify:**
- `apps/heritage_data/models.py` — add:
  ```python
  class MergeRequest(models.Model):
      STATUS = [("pending","Pending"),("changes_requested","Changes Requested"),("approved","Approved"),("rejected","Rejected"),("merged","Merged")]
      id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
      project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="merge_requests")
      opened_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="opened_merge_requests")
      status = models.CharField(max_length=32, choices=STATUS, default="pending")
      summary = models.TextField()
      justification = models.TextField(blank=True)
      conflict_diff = models.JSONField(default=dict)
      merge_activity_uri = models.URLField(blank=True)
      created_at = models.DateTimeField(auto_now_add=True)
      updated_at = models.DateTimeField(auto_now=True)

      class Meta:
          db_table = "heritage_merge_request"
          ordering = ["-created_at"]
  ```
- `apps/heritage_data/serializers.py` — `MergeRequestSerializer`
- `apps/heritage_data/views.py` — `MergeRequestViewSet(ModelViewSet)` with custom `@action(detail=True) def approve/reject/request_changes`
- `apps/heritage_data/urls.py` — register `router.register(r"merge-requests", MergeRequestViewSet)`
- `apps/heritage_data/permissions.py` — `CannotApproveOwnMergeRequest(BasePermission)` — rejects if `request.user == merge_request.opened_by`
- Migration: `python manage.py makemigrations heritage_data`

---

### 7-B Pre-flight conflict diff `[TODO]`

**Files to create:**
- `apps/graph/conflict_diff.py` — `compute_diff(project_graph_uri, main_graph_uri) -> dict` — SPARQL `SELECT` for triples in project graph not in main graph and vice versa
- Called in `MergeRequestViewSet.create()` to populate `conflict_diff` before saving

---

### 7-C MergeRequest frontend `[TODO]`

**Files to create:**
- `heritage_graph_ui/src/app/(dashboard)/contribute/projects/[slug]/merge-request/page.tsx` — form with summary, justification; shows conflict diff table; "Open MergeRequest" button
- Add navigation link in `src/components/dashboard/app-sidebar.tsx`

---

## Phase 8 — Review

### 8-A RDF-star diff view for reviewers `[TODO]`

**Files to create:**
- `apps/graph/views.py` — add `/api/graph/merge-requests/{id}/rdf-diff/` endpoint: renders conflict_diff as RDF-star annotated triples (confidence, source)
- `heritage_graph_ui/src/app/(dashboard)/review/[id]/page.tsx` — display diff with color-coded add/remove rows and source/confidence columns

### 8-B Verification activity recording `[TODO]`

When a reviewer approves, record a `Verification` triple:
- `apps/heritage_data/views.py` in `MergeRequestViewSet.approve()` — write `hg:VerificationActivity` triple to outbox with `prov:wasAssociatedWith reviewer_uri`, `hg:verification_method`, `prov:atTime`

---

## Phase 9 — Merge & PID Minting

### 9-A Merge execution `[TODO]`

**Files to create:**
- `apps/graph/merge.py` — `execute_merge(merge_request_id)`:
  1. SPARQL `INSERT` all triples from `project/{id}/graph` into `main` graph
  2. Mint global PIDs for new entities (call `kg_engine/uris.py`)
  3. Write `MergeActivity` triple (prov provenance chain) to outbox
  4. Freeze project snapshot: create `ProjectSnapshot` record + export project graph TTL to `media/snapshots/{project_id}.ttl`
  5. Update `MergeRequest.status = "merged"`, save `merge_activity_uri`
- `apps/heritage_data/views.py` — `MergeRequestViewSet.approve()` triggers `execute_merge()` after permission check

---

## Phase 10 — LOD Publication

### 10-A Nanopublication export management command `[PARTIAL]`

`apps/graph/management/commands/kg_export_nanopubs.py` exists.

**What's missing:** Auto-run after every merge. Add a `post_save` signal on `ProjectSnapshot` that enqueues a Celery task:
- `apps/graph/tasks.py` — `@shared_task def export_nanopubs_for_merge(merge_request_id)`

---

### 10-B VoID / DCAT regeneration `[PARTIAL]`

`ontology/lod/void-dataset.ttl` is static. It must be regenerated with live triple counts after each merge.

**Files to create:**
- `apps/graph/kg_engine/void_generator.py` — `generate_void_dcat() -> str` — SPARQL `SELECT (COUNT(*) AS ?triples)` + template rendering to TTL
- `apps/graph/management/commands/regen_void.py` — `python manage.py regen_void` writes to `ontology/lod/void-dataset.ttl`
- Called from Celery task `export_nanopubs_for_merge` after nanopub export

---

### 10-C SKOS vocabulary generation `[PARTIAL]`

`ontology/lod/skos-vocabularies.ttl` exists (static). Add a generator that reads `HeritageGraph.yaml` enums and regenerates it:
- `tools/generate_skos.py` — reads `ontology/HeritageGraph.yaml`, emits `skos:ConceptScheme` per enum with `skos:exactMatch`/`broadMatch` from `exact_mappings`/`broad_mappings` fields
- Add to `Makefile` as `make skos` target

---

## Phase 11 — Access & Discovery

### 11-A Dereferenceable URIs / content negotiation `[PARTIAL]`

`apps/graph/lod_views.py` exists.

**What's missing:** Content negotiation on `Accept` header to return TTL vs JSON-LD vs HTML.

**Files to modify:**
- `apps/graph/lod_views.py` — in the entity detail view, inspect `request.META.get("HTTP_ACCEPT")` and return:
  - `text/turtle` → serialize with `rdflib` from Oxigraph DESCRIBE query
  - `application/ld+json` → JSON-LD via `rdflib.plugin`
  - `text/html` → redirect to frontend entity page

---

### 11-B CARE enforcement at SPARQL query time `[TODO]`

**What:** Requests to the SPARQL endpoint must not return `access_tier=sensitive_indigenous` or `community_only` triples for unauthenticated/unauthorized callers.

**Files to create:**
- `apps/graph/sparql_proxy.py` — `ProxySPARQLView` that:
  1. Parses the SPARQL query
  2. Injects `FILTER NOT EXISTS { ?s hg:access_tier "sensitive_indigenous" }` clauses for anonymous requests
  3. Forwards to Oxigraph HTTP endpoint
- `heritage_graph/urls.py` — replace direct Oxigraph proxy route with `ProxySPARQLView`

**Tool:** `SPARQLWrapper` or raw `requests` to forward to `http://oxigraph:7878/query`.

---

### 11-C schema.org JSON-LD + sitemaps `[TODO]`

**Files to create:**
- `apps/graph/schema_org.py` — `entity_to_schema_org(entity_uri) -> dict` — maps CIDOC-CRM types to `schema:Place`, `schema:Event`, `schema:Person` etc.
- `apps/graph/views.py` — `SitemapView` at `/sitemap.xml` — paginated list of all public entity URIs
- Frontend: embed `<script type="application/ld+json">` in entity HTML pages (`heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/[id]/page.tsx`)

---

### 11-D DataCite DOI minting `[TODO]`

**Files to create:**
- `apps/graph/datacite.py` — `mint_doi(project_snapshot) -> str` — POST to DataCite REST API (`api.datacite.org/dois`) with title, creator, publisher, resourceType from project metadata
- Called from `execute_merge()` (Phase 9-A) after freeze
- Store DOI in `ProjectSnapshot.doi = models.CharField(max_length=64, blank=True)`

**Tool:** `requests` + DataCite API key from `os.environ.get("DATACITE_API_KEY")`.

---

## Phase 12 — Maintenance Loop

### 12-A Supersession (nanopub retraction) `[PARTIAL]`

`HeritageAssertion.supersedes_assertion` FK exists. Wire the retraction nanopub:

**Files to modify:**
- `apps/graph/kg_engine/nanopub_export.py` — `nanopub_retraction_trig(old_assertion, new_assertion)` — emits `npx:supersedes` triple in pubinfo graph
- Call from `apps/cidoc_data/rdf_signals.py` when `supersedes_assertion` is set on save

---

### 12-B Re-reconciliation Celery beat task `[TODO]`

**Files to create:**
- `apps/graph/tasks.py` — `@shared_task def rereconcile_all_entities()` — iterates all entities, re-checks `skos:exactMatch` links via Getty/Wikidata, flags stale ones in a `ReconciledLink.is_stale` boolean field
- `heritage_graph/settings/base.py` — add to `CELERY_BEAT_SCHEDULE`:
  ```python
  "rereconcile-weekly": {
      "task": "apps.graph.tasks.rereconcile_all_entities",
      "schedule": crontab(day_of_week=0, hour=2),
  }
  ```

---

## Milestones

### Milestone 1 — Provenance Hardening (1–2 weeks)
- [ ] 0-A: ORCID linking (backend + frontend button)
- [ ] 1-A: Project PID minting on creation
- [ ] 1-B: Project named graph isolation wired to assertions
- [ ] 2-A: DataSource type classification + DataCite fields

### Milestone 2 — Contribution Loop Closure (2–3 weeks)
- [ ] 3-B: Multi-calendar TimeSpan (backend dataclass + frontend picker)
- [ ] 7-A: MergeRequest model + ViewSet + permissions
- [ ] 7-B: Pre-flight conflict diff
- [ ] 7-C: MergeRequest frontend page
- [ ] 4-A: SHACL validation gating MergeRequest open

### Milestone 3 — Review & Merge (1–2 weeks)
- [ ] 8-A: RDF-star diff view for reviewers
- [ ] 8-B: Verification activity recording
- [ ] 9-A: Merge execution (triples → main graph + PID mint + snapshot freeze)
- [ ] 4-B: DL reasoning consistency check (optional gate on merge)

### Milestone 4 — LOD Pipeline (1–2 weeks)
- [ ] 10-A: Auto-nanopub export after merge (Celery task)
- [ ] 10-B: VoID/DCAT regeneration after merge
- [ ] 10-C: SKOS vocabulary generator (`make skos`)
- [ ] 12-A: Supersession retraction nanopub

### Milestone 5 — Discovery & Access (1–2 weeks)
- [ ] 11-A: Content negotiation on dereferenceable URIs
- [ ] 11-B: CARE-aware SPARQL proxy
- [ ] 11-C: schema.org JSON-LD + sitemaps
- [ ] 11-D: DataCite DOI minting

### Milestone 6 — Maintenance & Evaluation (1 week)
- [ ] 12-B: Weekly re-reconciliation Celery beat task
- [ ] 5-A: Bulk reconciliation wired to entity save
- [ ] 5-B: Duplicate detection warning on assertion create
- [ ] 6-A: Assertion history view (project "commit log")

---

## Paper-critical evaluation hooks (non-negotiable before npj HS submission)

These are separate from the feature milestones but must be tracked alongside them.

| Eval | Script location | Data needed |
|------|----------------|-------------|
| SHACL conformance rate per shape | `evaluation/shacl_conformance.py` | Run `shacl_validate` over all project graphs |
| Getty AAT/TGN alignment F1 | `evaluation/alignment_f1.py` | 200-entity adjudicated gold set in `evaluation/gold/` |
| Reasoner novelty rate | `evaluation/reasoner_novelty.py` | HermiT output vs RDFS closure |
| Cohen's κ on review decisions | `evaluation/reviewer_kappa.py` | 50–100 real MergeRequest decisions (requires Milestone 2 first) |

Pre-register methodology in `evaluation/PROTOCOL.md` before running any eval.

---

## Tech reference card

| Need | Use |
|------|-----|
| Background jobs (reconciliation, nanopub export) | Celery (`heritage_graph/celery_app.py`) |
| RDF graph queries | `apps/graph/kg_engine/store.py` (Oxigraph HTTP) |
| SHACL validation | `pyshacl` (add to `requirements.txt`) |
| DL reasoning | `hermit.jar` via `subprocess.run` or `owlready2` |
| SPARQL federation | `SPARQLWrapper` |
| DataCite DOI | `requests` + `DATACITE_API_KEY` env var |
| ORCID OAuth | `requests` (manual code exchange) |
| Content negotiation | `rdflib` for serialization |
| Frontend data fetching | `useSession()` + `fetch(NEXT_PUBLIC_API_URL, {Authorization: Bearer})` |
| New shadcn components | `npx shadcn@latest add <component>` |
