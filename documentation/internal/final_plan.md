# HeritageGraph — Final Plan (v1)

> Owner: Nabin (CAIR-Nepal) · Branch: `v1` · Date: 2026-05-14
> Scope: project-based contribution, schema-driven UI, graph-DB write-through, OCR ingestion, domain-expert workflow.
> Audience: implementer (you + Claude Code). Methodology paper companion: see `NPJ_HS_PAPER_PLAN.md`.

---

## 0. Guiding principles

1. **One source of truth.** `ontology/HeritageGraph.yaml` (LinkML) plus three thin overlays in `tools/` describe *everything* the user-facing app can do. No hand-written class names, slot names, or form fields anywhere downstream.
2. **Schema-driven, not schema-aware.** Code reads the *generated registry snapshot*, never imports class names. Adding a new class to the YAML and running `make generate` must be sufficient to make a new form, API surface, RDF projection, and contribute-hub tile appear.
3. **Triplestore is a projection, not the system of record.** Postgres stays authoritative. pyoxigraph receives an idempotent write-through on save/delete. Loss of the store is recoverable by replaying signals.
4. **Contribution is project-scoped.** A "project" is the unit a contributor sees, comments on, forks, revises, and gets reviewed against. Individual entities/assertions live *inside* a project.
5. **Every step is reproducible.** `make generate`, `make schema-rebuild`, `make rdf-rebuild`, `make ingest`, `make contribute-routes-check` regenerate or verify the entire chain from the YAML.

Non-goals for v1: real-time multi-user editing, federated SPARQL across remote endpoints, mobile app, public anonymous contribution.

---

## 1. LinkML as the source of truth — what already exists and what to harden

### 1.1 Current pipeline (verified)

```
ontology/HeritageGraph.yaml            ← LinkML schema (2157 lines, authoritative)
tools/ui-classmap.yaml                 ← UI ↔ class binding (slug, route key, hub category)
tools/ui-presentation.yaml             ← per-slot widget hints, ordering, visibility
tools/contribute-hub.yaml              ← contribute landing page (categories, intents, copy)
tools/semantic-patterns.yaml           ← multi-class workflows (e.g. "document a ritual end-to-end")
        │
        ▼  python3 tools/linkml_generate_registry.py
heritage_graph_ui/src/lib/ontology/registry.generated.{json,ts}
        │
        ▼  python3 tools/generate_serializers.py
heritage_graph/apps/cidoc_data/serializers.generated.py
        │
        ▼  python3 tools/generate_relation_backrefs.py
heritage_graph/apps/cidoc_data/relation_backrefs.py
        │
        ▼  python3 tools/emit_minimal_shacl.py
ontology/shapes/generated-heritagegraph-minimal-shacl.ttl
        │
        ▼  manage.py schema_rebuild
SchemaRegistry rows in Postgres (runtime fallback when registry JSON is unavailable)
```

All four are tied together by `make generate` and gated in CI by `make check` (ontology-check, serializers-check, entityrefs-check, contribute-routes-check).

### 1.2 What to harden (LinkML hygiene — the hallucination tax)

LLMs reliably mis-generate LinkML. We pay this once, then never again:

- **Lock the LinkML version.** Pin `linkml`, `linkml-runtime`, `linkml-model` in `requirements.txt` with hashes. Add `python3 -c "import linkml; print(linkml.__version__)"` to `make check`.
- **Validate the YAML before any generator runs.** Add `make ontology-validate` that calls `linkml-validate -s ontology/HeritageGraph.yaml --strict`. Wire it as the first step of `make generate` and as a pre-commit hook.
- **Forbid hand-edits to generated files.** All `*.generated.{py,ts,json,ttl}` files get a header banner *and* a CI check that compares re-generation diff to zero. Already exists for some; extend.
- **Slot/class diff gate on PRs.** `tools/schema_diff.py OLD=main NEW=HEAD` already exists. Wire into PR template: every YAML change must paste the diff. Breaking changes (removed slot, narrowed range) require a migration note in the same PR.
- **Round-trip test.** New CI job: load YAML → generate registry → load registry → reconstruct minimal YAML → diff against canonical normalized form. Catches drift between generator and schema before it hits production.
- **Single LinkML loader.** `apps/cidoc_data/linkml_loader.py` is already the only place that touches LinkML APIs at runtime; keep it that way. Everywhere else reads the registry snapshot.

