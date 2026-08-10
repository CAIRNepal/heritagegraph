# Integrating the DANAM-aligned corpus into HeritageGraph

**Document type:** Architecture & methods decision record (data finalization)  
**Audience:** Platform maintainers, co-authors, Nature-style methods reviewers  
**Corpus:** `data/reconciled/danam-heritagegraph.nq`  
**Status:** Design adopted; L1 importer landed (`manage.py import_danam_nq`) — not yet bulk-applied to production  
**Related:** [`documentation/knowledge-graph/RDF_ENGINE.md`](../knowledge-graph/RDF_ENGINE.md), [`ARCHITECTURE.md`](../../ARCHITECTURE.md), `/methods`

---

## 1. Executive recommendation

**Finalize the corpus as a two-layer knowledge graph**, matching how mature LOD platforms separate *archival RDF* from *curated, editable product data*:

| Layer | What it is | Where it lives | What users see |
|-------|------------|----------------|----------------|
| **L0 — Research archive (frozen)** | Full reconciled N-Quads, source graphs preserved (OSM, Wikidata, UNESCO, crosswalk, intangible) | Oxigraph **imported** named graphs (never `graph/public`) + Zenodo/Figshare dump of the `.nq` | Methods page, SPARQL “research graphs”, citation DOI, reproducibility package |
| **L1 — Platform knowledge (live)** | Idempotent materialization of entities + assertions into Postgres CIDOC / `HeritageAssertion` / `DataSource`, then projected to `graph/public` | PostgreSQL (system of record) → Oxigraph `graph/public` | Knowledge browse, Contribute/Improve, Museum & Atlas **live**, review queues |

**Do not** load `danam-heritagegraph.nq` directly into `graph/public`. That would:

- orphan IRIs from Postgres (fails `kg_verify` / pollution checks),
- break contribute/edit/review (no rows to PATCH),
- erase the research distinction between source graphs,
- make Museum/Atlas unable to attribute OSM vs DANAM vs Wikidata.

This dual-layer design is the same pattern used, in different vocabularies, by Wikidata (item + sitelinks + references), Europeana (EDM aggregation + provider graphs), Linked Art / Getty (CIDOC-CRM A-Box + controlled vocabularies), and ResearchSpace / British Museum (CRM + named-graph provenance).

---

## 2. Corpus characterization (what you are finalizing)

Measured on `data/reconciled/danam-heritagegraph.nq` (post–vocabulary crosswalk to `https://w3id.org/heritagegraph/`):

| Metric | Value |
|--------|------:|
| Quads | 130 286 |
| Distinct subjects (approx.) | ~23 627 |
| Dominant types | E53_Place ≈ 7 861; crminf:I2_Belief ≈ 7 860; ArchitecturalStructure ≈ 6 771; ReligiousStructure ≈ 798; WaterStructure ≈ 141; DhungeDhara ≈ 115 |
| Named graphs | `…/graph/openstreetmap` (~106k), `…/graph/crosswalk` (~20k), `…/graph/wikidata` (~3.8k), `…/graph/intangible`, `…/graph/unesco` |
| Instance IRIs | `https://data.cair-nepal.org/heritagegraph/…` (stable external identifiers) |
| Ontology IRIs | Current released TBox (`w3id.org/heritagegraph/` + CIDOC-CRM / CRMinf) |

**Already done (keep):** `data/reconcile_store.py` + `reconcile_crosswalk.json` rewrote the legacy `cair-nepal.org/heritagegraph/` snake_case vocabulary into the released camelCase ontology and dropped retired predicates / old T-Box graph.

**Out of scope for the product KG:** `data/fuseki/` (runtime TDB), `data/oops/WordNet` (lexical resource, not heritage A-Box).

---

## 3. Dual mandate (why one dump is not enough)

HeritageGraph is simultaneously:

1. **A research knowledge graph** — citable, SPARQL-queryable, provenance-preserving, aligned to CIDOC-CRM / CRMinf, suitable for a Nature (or Nature-family) computational / cultural-heritage methods article.
2. **A human contribution platform** — forms, improve-existing, review gates, Museum narrative UI, Atlas globe — where lay contributors and curators interact with **rows**, not quads.

