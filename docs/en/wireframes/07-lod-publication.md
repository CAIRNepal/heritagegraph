# Phases 10–11 — LOD Publication, Access & Discovery

> Covers: Nanopublication export (PARTIAL), RDF-star (PARTIAL), SKOS vocabularies (PARTIAL-static), VoID/DCAT (PARTIAL-static), content negotiation (PARTIAL), CARE SPARQL proxy (TODO), schema.org (TODO), DataCite DOI (TODO).
> Implementation tasks: `IMPLEMENTATION_PLAN.md § 10-A through 11-D`

---

## LOD Publication Pipeline — Process Diagram

```mermaid
flowchart LR
    MERGE["Merge approved\ntriples in main named graph"]

    MERGE --> NP["Celery: export_nanopubs_for_merge\n(one nanopub per HeritageAssertion)"]
    MERGE --> RS["Celery: export_rdfstar_trig\n(annotation layer in triple store)"]
    MERGE --> SKOS["make skos\n(generate_skos.py reads HeritageGraph.yaml)"]
    MERGE --> VOID["Celery: regen_void_dcat\n(live triple counts from Oxigraph)"]
    MERGE --> DOI["Celery: mint_doi\n(DataCite REST API)"]

    NP --> NP1["assertion graph\nprovenance graph\npubinfo graph + trusty URI\nSigned TriG bundle"]
    RS --> RS1["<< triple >> hg:confidence 0.7\nprov:wasDerivedFrom source"]
    SKOS --> SK1["hg:ritualTypeScheme a skos:ConceptScheme\nhg:Jatra skos:broadMatch aat:300069290"]
    VOID --> V1["void:Dataset triples=N\nvoid:sparqlEndpoint\ndcat:Distribution TTL/JSON-LD/SPARQL"]
    DOI --> D1["DataCite DOI: 10.5281/...\nProjectSnapshot.doi = ..."]

    NP1 --> LOAD["Load all outputs to Oxigraph\nSPARQL UPDATE INSERT DATA"]
    RS1 --> LOAD
    SK1 --> LOAD
    V1 --> LOAD

    LOAD --> SPARQL["SPARQL endpoint refreshed\nOxigraph :7878/query"]
    LOAD --> DEREF["Dereferenceable URIs\nw3id.org/heritagegraph/{type}/{id}"]
    SPARQL --> CARE["CARE SPARQL proxy\nfilter access_tier at query time"]
    DEREF --> CN["Content negotiation\nAccept: text/turtle → TTL\nAccept: application/ld+json → JSON-LD\nAccept: text/html → UI redirect"]

    D1 --> CITE["Citation returned to contributor\n+ emailed"]
```

---

## Feature Spec: Content Negotiation on Dereferenceable URIs

| Field | Value |
|-------|-------|
| Feature | Same `w3id.org/heritagegraph/structure/{id}` URI returns TTL, JSON-LD, RDF/XML, or HTML based on `Accept` header |
| Status | `[PARTIAL]` — `lod_views.py` exists; negotiation logic missing |
| Files | `apps/graph/lod_views.py` |
| Accept mapping | `text/turtle` → `rdflib` serialize from Oxigraph DESCRIBE · `application/ld+json` → JSON-LD plugin · `application/rdf+xml` → RDF/XML · `text/html` → 303 redirect to `/knowledge/{type}/{id}` |
| Acceptance | `curl -H "Accept: text/turtle" https://w3id.org/heritagegraph/structure/bhairabnath-temple` returns valid Turtle with CIDOC-CRM triples |

---

## Feature Spec: CARE-Aware SPARQL Proxy

| Field | Value |
|-------|-------|
| Feature | Proxy at `/sparql` injects `FILTER NOT EXISTS` clauses for `sensitive_indigenous` triples when caller is unauthenticated |
| Status | `[TODO]` |
| Files | `apps/graph/sparql_proxy.py`, `heritage_graph/urls.py` |
| Access tiers | `public` (no filter) · `org_only` (require org membership) · `community_only` (require community role) · `sensitive_indigenous` (require explicit grant) |
| Acceptance | Unauthenticated `SELECT ?s ?p ?o WHERE { ?s ?p ?o }` does not return any triple where subject has `hg:access_tier "sensitive_indigenous"` |

---

## Feature Spec: VoID + DCAT Generator

| Field | Value |
|-------|-------|
| Feature | Regenerate `void-dataset.ttl` with live triple counts after every merge |
| Status | `[TODO]` — static file exists; generator missing |
| Files | `apps/graph/kg_engine/void_generator.py`, `apps/graph/management/commands/regen_void.py` |
| SPARQL queries | `SELECT (COUNT(*) AS ?triples) WHERE { ?s ?p ?o }` · `SELECT DISTINCT ?type WHERE { ?s rdf:type ?type }` |
| Output | `ontology/lod/void-dataset.ttl` — overwritten with live counts, `dcat:version`, `dcat:issued = now()` |
| Acceptance | `python manage.py regen_void` produces valid TTL with correct triple count matching Oxigraph; `dcat:version` increments |

---

## Sequence: Full LOD Publication After Merge