### 1.3 Evolution discipline

Schema *will* change. The platform survives if and only if:

- **Slots are additive by default.** New slot → defaults to optional → existing data passes validation. Captured in the `tools/schema_diff.py` policy.
- **Renames are two-step.** Add new slot → backfill → mark old slot deprecated for two releases → drop. Drives a "deprecation" field in the registry that the UI reads to grey out fields.
- **Class deletions go through `SchemaExtensionProposal`.** That model exists already (`heritage_data/models.py:1389`). Use it as the gate for breaking ontology changes — domain experts approve, generator runs, audit event recorded.
- **Versioned registry.** Stamp every `registry.generated.json` with the git SHA of the YAML it was built from. Persist the SHA on every `CulturalEntity.schema_version` (new field) so we can tell which generation of the ontology a record was authored under, and surface stale-shape warnings during revise.

---

## 2. Graph database — pyoxigraph write-through projection

### 2.1 What is already wired

- `apps/graph/oxigraph/client_oxigraph.py` — `OxigraphClient` for SPARQL over HTTP *or* embedded `pyoxigraph.Store`.
- `apps/cidoc_data/rdf_signals.py` — `post_save`/`post_delete` receivers project CIDOC-mapped Django instances into RDF triples via `apps/cidoc_data/rdf_entity_projection.py`.
- Local fallback store at `oxigraph_db/` (`OXIGRAPH_STORE_PATH` setting). When `RDF_ENDPOINT_URL` is empty but `RDF_SYNC_ENABLED=True`, pyoxigraph writes locally — perfect for dev and single-node prod.
- SPARQL read path: `apps/cidoc_data/views.py` exposes a SPARQL endpoint that queries the local store; response header `X-HG-SPARQL-Source: local-oxigraph` distinguishes it from a remote Fuseki.
- `manage.py oxigraph_seed_schema` seeds the schema triples (T-Box) from the YAML.
- `manage.py oxigraph_verify` smoke-tests the store.

The other graph-DB code in the repo (Fuseki compose file, Jena loader scraps) is **ignored** as the user requested.

### 2.2 What to add — making the projection trustworthy

The current projection is best-effort. For paper-grade reliability and federation we need:

1. **Atomic Postgres + RDF write.** Today, `post_save` projection runs after the transaction. If the projection fails, Postgres has data the RDF store doesn't. Fix: wrap projection in `transaction.on_commit(...)` (already partial in `rdf_signals.py`) **and** enqueue a row in a new `RDFSyncOutbox` table when projection fails. A management command `rdf_resync` drains the outbox. This is the standard outbox pattern and is enough — we don't need Kafka.
2. **Idempotent projection key.** Every triple carries `?s ?p ?o` plus a named graph `urn:hg:entity:<uuid>`. Delete-then-insert per named graph is already how `_local_replace_slot_projection` works; extend that to *all* projected entities so re-running the projection is safe.
3. **Full-rebuild command.** `make rdf-rebuild` iterates every projected model, calls the projection function, and replaces the named graph. ~minutes for v1 dataset sizes; this is our disaster-recovery story.
4. **SHACL gate on writes.** When `SHACL_VALIDATE_ON_WRITE=True`, run `apps/cidoc_data/shacl_validate.py` against the generated `ontology/shapes/generated-heritagegraph-minimal-shacl.ttl` over the projected named graph *before* commit. Violations either reject the save (strict mode) or attach a `ReviewFlag` (soft mode). v1 default: soft.
5. **Provenance triples.** Every projected entity also emits `prov:wasGeneratedBy` linking to the originating `Revision`, `Submission`, or `UploadedDocument` URI. This is the federation hook the paper needs.
6. **SPARQL surface.** Expose a small set of named, cached SPARQL queries (server-side) plus an open `/sparql/` for read. Don't expose SPARQL UPDATE.
7. **Backups.** `oxigraph_db/` goes in nightly backup. Since Postgres is authoritative, this is a convenience snapshot, not a recovery target.

### 2.3 Acceptance test

