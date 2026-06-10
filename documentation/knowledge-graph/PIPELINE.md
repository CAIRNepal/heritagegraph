# HeritageGraph Knowledge-Graph Pipeline — Architecture, SOTA Review & Roadmap

> **Scope:** the full path from **ingestion → knowledge graph → display**, an honest
> state-of-the-art assessment, what is implemented today, and the concrete roadmap to
> a fully research-grade KG. Companion to [RDF_ENGINE.md](RDF_ENGINE.md),
> [../ontology/ONTOLOGY.md](../ontology/ONTOLOGY.md), [../../ARCHITECTURE.md](../../ARCHITECTURE.md).

---

## 1. Executive summary

HeritageGraph is a **standards-based RDF knowledge graph**, not a property-graph app:
CIDOC-CRM (ISO 21127) + a LinkML ontology registry, projected into **Oxigraph** (SPARQL 1.1)
with reified, provenance-bearing assertions (`crminf:I2_Belief` / `prov:Entity`), identity
clustering (`owl:sameAs`), and named-graph partitions. PostgreSQL is the system of record;
Oxigraph is the runtime KG.

**Verdict:** a genuine **research-grade foundation**, currently **~70% of the way to SOTA**.
The remaining gaps are specific and closable (statement-level provenance *in the graph*,
SHACL enforcement, external-authority reconciliation, LOD publishing, evaluation).

---

## 2. The full pipeline (ingestion → display)

```
 Ontology (LinkML)  ──gen──►  registry + SHACL + TS/Py config        [Stage 0]
        │
 Contribution form (OntologyForm) / optional agent suggestions         [Stage 1]
        │  contribution_entity_resolution on create (exact → cluster link)
        ▼
 PostgreSQL  (CIDOC MetaData · CulturalEntity/Revision/Activity ·     [Stage 2]
              HeritageAssertion · EntityCluster)          ← system of record
        │
 Review & reconciliation (queue · identity candidates ·            [Stage 3]
        │  suggest-duplicates · merge/split · RelationshipProposal)
        ▼
 rdf_signals → projector  (registry-aligned triples, SHACL gate,     [Stage 4]
        │                  owl:sameAs, outbox retry)
        ▼
 Oxigraph  (named graphs: PUBLIC · SCHEMA · DOCUMENT · PROV)          [Stage 5]
        │
 Read API  /kg/graph · /kg/neighborhood · /kg/query · /kg/stats       [Stage 6]
        │  (scope=all|reviewed · per-edge provenance)
        ▼
 Heritage Museum  (ontology-typed nodes + real edges + expand)       [Stage 7]
```

### Stage 0 — Ontology as single source of truth
- `ontology/HeritageGraph.yaml` (LinkML) defines classes/slots/enums + `class_uri`/`slot_uri`.
- Generators fan it out so every layer stays aligned: `tools/gen_heritage_viz_config.py`
  → `heritage-viz-config.ts` (incl. `NODE_TYPE_CONFIG`, `RDF_CLASS_URI_TO_NODE_TYPE`),
  `apps/graph/ontology_config.py` (RDF prefixes), SHACL shapes, and the registry payload
  (`apps/cidoc_data/linkml_loader.py`).

### Stage 1 — Ingestion
- **Human:** `OntologyForm` → DRF `ContributionFlowMixin.perform_create`
  (`apps/cidoc_data/views.py`) creates a CIDOC `MetaData` row + `CulturalEntity` wrapper +
  first `Revision` + reviewer notifications.
- **Identity on submit:** `contribution_entity_resolution.resolve_contribution_identity()`
  runs on commit — exact label+type → link to existing `EntityCluster`; similar label →
  singleton + `IdentityResolutionCandidate`; new label → new singleton cluster.
- **Duplicate UX:** `DuplicateContributionAlert` on forms calls
  `GET /api/v1/cidoc/entity-clusters/suggest-duplicates/` and steers contributors to edit
  the richer existing record when appropriate.
- **Agentic / OCR (suspended):** document OCR and multi-agent extraction are infrastructure-only;
  `OCR_ENABLED` defaults false and `ocr-worker` is not in active compose. See
  [`../pipelines/OCR.md`](../pipelines/OCR.md).

### Stage 2 — System of record (PostgreSQL)
- CIDOC `MetaData` subclasses — 26 navigable registry types in `tools/ui-classmap.yaml`
  (Person, Location, ArchitecturalStructure, Production, Consecration, Enshrinement,
  TransferOfCustody, Deity, Festival, Monument, IconographicObject, EntityCluster, …).
  Full table: [../ontology/ONTOLOGY.md](../ontology/ONTOLOGY.md) §5.
- `HeritageAssertion` = first-class reified statement (subject, predicate, object/value) with
  provenance: `source`/`source_citation`, `confidence`, `confidence_score`,
  `temporal_scope_edtf`, `contributed_by`, `attributed_to_agent`, `reconciliation_status`.
- `CulturalEntity`/`Revision`/`Activity` = versioned edit history; `EntityCluster` = identity.