```mermaid
sequenceDiagram
    participant Merge as merge.py
    participant Worker as Celery Worker
    participant DB
    participant NP as nanopub_export.py
    participant RS as rdfstar_export.py
    participant VOID as void_generator.py
    participant DOI as datacite.py
    participant Oxigraph
    participant DataCite

    Merge->>Worker: enqueue export_nanopubs_for_merge(merge_request_id)
    Merge->>Worker: enqueue regen_void_dcat()
    Merge->>Worker: enqueue mint_doi(project_snapshot_id)

    Worker->>DB: Load all HeritageAssertions for merge_request.project
    loop Per assertion
        Worker->>NP: nanopub_trig_for_assertion(assertion)
        NP-->>Worker: TriG string with assertion, provenance, pubinfo graphs
        Worker->>Oxigraph: SPARQL INSERT nanopub named graph
    end

    Worker->>RS: export_rdfstar_trig(output_path)
    RS->>DB: Load accepted assertions
    RS-->>Worker: TriG with RDF-star quoted triples and confidence annotations
    Worker->>Oxigraph: SPARQL INSERT annotations named graph

    Worker->>VOID: generate_void_dcat()
    VOID->>Oxigraph: SPARQL COUNT all triples
    Oxigraph-->>VOID: triple count 18234
    VOID->>VOID: Render void-dataset.ttl template with live counts
    VOID-->>Worker: TTL string
    Worker->>Oxigraph: SPARQL INSERT void named graph
    Worker->>DB: Write TTL to ontology/lod/void-dataset.ttl

    Worker->>DOI: mint_doi(project_snapshot)
    DOI->>DataCite: POST /dois with title, creators, publisher
    DataCite-->>DOI: doi=10.5281/zenodo.xxx state=findable
    DOI->>DB: Save doi on ProjectSnapshot
    Worker->>DB: Notify contributor with pids, nanopub_uris, doi
```

---

## Wireframe: SPARQL Explorer (`/graphview` or public `/sparql`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HeritageGraph SPARQL Explorer                                       │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Endpoint: https://w3id.org/heritagegraph/sparql                   │
│  Access:   [● Authenticated — full access]  or  [○ Anonymous]      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  PREFIX hg: <https://w3id.org/heritagegraph/>                 │ │
│  │  PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>            │ │
│  │  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>          │ │
│  │                                                                │ │
│  │  SELECT ?temple ?style ?match WHERE {                          │ │
│  │    ?temple a hg:Temple ;                                       │ │
│  │            hg:architectural_style ?style .                     │ │
│  │    OPTIONAL { ?style skos:exactMatch ?match }                  │ │
│  │  }                                                             │ │
│  │  LIMIT 20                                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  [Run Query →]  [Load example ▾]  [Federation: + Getty  + Wikidata]│
│                                                                      │
│  Results                                                             │
│  ┌──────────────────────────────────┬───────────┬────────────────┐  │
│  │ temple                           │ style     │ match          │  │
│  ├──────────────────────────────────┼───────────┼────────────────┤  │
│  │ hg:structure/bhairabnath-temple  │ Shikhara  │ aat:300002787  │  │
│  │ hg:structure/pashupatinath       │ Pagoda    │ aat:300002788  │  │
│  └──────────────────────────────────┴───────────┴────────────────┘  │
│  2 results  ·  0.043s  ·  CARE filter active (anonymous mode)       │
│                                                                      │
│  ⓘ 3 triples hidden by CARE access tier (sensitive_indigenous)      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe: Entity Dereference Page (`/knowledge/structure/[id]`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Bhairabnath Temple                                                  │
│  hg:structure/bhairabnath-temple-taumadhi                           │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  [Overview]  [Assertions (11)]  [Graph]  [Timeline]  [IIIF]  [RDF ▾]│
│                                                                      │
│  Type         Temple (crm:E22_Human-Made_Object)                    │
│  Location     Taumadhi Tole, Bhaktapur                              │
│               skos:exactMatch wd:Q177981                            │
│  Style        Shikhara  · AAT:300002787                             │
│  Built        circa 1427 CE (BS 1484~)                              │
│  Deity        Bhairab (via Enshrinement event)                      │
│  Condition    Good                                                   │
│                                                                      │
│  Provenance                                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Source    Slusser 1982 (Archival Record)                      │ │
│  │  Author    Nabin Oli  ·  orcid:0000-0002-xxxx-xxxx            │ │
│  │  Project   Bhairabnath Temple Survey 2026                      │ │
│  │  Merged    2026-06-15  ·  Reviewer: Tek Raj Chhetri            │ │
│  │  DOI       10.5281/zenodo.xxxxxxx  [Cite ↗]                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Download as:  [Turtle ↓]  [JSON-LD ↓]  [RDF/XML ↓]               │
│                                                                      │
│  <script type="application/ld+json">                                │
│  { "@type": "schema:LandmarksOrHistoricalBuildings",                │
│    "name": "Bhairabnath Temple", "geo": {...} }                     │
│  </script>                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Process Diagram: CARE SPARQL Proxy

```mermaid
flowchart TD
    REQ[Incoming SPARQL request\nGET /sparql?query=...] --> AUTH{Request\nauthenticated?}

    AUTH -->|No / anonymous| FILTER[Inject FILTER clause:\nFILTER NOT EXISTS\n{ ?s hg:access_tier sensitive_indigenous }\nFILTER NOT EXISTS\n{ ?s hg:access_tier community_only }]

    AUTH -->|Yes| ROLE{User role?}
    ROLE -->|Public user| FILTER2[Inject FILTER:\nhide sensitive_indigenous\nhide community_only]
    ROLE -->|Community member| FILTER3[Inject FILTER:\nhide sensitive_indigenous only]
    ROLE -->|Curator / explicit grant| PASSTHROUGH[No filter — full access]

    FILTER --> FORWARD[Forward modified query\nto Oxigraph :7878/query]
    FILTER2 --> FORWARD
    FILTER3 --> FORWARD
    PASSTHROUGH --> FORWARD

    FORWARD --> RESULT[Oxigraph returns results]
    RESULT --> ANNOTATE[Add X-CARE-Filtered header\nwith count of hidden triples]
    ANNOTATE --> RESP[Return response to caller]
```
