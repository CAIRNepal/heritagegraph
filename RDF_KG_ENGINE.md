# HeritageGraph Knowledge Graph Engine

Oxigraph is the **runtime knowledge graph** for HeritageGraph. PostgreSQL remains the system of record for forms and review; the **KG engine** materializes publishable RDF, serves SPARQL, and unifies agent + contribution writes.

**Ontology files are unchanged** — the engine uses the existing LinkML registry, `Heritage.ttl`, and generated SHACL shapes.

---

## Architecture

```
PostgreSQL (CIDOC, CulturalEntity, HeritageAssertion)
        │
        ▼
apps/graph/kg_engine/          ← single orchestration layer
  ├── partitions.py            ← public / schema / document / prov graphs
  ├── uris.py                  ← canonical resource IRIs
  ├── projector.py             ← registry → triples
  ├── store.py                 ← Oxigraph HTTP or pyoxigraph local
  ├── promotion.py             ← document → public graph
  ├── engine.py                ← KnowledgeGraphEngine API
  └── outbox.py                ← retry failed writes
        │
        ▼
Oxigraph (SPARQL 1.1)
```

### Graph partitions

| Partition | Default IRI | Contents |
|-----------|---------------|----------|
| **PUBLIC** | `…/graph/public` | Published CIDOC + merged entities + promoted agent assertions |
| **SCHEMA** | `…/graph/schema` | TBox from `ontology/Heritage.ttl` (`rdf_load_tbox`) |
| **DOCUMENT** | `…/graph/document/{uuid}` | Per-upload OCR/agent ingest |
| **PROV** | `…/graph/prov/…` | Reserved for provenance bundles |

---

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/cidoc/kg/stats/` | GET | Triple counts, type histogram, health |
| `/cidoc/kg/neighborhood/?uri=…` | GET | Inbound/outbound edges in public graph |
| `/cidoc/kg/query/` | POST | Read-only SPARQL `{"query": "SELECT …"}` |
| `/cidoc/sparql/?query=…` | GET | Legacy SPARQL proxy |

---

## Operations

```bash
# Migrate (outbox table)
python manage.py migrate graph

# Load TBox (existing OWL file, no edits)
make rdf-load-tbox

# Rebuild public graph from Postgres
make rdf-rebuild

# Diagnose config + counts
make rdf-diagnose

# Retry failed writes
python manage.py rdf_drain_outbox
```

### Docker

```bash
docker compose up -d oxigraph backend
docker exec heritage-backend python /app/heritage_graph/manage.py migrate graph
docker exec heritage-backend python /app/heritage_graph/manage.py rdf_load_tbox
docker exec heritage-backend python /app/heritage_graph/manage.py rdf_rebuild
```

---

## Environment

See `.env.example` for `RDF_*` variables. Key flags:

| Variable | Default | Purpose |
|----------|---------|---------|
| `RDF_SYNC_ENABLED` | `true` | Master switch |
| `RDF_PUBLIC_GRAPH_URI` | `…/graph/public` | Published data |
| `RDF_KG_PROMOTE_ON_AUTO_ACCEPT` | `true` | Agent triples → public graph |
| `RDF_SHACL_VALIDATE_ON_WRITE` | `false` | SHACL before publish |
| `RDF_KG_OUTBOX_ENABLED` | `true` | Queue failed writes |

---

## Roadmap to “full” semantic KG (no ontology rewrite required)

| Phase | Status | Item |
|-------|--------|------|
| **A** | Done | Unified engine, partitions, public graph, rebuild |
| **B** | Done | KG HTTP API, agent → public promotion, outbox |
| **C** | Next | SPARQL-backed `/graphview` (replace REST heuristics) |
| **D** | Next | Curator “accept document” → `promote_document_graph_to_public` |
| **E** | Next | Wikidata/Getty entity resolution in engine |
| **F** | Optional | External OWL reasoner → `graph/inferred` materialization |
| **G** | Optional | SPARQL federation endpoint |

**Target maturity after C–D:** Level 3–4 (knowledge graph with semantic query surface).

---

## Code entry points

```python
from apps.graph.kg_engine import get_kg_engine

engine = get_kg_engine()
engine.publish_metadata_instance(person_row)
engine.neighborhood("https://w3id.org/heritagegraph/resource/person/1")
engine.rebuild_public_graph()
```

Legacy imports via `apps.cidoc_data.rdf_publish` remain supported.