World-class systems never collapse these into a single mutable triple store:

| Platform | Archive / LOD | Interaction layer |
|----------|---------------|-------------------|
| **Wikidata** | RDF dumps + Query Service | Items, statements, references, ranks |
| **Europeana** | EDM RDF / IIIF | Portal search, provider aggregation |
| **Nomisma / Pelagios** | Concept RDF | Annotation / gazetteer UIs |
| **Linked Art** | JSON-LD / CRM | Museum collection APIs |
| **ResearchSpace** | CRM named graphs | Faceted research UI |

**HeritageGraph already encodes this split:** Postgres forms + review → publish gate → Oxigraph projection ([`RDF_ENGINE.md`](../knowledge-graph/RDF_ENGINE.md)). The DANAM corpus must enter through that gate for L1, while L0 preserves the full research dump.

---

## 4. Options considered

### Option A — Dump NQ into `graph/public` (reject)

- **Pros:** Fast; Museum live might light up overnight.  
- **Cons:** No SoR; no edit/review; named-graph provenance collapsed; pollution / orphan IRIs; unreproducible “who approved this?”.  
- **Nature risk:** Methods cannot claim a moderated publication pipeline.

### Option B — Archive-only (SPARQL + DOI dump) (insufficient alone)

- **Pros:** Maximum research fidelity; trivial to cite.  
- **Cons:** Contribute/Improve/Museum HCI stay disconnected from the corpus.  
- **Nature risk:** Platform contribution claims would not cover the corpus.

### Option C — Postgres-only materialization, discard named graphs (reject)

- **Pros:** Clean product UX.  
- **Cons:** Loses OSM vs Wikidata vs UNESCO provenance graphs; hard to reproduce enrichment; weak FAIR “rich metadata”.  
- **Nature risk:** Source stratification disappears.

### Option D — **Two-layer finalization (recommend)**

- L0: load `.nq` into **imported** named graphs (mirror original graph IRIs under a documented prefix, or load as-is into Oxigraph as non-public partitions).  
- L1: deterministic ETL → Postgres → `accepted` (bulk curated) with `DataSource` + `owl:sameAs` / `dcterms:identifier` back to `data.cair-nepal.org` IRIs → `rdf_rebuild`.  
- UI: Museum/Atlas default **live** for L1; Methods documents L0 SPARQL endpoints and dump DOI; optional “Research graphs” toggle for L0 overlay (linkset style, same as LUX).

---

## 5. Recommended architecture (finalize this)

```text
danam-heritagegraph.nq
        │
        ├──────────────────────────────┐
        ▼                              ▼
┌───────────────────┐        ┌──────────────────────────┐
│ L0 Research store │        │ L1 Platform ETL          │
│ Oxigraph imported │        │ NQ → CIDOC + Assertion   │
│ graphs (frozen)   │        │ + DataSource + sameAs    │
│ Zenodo .nq + VoID │        │ status=accepted (bulk)   │
└─────────┬─────────┘        └────────────┬─────────────┘
          │                               │
          │ SPARQL / Methods              ▼
          │                      PostgreSQL SoR
          │                               │
          │                               ▼ rdf_rebuild
          │                      graph/public (curated)
          │                               │
          └──────────┬────────────────────┘
                     ▼
        Museum · Atlas · Knowledge · Contribute
        (live = L1; research SPARQL = L0+L1)
```

### 5.1 Identity policy

- **Stable external IRI:** keep `https://data.cair-nepal.org/heritagegraph/id/...` as `dcterms:identifier` / `owl:sameAs`.  
- **Platform IRI:** mint `https://w3id.org/heritagegraph/resource/{type}/{pk}` via normal projection.  
- **Dedup:** idempotent ETL key = external IRI (or DANAM `rid` when present). Re-runs update, never duplicate.  
- **Identity layer (spec 005):** after load, run cluster hints for label collisions (e.g. temples already contributed manually vs DANAM).

### 5.2 What materializes to L1 (product)

Priority order (pass-based ETL):