`make rdf-rebuild && make rdf-verify` on a fresh checkout produces a store whose CONSTRUCT-against-every-class returns the same triples as a freshly-projected store from live Postgres. Diff is empty.

---

## 3. Project-based contribution — the headline UX change

The current contribute flow drops the user directly onto a per-class form. We change the unit of contribution from "one entity" to "one project."

### 3.1 Concept

> **Project** = a contributor's working dossier on a single heritage subject. It holds the user's uploads, drafts, semantic graph fragment, OCR runs, comments, and review state. It is forkable. Merging a project promotes its entities into the public graph.

A project is *not* a new ontology class. It is an authoring/governance container that **references** ontology instances created inside it.

### 3.2 New Django models (in `apps/heritage_data/`)

```python
# Pseudocode — full fields decided at implementation time.

class Project(models.Model):
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    slug = SlugField(unique=True)
    title = CharField(max_length=200)
    abstract = TextField(blank=True)
    owner = ForeignKey(User, on_delete=PROTECT, related_name="owned_projects")
    collaborators = ManyToManyField(User, through="ProjectMembership", related_name="projects")
    visibility = CharField(choices=["private","org","public"], default="private")
    state = CharField(choices=[
        "draft", "in_review", "needs_revision",
        "approved", "merged", "withdrawn",
    ], default="draft")
    forked_from = ForeignKey("self", null=True, blank=True, on_delete=SET_NULL, related_name="forks")
    schema_version = CharField(max_length=40)  # YAML SHA at project start
    created_at, updated_at = ...

class ProjectAsset(models.Model):
    """Raw user upload: image, audio, video, doc, csv. Pre-OCR/pre-clip."""
    project = ForeignKey(Project, on_delete=CASCADE, related_name="assets")
    media = ForeignKey(Media, on_delete=PROTECT)
    role = CharField(choices=["evidence","primary","reference"], default="evidence")
    uploaded_by = ForeignKey(User, on_delete=PROTECT)

class ProjectMembership(models.Model):
    project, user, role  # role in {owner, editor, viewer, domain_expert}

class ProjectEntity(models.Model):
    """Links an ontology-instance (CulturalEntity / Iconography / etc.) to a project."""
    project = ForeignKey(Project, on_delete=CASCADE, related_name="entities")
    entity = ForeignKey(CulturalEntity, on_delete=CASCADE)
    role_in_project = CharField(blank=True)  # free-text, e.g. "subject", "context"
    added_by, added_at = ...

class ProjectActivity(models.Model):
    """Lightweight audit log scoped to the project."""
    project, actor, action, target_kind, target_id, payload, at = ...
```

Existing `Fork`, `Revision`, `Comments`, `ReviewDecision`, `ReviewFlag` models attach to `Project` via a generic relation or explicit FK — pick explicit FK for queryability.

### 3.3 Contributor journey (the screen-by-screen flow)

1. **`/contribute` → "New Project"** button.
2. **Project shell** (`/contribute/projects/<slug>/`):
   - Step 1 — Identify: title, abstract, language(s), intended subject ("a temple / a ritual / a person …" picker → pre-selects relevant ontology classes for later).
   - Step 2 — Upload evidence: drag-and-drop multi-file (images, audio, video, PDFs, CSVs). Each upload becomes a `ProjectAsset` + `Media` row. OCR triggers automatically for PDFs/images of documents; classifier (`document_processing.services.classifier`) decides which engine.
   - Step 3 — Author entities: the existing schema-driven semantic forms (section 4), but now bound to the project. Every entity created here is a `ProjectEntity`.
   - Step 4 — Graph view: drag-and-arrow canvas (section 5) over the project's entities.
   - Step 5 — Asset annotation: crop/clip and label media (section 6).
   - Step 6 — Review: contributor flips state `draft` → `in_review`. Review pipeline (section 11) takes over.

The Step 1–6 ordering is **non-blocking** — contributors can revisit any step. State is autosaved (Postgres draft, no localStorage authoritative).

### 3.4 What "merge" means

Merging a project (`approved` → `merged`):

- Project's `ProjectEntity` rows are promoted: their `CulturalEntity` records flip a `published=True` flag, and the RDF projection moves them from a `urn:hg:project:<id>` named graph into the canonical `urn:hg:public` graph.
- Cross-project entity collisions (same subject already exists) are resolved via the existing `IdentityResolutionCandidate` flow (`apps/cidoc_data/identity_services.py`).
- A `Revision` is recorded for every promoted entity. Existing fork/diff machinery applies.

