# HeritageGraph Knowledge-Graph Pipeline — Architecture, SOTA Review & Roadmap

> **Scope:** the full path from **ingestion → knowledge graph → display**, an honest
> state-of-the-art assessment, what is implemented today, and the concrete roadmap to
> a fully research-grade KG. Companion to [RDF_KG_ENGINE.md](RDF_KG_ENGINE.md),
> [ONTOLOGY.md](ONTOLOGY.md), [ARCHITECTURE.md](ARCHITECTURE.md).

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
 Contribution form / 5-agent suggestion pipeline                     [Stage 1]
        │  (suggestions → human review)
        ▼
 PostgreSQL  (CIDOC MetaData · CulturalEntity/Revision/Activity ·     [Stage 2]
              HeritageAssertion · EntityCluster)          ← system of record
        │
 Review & reconciliation (queue · identity clusters ·                [Stage 3]
        │  RelationshipProposal → materialize → accepted assertion)
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

### Stage 1 — Ingestion (**suggestion-based today**)
- **Human:** contribution forms (`ContributionFlowMixin.perform_create`,
  `apps/cidoc_data/views.py`) create a CIDOC `MetaData` row + a `CulturalEntity` wrapper +
  first `Revision` + reviewer notifications.
- **Agentic:** a 5-agent ingestion pipeline (Agent 1 built; Agents 2–5 pending; Ollama
  Llama 3.1 70B as extraction LLM). **Output is *suggestions*** — extracted entities and
  `HeritageAssertion`s with `confidence_score` / `attributed_to_agent`, queued for review,
  **not** auto-published.

### Stage 2 — System of record (PostgreSQL)
- CIDOC `MetaData` subclasses (Person, Location, ArchitecturalStructure, Deity, Festival,
  Monument, IconographicObject, …).
- `HeritageAssertion` = first-class reified statement (subject, predicate, object/value) with
  provenance: `source`/`source_citation`, `confidence`, `confidence_score`,
  `temporal_scope_edtf`, `contributed_by`, `attributed_to_agent`, `reconciliation_status`.
- `CulturalEntity`/`Revision`/`Activity` = versioned edit history; `EntityCluster` = identity.

### Stage 3 — Review & reconciliation
- Moderation via `reconciliation_status` (`pending` → `accepted`).
- **Relationships:** `RelationshipProposal` → moderator approval → `materialize_relationship_proposal`
  (`apps/heritage_data/views.py`) → an **accepted `relationship.*` HeritageAssertion**.
- **Identity:** `EntityCluster.external_identifiers` → `owl:sameAs` triples
  (`apps/cidoc_data/rdf_entity_projection.py`), emitted only once a cluster is unambiguous.

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

### Stage 7 — Display (Heritage Museum)
- `src/lib/kg-graph.ts` fetches `/kg/graph/`; nodes typed via `RDF_CLASS_URI_TO_NODE_TYPE`
  (ontology IRI → NodeType, alias classes collapse honestly); edges are **real triples**.
- Force graph / map / timeline / XR, deterministic Tabler SVG icons, click-to-expand,
  per-image Wikimedia attribution. A frozen, attributed **demo corpus** stays for offline/figures.

---

## 3. SOTA scorecard

| Dimension | Status | Notes |
|---|---|---|
| Ontology & standards | 🟢 Strong | CIDOC-CRM + LinkML single source → SHACL/TS/Py |
| Reified statements + uncertainty | 🟢 Strong | `crminf:I2_Belief`, confidence, EDTF temporal |
| Identity & external linking | 🟡 Partial | `owl:sameAs` machinery exists; needs real links to Wikidata/Getty/GeoNames/VIAF |
| Provenance **in the graph** | 🟡 Partial | Now surfaced per edge at read time; not yet statement-level *in RDF* |
| Validation (SHACL) | 🟡 Partial | Shapes exist but `RDF_SHACL_VALIDATE_ON_WRITE=false` by default |
| Versioning | 🟢 Good | Revision/Activity; no triple-level time-travel |
| Review-gated publication | 🟢 Added | `scope=reviewed` filters pending/draft |
| LOD publishing / FAIR | 🔴 Gap | No dereferenceable RDF, public SPARQL, VoID/DCAT, or dataset DOI |
| Controlled vocab (SKOS) | 🟡 Partial | SKOS referenced in agents; no full thesaurus aligned to Getty AAT |
| Ingestion pipeline | 🟢 Novel | 5-agent, confidence-scored, human-gated (suggestion-based) |
| Evaluation / quality metrics | 🔴 Gap | No gold-standard eval or KG-quality dashboard |
| Scale | 🟢 OK | Oxigraph single-node fits current scale |

---

## 4. Implemented this session (toward SOTA)
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

### P3 — evaluation & quality
- **Gold-standard evaluation** of the agent extraction (precision/recall/F1 vs expert
  annotations) — required to publish the pipeline.
- **KG-quality dashboard**: SHACL conformance %, link density, type/coverage completeness,
  dangling-edge count (extend `kg_verify`).

---

## 6. Verify the pipeline end to end
```bash
python manage.py kg_verify     # store consistency · edges by predicate · accepted vs pending · dangling
python manage.py kg_e2e_demo   # create → project → read round-trip (asserts a connected, typed graph)
make rdf-rebuild               # re-project entities (FK relations included)
curl -s '/api/v1/cidoc/kg/graph/?scope=all' | jq '.counts'   # nodes, edges, edgesWithProvenance
```
Then open the museum → **Live KG** → connected, ontology-typed graph; **+ Expand** grows it;
each assertion-backed edge carries provenance.

---

## 7. Key files
- Ontology/gen: `ontology/HeritageGraph.yaml`, `tools/gen_heritage_viz_config.py`
- Projection: `apps/cidoc_data/rdf_signals.py`, `apps/cidoc_data/rdf_entity_projection.py`,
  `apps/graph/kg_engine/{projector,engine,store,queries,uris,partitions}.py`
- Read API: `apps/graph/views.py`, `apps/cidoc_data/urls.py`
- Diagnostics: `apps/graph/management/commands/{kg_verify,kg_e2e_demo,rdf_rebuild}.py`
- Display: `heritage_graph_ui/src/lib/kg-graph.ts`,
  `heritage_graph_ui/src/app/(dashboard)/heritage-museum/`