1. **Structures** (Architectural / Religious / Water / DhungeDhara / Stupa / Chaitya) + labels + existenceStatus + P55 location + WKT when present.  
2. **Places** only when they have human labels or are referenced by P55 (avoid 8k anonymous OSM nodes as first-class Knowledge cards).  
3. **Intangible / small classes:** Deity, Guthi, Festival, Ritual, CasteGroup, Murti, Kumari events.  
4. **Assertions (I2_Belief):** → `HeritageAssertion` with confidence, proposition slots, `assertsAbout`, `wasDerivedFrom` → `DataSource` (DANAM / Wikidata / OSM / UNESCO).  
5. **Crosswalk / Wikidata sameAs:** store as identifiers, not duplicate entities.

### 5.3 What stays L0-only (research essence)

- Full OSM quad volume and graph boundaries.  
- Belief quads that fail SHACL / missing about-target after mapping.  
- Any triple whose predicate is not in the LinkML registry (log to an ETL reject report — do not silently drop without an audit file).

### 5.4 Provenance & ethics (Nature-grade)

For each L1 row, require at minimum:

- `DataSource` records: DANAM, OpenStreetMap, Wikidata, UNESCO (with license notes already present in corpus notes).  
- Bulk accept comment: e.g. `bulk import danam-heritagegraph.nq @ <git or Zenodo version>`.  
- VoID / DCAT description of L0 dump (triple count, graph IRIs, ontology version hash from `schema_version`).  
- CARE / Indigenous data notes where applicable (community stewardship of living traditions — already foreshadowed in DataCite/CARE fields on DataSource).  
- Clear license stratification: OSM ODbL, Wikidata CC0, DANAM/provider terms, HG curated overlay CC BY 4.0.

---

## 6. Presentation on HeritageGraph surfaces

| Surface | Source | Behavior after finalization |
|---------|--------|-----------------------------|
| **Knowledge** `/knowledge/*` | L1 Postgres | Faceted browse of materialized types |
| **Contribute / Improve** | L1 | Humans update existing DANAM-derived rows; duplicate alert steers to edit |
| **Review queues** | L1 | New human edits still gated; bulk import marked curated |
| **Heritage Museum** `?source=live` | L1 → `kg/graph` | Stories / graph / map over curated public graph |
| **Heritage Atlas** `?source=live` | L1 → `kg/graph` | Globe with tiered geo (verified / inherited / gazetteer) |
| **Graph visualization** | L1 (+ optional L0 overlay) | Schema vs heritage tabs; research toggle for imported graphs |
| **Methods** `/methods` | Docs + DOIs | Cite dump, ontology version, rebuild commands, SPARQL examples |
| **SPARQL** | L0 + L1 | Competency queries against public + `GRAPH <…/imported/…>` |

Demo corpora remain **illustrative only** and must stay labeled as such (already on Methods).

---

## 7. Implementation plan (to “finalize”)

### Phase 0 — Freeze & cite (1 day)

1. Checksum `danam-heritagegraph.nq` (SHA-256).  
2. Deposit on Zenodo with version tag; record DOI in `/methods` + `CITATION.cff` / `.zenodo.json`.  
3. Document ontology release (`HeritageGraph.yaml` / TTL hash) used for the crosswalk.

### Phase 1 — L0 load (1–2 days)

1. `manage.py rdf_load_imported_nq` (new): stream NQ into Oxigraph **imported** graphs (preserve named-graph IRIs).  
2. Exclude from `kg_purge` public pollution checks; extend `kg_verify` to assert “no imported subjects in PUBLIC”.  
3. Methods page: SPARQL examples per source graph.

### Phase 2 — L1 ETL Pass 1 structures (2–4 days)

1. `manage.py import_danam_nq --pass=structures --dry-run` then `--apply`.  
2. Create/update `DataSource` rows; set `status=accepted`; store external IRI.  
3. `rdf_rebuild && kg_purge_orphans --apply && kg_verify`.  
4. Smoke: Museum/Atlas live count jump; spot-check Budhanilkantha / Pashupatinath-class labels.

### Phase 3 — Assertions + enrichment (3–5 days)

1. Materialize I2_Belief → `HeritageAssertion` where `assertsAbout` resolves.  
2. Attach Wikidata sameAs; keep unresolved in L0.  
3. SHACL validate sample (≥100) + full fail-open report.

### Phase 4 — HCI & identity (2–3 days)