### Stage 3 — Review & reconciliation
- Moderation via `reconciliation_status` (`pending` → `accepted`).
- **Relationships:** `RelationshipProposal` → moderator approval → `materialize_relationship_proposal`
  (`apps/heritage_data/views.py`) → an **accepted `relationship.*` HeritageAssertion**.
- **Identity:** `EntityCluster` + `IdentityResolutionCandidate` queue at `/curation/identity`;
  deploy bootstrap runs `bootstrap_identity_clusters` and
  `refresh_identity_candidates --auto-merge` (entrypoint). `canonical_record_selection`
  ranks cluster members for museum hub display. `external_identifiers` → `owl:sameAs` when unambiguous.

### Stage 4 — Projection to RDF
- `apps/cidoc_data/rdf_signals.py` connects `post_save` on every `MetaData` model and on
  `HeritageAssertion`. On save (when `RDF_SYNC_ENABLED`, default **on**):
  - **Entity** → `rdf:type` (`classUri`), `rdfs:label`, slot literals, **FK `relation` slots
    as IRI→IRI edges** (`build_entity_projection`), and `owl:sameAs`.
  - **Accepted `relationship.*` assertion** → one edge triple
    (`queue_relationship_assertion_projection`).
- Canonical IRI policy: `resource_uri_for_instance` = `{base}/{registry_key}/{pk}`
  (`apps/graph/kg_engine/uris.py`). Assertion subjects/objects resolve to the **same** IRIs.
- Optional SHACL gate (`RDF_SHACL_VALIDATE_ON_WRITE`); failed writes retried via the outbox.

### Stage 5 — KG store (Oxigraph)
- SPARQL 1.1; partitions **PUBLIC** (published), **SCHEMA** (TBox from `Heritage.ttl`),
  **DOCUMENT** (per-upload ingest), **PROV** (reserved).
- `rdf_rebuild` re-projects every entity idempotently (per-subject managed-triple replace —
  it does **not** wipe assertion edges).

### Stage 6 — Read API
- `GET /api/v1/cidoc/kg/graph/` — whole public graph as render-ready JSON: ontology-typed
  nodes + real edges. Supports `?scope=all|reviewed` and now **per-edge `provenance`**
  (source/confidence/asserter/temporal) joined from accepted assertions.
- `GET /kg/neighborhood/?uri=` — inbound/outbound edges (+ neighbour `rdf:type`) for
  click-to-expand. `POST /kg/query/` — read-only SPARQL. `GET /kg/stats/` — counts/histogram.

### Stage 7 — Display (Museum, Atlas, Graphview)
- **Heritage Museum** (`/heritage-museum`): `src/lib/museum-graph.ts` + `kg-graph.ts` fetch
  `/api/v1/cidoc/kg/graph/`; cluster dedup + canonical member preference; live corpus default.
- **Graphview** (`/graphview`): Cytoscape instance graph via `src/lib/instance-graph.ts`.
- **Atlas** (`/atlas`): Cesium globe + live CIDOC hydration (`src/lib/atlas-api-hydrate.ts`).
- Nodes typed via `RDF_CLASS_URI_TO_NODE_TYPE`; edges are **real triples** (not name-matching heuristics).

---

## 3. SOTA scorecard

| Dimension | Status | Industry benchmark | Notes |
|---|---|---|---|
| Ontology & standards | 🟢 Strong | Getty/CIDOC LOD | CIDOC-CRM + LinkML single source → SHACL/TS/Py |
| Reified statements + uncertainty | 🟢 Strong | Nanopub / CRMinf | `crminf:I2_Belief`, confidence, EDTF temporal |
| Identity & external linking | 🟡 Partial | Wikidata 5-star LOD | `skos:exactMatch` machinery exists; needs real links |
| Provenance **in the graph** | 🟢 Good | PROV-O / nanopubs | Per-assertion prov graphs + read-time edge provenance |
| Validation (SHACL) | 🟡 Partial | SHACL mandatory at publish | Shapes exist; `RDF_SHACL_VALIDATE_ON_WRITE=false` by default |
| Review-gated publication | 🟢 Strong | Museum LOD norm | **Write + read** gate: only `accepted/merged/published` → PUBLIC |
| Linkset vs bulk merge | 🟢 Strong | VoID linksets | External datasets stay separate; curated namespace only in PUBLIC |
| LOD publishing / FAIR | 🔴 Gap | Zenodo DOI + dereferenceable URIs | VoID/DCAT plumbing exists; no versioned public release yet |
| Evaluation / quality metrics | 🟡 Partial | Gold-standard F1 | `kg_quality_report` + `kg_verify`; no expert benchmark yet |
| Dataset density | 🔴 Gap (data) | Connected graph | ~112 curated entities; curation throughput is the bottleneck |

**Maturity level:** **Level 3–4 architecture** (research/industry-grade stack) on a **curated global corpus** (Nepal-rich fixtures + review workflow). Dataset density grows with curation throughput and external linking — not bulk third-party imports.

---

## 4. Recently implemented (toward SOTA)
- **Museum reads the real KG** via SPARQL (`/kg/graph/`), replacing the prior client-side
  heuristic edge reconstruction (name-matching/NLP/co-location — all removed).