---

## 4. Production-grade schema-driven forms

Today: `ContributeOntologyForm` reads `ontologyKey` → registry → renders. This is the right shape; it just needs hardening.

### 4.1 Stability against ontology change

The contributor mid-draft must not be wedged if the ontology changes underneath them.

- **Drafts pin the schema version.** A draft stores `{schema_version: <yaml SHA>, payload: <fields-as-saved>}`. When loaded, the UI fetches the registry *at that SHA* (we keep historical registry snapshots — one file per schema version in `heritage_graph_ui/src/lib/ontology/history/`) so the form renders consistently.
- **On resume after a schema change**, show a diff banner: "3 new optional fields available · 1 field renamed (auto-mapped) · 0 fields removed." User can keep going or migrate.
- **Server-side, never trust slot names from the client.** Serializers (`serializers.generated.py`) define the canonical set; unknown keys are dropped with a logged warning.
- **Graceful unknown classes.** If a `ProjectEntity` references a class no longer in the ontology, the UI renders read-only with a "deprecated class" banner — already half-implemented in `OntologyUnavailablePanel`.

### 4.2 Form quality (the "production-grade" part)

- **Widget table is data, not code.** `tools/ui-presentation.yaml` maps `(class, slot) → widget` (text, textarea, date, edtf-date, geopoint, deity-picker, person-picker, …). Adding a new widget kind is a YAML entry plus a React component registered in `src/components/ontology/widgets/`. The generator validates the mapping; CI fails if a slot has no widget.
- **Required-fields are computed from LinkML, not hand-listed.** `slot.required: true` in YAML → required in form, in serializer, in SHACL.
- **Cross-field validation** is encoded as LinkML `rules:` or SHACL shapes — *not* JS. The form calls a `POST /api/cidoc/validate-draft/` endpoint that runs the same SHACL the backend uses on save. One source of truth for validity.
- **Inline help is content, not chrome.** Each slot gets a `description:` and optional `examples:` in YAML. The form surfaces both. Domain experts edit YAML descriptions in a dedicated PR template, not in Figma.
- **Per-class wizards via `semantic-patterns.yaml`.** Today this drives multi-class workflows (e.g., "ritual + festival + location"). Extend so each pattern declares ordered steps; the form remembers which step you're on across reloads. The `parseSemanticWorkflowParams` helper in `lib/semantic-workflow-params.ts` is already the right plumbing.
- **Autocomplete against the graph.** Person/place/deity slots query a typed-ahead endpoint (`/api/cidoc/lookup/?class=Person&q=...`) that hits Postgres first and falls back to a cached SPARQL query against the local Oxigraph. Already partially built as `entity-search.tsx`.
- **Test the form like an API.** A new `tools/form_smoketest.py` walks every class in the registry, builds a synthetic minimal valid payload from LinkML defaults, POSTs to the corresponding API, asserts 201. Gate in CI.

### 4.3 Context-sensitive relevant elements

The user asks: "make sure relevant elements pop up when the user fills required information."

Mechanism: **slot-driven follow-ups, declared in YAML.**

```yaml
# In ontology/HeritageGraph.yaml — already supported by LinkML rules.
classes:
  Ritual:
    slots: [name, deity_invoked, performed_at, performers, ...]
    rules:
      - preconditions:
          slot_conditions:
            deity_invoked: {value_presence: PRESENT}
        postconditions:
          # UI overlay: show optional deity-iconography linker
          slot_conditions:
            related_iconography: {recommended: true}
```

The registry generator (`tools/linkml_generate_registry.py`) compiles `rules` into a `followUps` array per class. The form watches the current payload and, when a precondition is satisfied, surfaces the suggested slot or a quick-link card ("Add an Iconography for the deity you mentioned"). No special-case code per class.

Three follow-up kinds:

1. **Reveal a hidden slot** on the same form.
2. **Suggest creating a related entity** (opens a side-drawer mini-form for that class).
3. **Suggest a semantic-pattern jump** (e.g., from `Festival` → guided `Ritual` capture).

