# Nature / FAIR / CARE rigor checklist — HeritageGraph KG

Companion artifacts:

- [`ETHICS_AND_CONSENT.md`](./ETHICS_AND_CONSENT.md)
- [`DANAM_CORPUS_INTEGRATION_REPORT.md`](./DANAM_CORPUS_INTEGRATION_REPORT.md)
- [`competency_queries.sparql`](./competency_queries.sparql)
- `manage.py kg_rigor_audit`
- `manage.py corpus_fingerprint`
- `manage.py rdf_load_imported_nq` / `import_danam_nq`
- Methods UI: `/methods`

Status: ✅ in place · 🟡 partial · 🔴 gap (deposit / scale / paper package)

## Checklist

| # | Criterion | Status | Evidence / command |
|---|-----------|--------|--------------------|
| F1 | Findable PIDs (w3id resource IRIs) | ✅ | `RDF_RESOURCE_BASE_URI` + LOD content negotiation |
| F2 | Dataset VoID / DCAT | ✅ | `void_generator` / `regen_void` |
| F3 | Zenodo DOI for software + L0 dump | 🟡 | `.zenodo.json` + `CITATION.cff` (DOI placeholder until deposit) |
| F4 | Corpus fingerprint (SHA-256 + ontology pin) | ✅ | `manage.py corpus_fingerprint` |
| A1 | Public read-only SPARQL | ✅ | CARE proxy `/sparql/` |
| A2 | Methods page reproducibility | ✅ | `/methods` |
| A3 | Demo vs live corpus labeled | ✅ | Museum/Atlas `?source=` + Methods limitations |
| I1 | CIDOC-CRM + CRMinf + LinkML | ✅ | `ontology/HeritageGraph.yaml` + CRM bridge |
| I2 | SHACL shapes generated | 🟡 | shapes exist; `RDF_SHACL_VALIDATE_ON_WRITE` default off |
| I3 | Crosswalk documented | ✅ | `data/reconcile_crosswalk.json` + DANAM report |
| R1 | License matrix (OSM / WD / UNESCO / HG) | ✅ | `danam_import/licenses.py` + Methods |
| R2 | Idempotent L1 ETL | ✅ | `LodExternalIdentity` + `import_danam_nq` |
| R3 | L0 immutable named graphs | ✅ | `rdf_load_imported_nq` (refuses PUBLIC) |
| R4 | Competency SPARQL | ✅ | `documentation/research/competency_queries.sparql` |
| R5 | Reject audit (unmapped predicates) | ✅ | `corpus_fingerprint --reject-audit-json` |
| C1 | CARE-aware SPARQL filter | ✅ | `CARESparqlProxyView` |
| C2 | DataSource CARE / TK fields | ✅ | model + importer notes |
| C3 | Community review for new claims | ✅ | epistemic review queue |
| C4 | Community consent / authority agreement | 🔴 | **none obtained** — see [`ETHICS_AND_CONSENT.md`](./ETHICS_AND_CONSENT.md) §5 |
| C5 | Contributor privacy notice + leaderboard opt-out | 🔴 | not implemented — see ethics doc §3 |
| C6 | Institutional ethics review | 🔴 | not obtained |
| P1 | Named-graph provenance (L0) | ✅ | OSM / WD / UNESCO / crosswalk graphs |
| P2 | DataSource + PROV on L1 assertions | ✅ | `HeritageAssertion.source` / confidence |
| P3 | Integrity gate | ✅ | `kg_rigor_audit` (incl. L0 isolation) |
| P4 | No L0 IRIs in PUBLIC | ✅ | rigor HARD + `kg_verify` / purge |
| H1 | L1 editable under revision semantics | ✅ | contribute / improve |
| H2 | Museum/Atlas live = curated only | ✅ | `publication_policy` |

## Reproduce a methods-grade local check

```bash
cd heritage_graph
DJANGO_ENV=development ../.venv/bin/python manage.py corpus_fingerprint \
  --report-json ../documentation/research/_fingerprint.local.json \
  --reject-audit-json ../documentation/research/_reject_audit.local.json

DJANGO_ENV=development ../.venv/bin/python manage.py rdf_load_imported_nq --dry-run
DJANGO_ENV=development ../.venv/bin/python manage.py import_danam_nq --dry-run --limit 20
DJANGO_ENV=development ../.venv/bin/python manage.py kg_rigor_audit
```

Do **not** commit `_fingerprint.local.json` / `_reject_audit.local.json` (local artifacts).

## Remaining for the paper package (not code)

1. Mint Zenodo DOI; add the `doi:` key to `CITATION.cff` and the identifier to
   `.zenodo.json` / Methods. Both files deliberately carry **no** DOI until the
   deposit exists — a placeholder identifier propagates into bibliographies.
2. Deposit `danam-heritagegraph.nq` with the pinned SHA-256 from `corpus_fingerprint`.
3. Enable SHACL-on-write in staging; attach sample conformance report (≥100 shapes).
4. Expert gold-standard evaluation (`kg_evaluate`). No reportable evaluation
   exists: `evaluation/gold/` holds only the format example, and `kg_evaluate`
   now marks any such run `reportable: false`. Needs ≥30 independently
   double-annotated entities with inter-annotator agreement recorded.
5. Bulk-apply the DANAM L1 import. The live public graph is a small fraction of
   the 130,286-quad corpus described in the DANAM report; a reviewer querying
   `/sparql/` sees the live graph, not the report.
6. Complete the community consent process and ethics review before any
   culturally sensitive class is published — [`ETHICS_AND_CONSENT.md`](./ETHICS_AND_CONSENT.md) §5.