1. Run identity candidate refresh for label collisions with contributor data.  
2. Ensure Improve search finds DANAM labels.  
3. Curator dashboard: “bulk import batch” filter.

### Phase 5 — Paper package

1. Competency-question SPARQL notebook (L0 vs L1).  
2. Figure: architecture diagram (this document §5).  
3. Supplementary Table: type counts, graph counts, license matrix.  
4. Reproducibility: Docker tag + `rdf_load_tbox` + import commands + checksums.

---

## 8. Nature / FAIR / CARE checklist

Living status table: [`NATURE_KG_RIGOR.md`](./NATURE_KG_RIGOR.md). Summary:

| Criterion | How this design satisfies it | Status |
|-----------|------------------------------|--------|
| **Findable** | Zenodo DOI (pending mint) + w3id IRIs + VoID + `corpus_fingerprint` | 🟡 DOI · ✅ else |
| **Accessible** | Public SPARQL (CARE proxy); HTTPS resource IRIs; open Methods | ✅ |
| **Interoperable** | CIDOC-CRM + CRMinf + HG LinkML; crosswalk documented | ✅ |
| **Reusable** | License matrix; frozen dump SHA-256; ETL idempotence; ontology pin | ✅ |
| **CARE** | Stewardship via review; CARE proxy; DataSource TK fields | ✅ |
| **Provenance** | Named graphs (L0) + DataSource + PROV (L1) | ✅ |
| **Human interaction** | L1 editable under staged revision; L0 immutable | ✅ |
| **Display fidelity** | Live Museum/Atlas = curated PUBLIC only | ✅ |
| **Reject audit** | Unmapped predicates logged, not silently dropped from L0 | ✅ |
| **Competency queries** | `documentation/research/competency_queries.sparql` | ✅ |
| **Integrity gate** | `kg_rigor_audit` includes L0 isolation HARD check | ✅ |

---

## 9. Decision

**Adopt Option D (two-layer finalization).**  
Treat `danam-heritagegraph.nq` as the **canonical research A-Box dump** (L0) and as the **input to a Postgres materializer** (L1) that feeds HeritageGraph’s existing publish → Oxigraph → Museum/Atlas path.

That is how a world-class knowledge-graph platform would store this corpus **and** how a Nature-grade methods section would defend it: frozen, citable RDF with intact source graphs; curated, interactive product graph with review semantics and UI surfaces.

---

## 10. Immediate next engineering step — done (importer)

`manage.py import_danam_nq` is available:

```bash
# Dry-run first 20 structures
python manage.py import_danam_nq --dry-run --limit 20 --report-json /tmp/danam-dry.json

# Apply structures (idempotent), then assertions for resolved about-targets
python manage.py import_danam_nq --pass structures --limit 100
python manage.py import_danam_nq --pass assertions --limit 100

# Full apply + public graph rebuild (stop embedded runserver first if using local pyoxigraph)
python manage.py import_danam_nq --pass all --rebuild \
  --expected-sha256 14decfcdf95aee0799b65b572e4ef0ec6cabc8581201661b35ee5a6d059c050c
```

| Flag | Role |
|------|------|
| `--dry-run` | Parse + count; no Postgres writes |
| `--limit N` | Cap subjects per pass |
| `--pass structures\|assertions\|all` | ETL stage |
| `--expected-sha256` | Pin input file (abort on mismatch) |
| `--rebuild` | Call `rdf_rebuild` after apply |
| `--report-json` | Write created/updated/skipped/failures |

Idempotency: `LodExternalIdentity` maps each `https://data.cair-nepal.org/heritagegraph/…` IRI → local row. Re-runs update. Identity clusters get `external_identifiers.danam` (+ OSM / Wikidata when present) for `owl:sameAs` / linkset projection.

**Still do not** load the NQ directly into `graph/public`.

**Next:** uncapped structures apply + Museum/Atlas live smoke; mint Zenodo DOI; optional SHACL-on-write staging report.

Also see: [`NATURE_KG_RIGOR.md`](./NATURE_KG_RIGOR.md), [`competency_queries.sparql`](./competency_queries.sparql), `manage.py corpus_fingerprint`, `manage.py rdf_load_imported_nq`.

---

*End of decision record.*