- **Ontology-faithful typing**: generated `RDF_CLASS_URI_TO_NODE_TYPE`.
- **Review-gating**: `scope=all|reviewed` on the read API.
- **Provenance-bearing edges**: every assertion-backed edge now carries source, confidence,
  asserter, and temporal scope (`KnowledgeGraphGraphView` + `_assertion_provenance_map`).
- **Click-to-expand** via `/kg/neighborhood/` (neighbours typed by `rdf:type`).
- **Diagnostics/verification**: `python manage.py kg_verify` (store consistency, edge counts,
  dangling edges, accepted-vs-pending), `kg_e2e_demo` (create→project→read round-trip).
- Deterministic SVG node icons; reproducible, attributed demo corpus.

---

## 5. Roadmap to full SOTA

### P1 — research credibility (highest leverage)
1. **Statement-level provenance *in RDF*** — project each accepted assertion as a
   **named graph per assertion** (or RDF-star), described in the PROV partition with
   `prov:wasGeneratedBy`, `prov:wasAttributedTo`, confidence, `prov:generatedAtTime`, and
   EDTF validity (nanopublication pattern). Promotes today's read-time provenance into the
   graph itself. *Spec:* mint `{base}/assertion/{uuid}`; write the asserted triple to its
   own graph; describe that graph in PROV; extend `/kg/graph/` to read provenance from PROV
   instead of Postgres.
2. **Enable SHACL on write** (`RDF_SHACL_VALIDATE_ON_WRITE=true`) + a conformance report;
   surface violations in review.
3. **External reconciliation** — populate `EntityCluster.external_identifiers` with
   Wikidata/Getty AAT+TGN/GeoNames/VIAF IRIs (reconciliation service + reviewer UI); the
   `owl:sameAs` emission already exists.

### P2 — FAIR / Linked Open Data publishing
- Dereferenceable resource URIs with **content negotiation** (Turtle / JSON-LD / RDF-XML).
- A read-only **public SPARQL endpoint**; **VoID + DCAT** dataset description; **Zenodo DOI**
  per versioned release; per-resource license.
- **SKOS** thesauri for controlled vocabularies, aligned to Getty AAT.
- **Linkset model (not bulk merge):** external datasets (e.g. Yale LUX) live in separate
  named graphs (`imported/*`, `alignment/*`). Curated entities link via `skos:exactMatch`
  only. The public graph (`graph/public`) accepts IRIs under `RDF_RESOURCE_BASE_URI` only;
  run `python manage.py kg_purge_public_imports --apply` if bulk imports were merged by mistake.
  Batch link suggestions: `python manage.py kg_suggest_external_links`.

### P3 — evaluation & quality
- **Gold-standard evaluation** of the agent extraction (precision/recall/F1 vs expert
  annotations) — required to publish the pipeline.
- **KG-quality dashboard**: SHACL conformance %, link density, type/coverage completeness,
  dangling-edge count (extend `kg_verify`).

---

## 6. Verify the pipeline end to end
```bash
make test-e2e                # 40 tests: health, contribute, identity, RDF, museum (see tests/)
cd heritage_graph
python manage.py kg_verify   # store consistency · edges by predicate · accepted vs pending
python manage.py kg_e2e_demo # create → project → read round-trip
make rdf-rebuild             # re-project entities (FK relations included)
curl -s 'http://localhost:8000/api/v1/cidoc/kg/graph/?scope=all' | jq '.counts'
```
Then open **Heritage Museum** (`/heritage-museum`) or **Graphview** (`/graphview`) in **Live** mode;
assertion-backed edges should carry provenance when `scope=reviewed` or provenance map is populated.

---

## 7. Key files
- Ontology/gen: `ontology/HeritageGraph.yaml`, `make generate`, `tools/gen_heritage_viz_config.py`
- Contribution + identity: `apps/cidoc_data/contribution_entity_resolution.py`,
  `apps/cidoc_data/canonical_record_selection.py`, `heritage_graph_ui/src/components/contribute/duplicate-contribution-alert.tsx`
- Projection: `apps/cidoc_data/rdf_signals.py`, `apps/cidoc_data/rdf_entity_projection.py`,
  `apps/graph/kg_engine/{projector,engine,store,queries,uris,partitions}.py`
- Read API: `apps/graph/views.py`, `apps/cidoc_data/urls.py` (`/kg/graph/`, `/kg/stats/`, …)
- Ops: `heritage_graph/entrypoint.sh`, `make rdf-rebuild`, `make identity-candidates`
- Diagnostics: `apps/graph/management/commands/{kg_verify,kg_e2e_demo,rdf_rebuild}.py`
- Display: `heritage_graph_ui/src/lib/{kg-graph,museum-graph,instance-graph}.ts`,
  `heritage_graph_ui/src/app/(dashboard)/heritage-museum/`,
  `heritage_graph_ui/src/app/(dashboard)/graphview/`,
  `heritage_graph_ui/src/app/(dashboard)/atlas/`