All three are configured in YAML/registry. Zero hardcoded class names in the React layer.

---

## 5. Graphical contribution — drag-and-arrow canvas

A node-and-edge canvas scoped to the project.

### 5.1 Scope (v1)

- Nodes = `ProjectEntity` instances (typed by ontology class, colored by hub category).
- Edges = ontology-valid relationships. The set of allowed edge types between two node classes is read from the registry (LinkML `slot.range` + inverse-of metadata).
- Operations: create node (pick class → opens mini-form), drag from node A's edge handle to node B → menu of valid predicates → pick → edge created. Delete, undo, autosave.
- Layout: force-directed initial, manual positions saved to `Project.canvas_state` (JSONField).

### 5.2 Tech choice

`reactflow` (already in the broader ecosystem; we'll pin the version). Custom node types per hub category. Edge-validity uses the same registry the forms use — so a relationship the form rejects, the canvas also rejects.

### 5.3 Bi-directional sync with forms

- Creating a node on the canvas writes the same `CulturalEntity` + `ProjectEntity` rows the form would. The mini-form is a *subset* of the full form (required slots only); user clicks "Open full form" to add the rest.
- Saving a form updates the canvas in place.
- Creating an edge writes a CIDOC relationship via the existing assertion API (`apps/cidoc_data/views.py` `HeritageAssertion` endpoints).

### 5.4 Acceptance

A new contributor can, without touching a single form-mode UI, build a 5-node, 4-edge graph for a small monument, and the resulting `manage.py dumpdata cidoc_data` shows the same row-set the form path would produce.

---

## 6. Media micro-contribution — crop image, clip audio, label, attach metadata

Cultural-heritage value lives in the *details* of an image or recording. We make those details first-class.

### 6.1 Model

```python
class MediaRegion(models.Model):
    """A labeled fragment of a Media asset."""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    media = ForeignKey(Media, on_delete=CASCADE, related_name="regions")
    project = ForeignKey(Project, on_delete=CASCADE, related_name="regions")

    kind = CharField(choices=["image_bbox","image_polygon","audio_clip","video_clip"])
    spec = JSONField()
    # image_bbox: {x,y,w,h}  (normalized 0..1)
    # image_polygon: {points: [[x,y], ...]}
    # audio_clip/video_clip: {start_ms, end_ms}

    label = CharField(max_length=200, blank=True)
    description = TextField(blank=True)

    # The ontology-grounded link: this region depicts/contains/refers-to a CulturalEntity.
    depicts = ForeignKey(CulturalEntity, null=True, blank=True, on_delete=SET_NULL,
                         related_name="depicted_in_regions")
    annotation_predicate = CharField(blank=True)  # e.g. "crm:P138_represents"

    created_by, created_at, updated_at = ...
```

This is essentially the W3C Web Annotation Data Model, narrowed. `spec` is intentionally JSON, not separate columns, so a new region kind (e.g., 3D bbox for photogrammetry later) doesn't require a migration.

### 6.2 UI

- **Image annotator** — wrap an existing library (`react-image-annotate` or roll a thin canvas wrapper; the latter is easier to keep aligned with our design system). For Patan-style detail labeling: zoom, pan, free polygon, snap-to-grid optional. Each region gets a sidebar with: label, description, `depicts` (entity-search.tsx already exists), metadata blob.
- **Audio clipper** — wavesurfer.js. Two-handle range slider, scrub-with-keyboard, optional waveform-on-spectrogram toggle. Each clip → `MediaRegion(kind="audio_clip")`.
- **Video clipper** — same shape as audio, video.js timeline. v1 nice-to-have, not required.

### 6.3 Why this is worth doing properly

The example use case the user gave ("label a shivlinga inside a Patan image, tie it to its story and kings") is exactly the kind of dense annotation that distinguishes a heritage-grade dataset from a Flickr dump. Modeling regions as first-class avoids the worst antipattern: putting `bbox` in a JSON blob on `Submission` and never being able to query it.

### 6.4 RDF projection

Each `MediaRegion` projects as:

```
<region_uri> a oa:Annotation ;
  oa:hasBody <entity_uri> ;
  oa:hasTarget [ oa:hasSource <media_uri> ;
                 oa:hasSelector [ a oa:FragmentSelector ;
                                  rdf:value "xywh=percent:..." ] ] ;
  crm:P138_represents <entity_uri> ;
  prov:wasGeneratedBy <revision_uri> .
```

`oa:Annotation` lets SPARQL queries like "every iconographic element depicting Bhairava in any image" Just Work.

---

## 7. Reproducibility — Make targets and CI

Every flow above is reproducible from the command line. Target set:

```
make ontology              # regenerate registry from YAML
make ontology-validate     # linkml-validate --strict (new)
make ontology-check        # CI: registry up to date
make serializers           # regenerate DRF serializers
make serializers-check     # CI: serializers up to date
make shacl                 # regenerate SHACL shapes (new — wraps emit_minimal_shacl)
make schema-rebuild        # persist registry to SchemaRegistry
make rdf-rebuild           # NEW: full re-projection of Postgres → pyoxigraph
make rdf-verify            # NEW: CONSTRUCT-diff vs fresh projection
make rdf-resync            # NEW: drain RDFSyncOutbox
make ingest FILE=path      # NEW: run document_processing pipeline on a file
make form-smoketest        # NEW: synthesize-and-post a payload for every class
make generate              # ontology → serializers → entityrefs → schema-rebuild → shacl
make check                 # all *-check gates
```

CI workflow (GitHub Actions):

1. `make ontology-validate` — fail fast on bad LinkML.
2. `make check` — generated files must be committed.
3. `make form-smoketest` — every class round-trips.
4. SHACL conformance over a fixture dataset.
5. `make rdf-verify` against a fixture.

This is enough to detect every category of regression we've seen so far.

---

## 8. Document OCR & ingestion

The pipeline already exists in `apps/document_processing/services/` (`classifier → pdf | raster_ocr | htr | vision_rescue → ner → ingestion_compile → persistence → form_mapping`). The plan is to *wire it into the project flow*, not to rebuild it.

### 8.1 Ingestion-to-form bridge

When a contributor uploads a PDF/image as a `ProjectAsset`:

1. `UploadedDocument` row created; classifier picks engine.
2. Pipeline runs async (Celery task already stubbed in `tasks.py` — finish it or, if Celery is overkill for v1, use Django-Q or a simple management-command worker; pick once and document).
3. `ExtractedField` rows are mapped through `services/form_mapping.py` (already exists) into a *draft pre-filled form payload*, attached to the project as a "suggestion."
4. The contributor sees: "We read this document and pre-filled these 7 fields. Accept / edit / discard each." → backed by the existing `ingestion_review_state` JSON on `UploadedDocument`.

The point: OCR never auto-publishes. It produces *suggestions* that a human accepts.

### 8.2 Quality knobs to tune

- **Classifier confidence threshold** to invoke `vision_rescue` (Claude Vision). Track `claude_vision_invocations` (already a field) → cost dashboard.
- **NER model selection** — keep configurable per-language; default `en` + `ne` (Devanagari). Document the model in `documentation/pipelines/OCR.md`.
- **Tabular ingestion** (`tabular_parse.py`) for CSVs of inventory data — also produces field suggestions, not direct writes.
- **Provenance from the upload step.** `UploadedDocument.provenance` (already exists) captures source institution, collection, languages, contributor note. This flows into `prov:wasGeneratedBy` triples on every entity later created from that doc.

### 8.3 What to add

- **Per-page region picker.** Today's pipeline produces `DocumentPage` + `OCRResult`. Add a UI to draw a region on a page → either re-OCR with a different engine or attach the region as a `MediaRegion` linked to an entity. Bridges OCR with section 6.
- **Domain-expert correction loop.** A reviewer can edit raw OCR text *in place* (page-by-page). Edits are versioned (`OCRResult` already supports multiple engines; add a `manual_correction` engine code). Used to bootstrap a fine-tune corpus.
- **Bulk ingestion harness.** `make ingest DIR=...` for cataloging existing collections (e.g., institutional handovers).

---

## 9. Domain-expert role and workflow

The platform must be useful to a domain expert who is *not* a curator and not a tech user. Three jobs:

1. **Authoritative review.** Approve/reject a project's claims with comments at the level of an individual `HeritageAssertion`.
2. **Schema stewardship.** Propose ontology extensions (slots, classes, controlled vocabularies) via `SchemaExtensionProposal` (model exists). Lightweight web UI to do this without writing YAML; output is a *suggested YAML diff* a maintainer commits.
3. **Curatorial commentary.** Long-form annotations on entities that aren't structured data — historical context, contested attributions, references.

### 9.1 Reviewer-side affordances

- **Side-by-side compare.** When reviewing a forked/revised entity, show original vs. proposed with field-level highlight. `Revision` model already supports this; we need the React component.
- **Inline assertion-level comments.** `Comments` model exists with a `target` generic relation; extend the front-end to surface comment threads under each form section *and* on edges of the graph canvas.
- **Decision actions:** approve, request-changes (with required comment), reject (with required reason linked to `ReviewFlag` taxonomy).
- **Workload queue.** `/review` dashboard, already scaffolded; expose filters by domain (use `Project.tags` / ontology category) and by reviewer specialty (new field on `UserProfile.expert_domains: ArrayField`).
- **Identity-resolution panel.** The `IdentityResolutionCandidate` flow is the domain expert's most leveraged action — they're best placed to say "this 'Kumari' and that 'Kumari Devi' are the same person." Surface it prominently.

### 9.2 Recognition

Reviews are first-class contributions. `UserStats` (exists) tracks them; surface on profile. This matters for paper authorship arguments later and for sustaining unpaid expert volunteers.

---

## 10. Wiring into existing comments, view reports, revise, fork

These all exist. The plan is to **scope them to projects** and to **attach them to ontology-grounded targets**.

### 10.1 Comments

- `Comments` model gets a clear `target` (project, entity, assertion, region, page). One thread per target, replies threaded. Reactions via existing `Reaction` model.
- The contribute form has a per-section "Discuss" affordance that opens the relevant thread. Same on the canvas, same on a `MediaRegion`.
- Notifications via existing `Notification` model. Default rule: any comment on a project notifies owner + active collaborators + assigned reviewer.

### 10.2 View report (ReviewFlag)

- "View report" affordance on any public entity → opens `ReviewFlag` form. Taxonomy lives in YAML (controlled vocabulary class in LinkML). When flagged, the entity surfaces a contested badge on every page that renders it.
- Domain experts triage. `TriagePolicy` model (exists) drives auto-routing.

### 10.3 Revise

- "Revise this entity" → creates a `Revision` *inside the user's current project* (or prompts to create a project). Original is unchanged until merge.
- The diff view (section 9.1) is the review UI for revisions.

### 10.4 Fork

- "Fork this project" → deep-copies `Project`, `ProjectEntity` rows, `MediaRegion` rows. `Project.forked_from` is set. Assets are *referenced*, not copied (the underlying `Media` rows are immutable).
- A fork can be opened as a "PR" against the source project — same model and UI as a review.

---

## 11. Phasing and acceptance

### Phase A — Foundations (2–3 weeks)

- [ ] LinkML hygiene (1.2): pinned version, `make ontology-validate`, round-trip test, generated-file ban.
- [ ] `RDFSyncOutbox`, `make rdf-rebuild`, `make rdf-verify` (2.2 items 1–3, 7).
- [ ] Schema-version pin on drafts (4.1 item 1) — historical registry snapshots.
- [ ] `make form-smoketest` (4.2 final item).

**Exit criterion:** `make generate && make check && make rdf-verify && make form-smoketest` is green on a fresh checkout.

### Phase B — Project shell (2–3 weeks)

- [ ] `Project`, `ProjectAsset`, `ProjectMembership`, `ProjectEntity`, `ProjectActivity` models + migrations.
- [ ] New `/contribute/projects/...` routes; existing per-class forms reachable from inside a project.
- [ ] Project state machine (`draft` → … → `merged`) hooked to existing `ReviewDecision`.
- [ ] Notifications and comments scoped to projects (10.1).

**Exit criterion:** A contributor can spin up a project, upload a PDF, accept pre-filled fields, save an entity, request review, and see the reviewer's diff comments.

### Phase C — Media regions and canvas (3–4 weeks)

- [ ] `MediaRegion` model + RDF projection (6.1, 6.4).
- [ ] Image annotator UI; audio clipper UI (6.2).
- [ ] Drag-and-arrow canvas (section 5), with bi-directional sync to forms.
- [ ] `oa:Annotation` triples in pyoxigraph; SPARQL examples in `FUSEKI.md`.

**Exit criterion:** The "Patan shivlinga" example walkthrough is reproducible end-to-end and ships as a fixture.

### Phase D — Domain expert and OCR polish (2–3 weeks)

- [ ] Inline assertion-level comments.
- [ ] Side-by-side revision compare UI.
- [ ] Per-page region picker and manual OCR correction (8.3).
- [ ] Expert-domain tagging on `UserProfile` + queue filters.

**Exit criterion:** A domain expert reviews 10 fixture projects, all approvals/rejections recorded, no schema drift in `rdf-verify`.

### Phase E — Hardening (parallel, ongoing)

- [ ] Performance: cached SPARQL queries; pagination on entity-search; bounded canvas size.
- [ ] Security review (the project surface is a new attack surface: stored XSS in labels/descriptions, IDOR on `ProjectAsset` access, signed-URL leak through public RDF).
- [ ] Backups and DR runbook.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| LinkML generator drifts from runtime behavior | Round-trip CI test (1.2). |
| RDF projection silently loses data on signal failure | Outbox + `rdf-resync` + nightly `rdf-verify` (2.2). |
| Schema evolution breaks in-flight drafts | Schema-version pin + historical registry snapshots (4.1). |
| Free-form labels in `MediaRegion` and project titles become an XSS vector | Server-side sanitization + CSP. |
| pyoxigraph store grows unbounded on a single node | v1 dataset is small (<10M triples expected); revisit at 50M with either Oxigraph server mode or a Fuseki sidecar. Don't optimize before measuring. |
| Domain experts won't use the platform if it feels like data entry | Keep the curatorial-commentary path (9, item 3) first-class. Reviews count as contributions in stats. |
| Vision-rescue cost runs away | Cap `claude_vision_invocations` per document; require contributor confirmation for the second invocation. |
| Drag-and-arrow canvas becomes a maintenance sink | Treat reactflow as a thin layer; persist canvas state as JSON; the canvas reads/writes the same models as the forms — never a parallel store. |

---

## 13. Open decisions

These need a call before Phase B starts; flagging now so they don't slip:

1. **Async worker.** Celery vs Django-Q vs management-command worker. Recommend Django-Q for v1 (simpler ops, single process), revisit if OCR queue depth becomes a real issue.
2. **Reactflow license/version pin.** Confirm the MIT version covers our use; pin major version.
3. **Per-project storage layout for `ProjectAsset` files.** S3-compatible bucket? Local disk in `media/`? Decide once and commit a `MEDIA_BACKEND` setting; signed URLs for private projects either way.
4. **Project visibility default.** `private` (recommended — safer) vs `org`.
5. **Whether `Fork` model needs to learn about `Project`** (a fork of a *project* is currently entity-by-entity). Probably yes — add `forked_from` on `Project` (already in section 3.2) and keep entity-level `Fork` as a finer-grained mechanism.

---

## 14. What this plan is *not* doing

To make the scope honest:

- No public anonymous contribution. Authenticated only.
- No Wikidata/DBpedia federation in v1 (the SPARQL hook is there; the UX isn't).
- No mobile-first contribution UI.
- No automated machine translation of contributions; manual `i18n` per language only.
- No replacement of the existing Fuseki/Jena scaffolding — left alone as the user requested.
- No real-time collaborative editing (single-author drafts; collaborator handoff via state transitions).

Each can be added later without re-architecting; none belongs in v1.

---

## 15. Quick reference — command cheatsheet

```bash
# Schema authoring loop
$EDITOR ontology/HeritageGraph.yaml
make ontology-validate
make generate
make check

# Run the app
make backend
make frontend

# Ingest a doc and see the pre-fill
make ingest FILE=./contribute-test-data/sample.pdf

# Rebuild the triplestore from Postgres
make rdf-rebuild
make rdf-verify

# Drain the outbox after an outage
make rdf-resync

# Walk every class form via API
make form-smoketest
```

---

*End of plan. Next action: confirm phasing and the open decisions in §13, then start Phase A.*
