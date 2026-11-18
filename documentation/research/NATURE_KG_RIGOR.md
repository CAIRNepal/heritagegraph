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
| A3 | Demo vs live corpus labeled | ✅ | Atlas `SampleDataBanner` (always visible) + `?source=` + Methods limitations. See [Sample corpus policy](#sample-corpus-policy). |
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
| P2 | DataSource + PROV on L1 assertions | 🟡 | **Required for new records**: a record cannot be accepted without `source` or `source_citation`, and links from the contribute forms are published only as `relationship.*` assertions citing a registered DataSource with the contributor's stated confidence. Every accepted assertion states its confidence (no default). Older records were audited with `audit_provenance`. **Not yet**: `HeritageAssertion.source` is still nullable outside the forms, and SHACL-on-write is off. See [Source coverage](#source-coverage). |
| P3 | Integrity gate | ✅ | `kg_rigor_audit` (incl. L0 isolation) |
| P4 | No L0 IRIs in PUBLIC | ✅ | rigor HARD + `kg_verify` / purge |
| H1 | L1 editable under revision semantics | ✅ | contribute / improve |
| H2 | Museum/Atlas live = curated only | ✅ | `publication_policy` |

## Source coverage

What is enforced (new contributions):

- **Records.** `accept_contribution` refuses to publish a record that names no
  `source` and no `source_citation` (`registry_slots.require_evidence`); the
  review API answers 400 and the record stays in review. Every contribute form
  asks for the source, its kind and the contributor's confidence before Submit.
- **Links and column-less values.** Registry slots with no column on the record
  are no longer dropped by the serializer. They travel in the revision
  (`_links` / `_values`), are shown to the reviewer by name, and on acceptance
  become `HeritageAssertion` rows citing the record's DataSource (a typed
  citation is registered as one, with the kind the contributor chose) and the
  contributor's stated confidence. A key that is neither a field nor a slot is
  refused with 400. `REGISTRY_MODEL_ALIGNMENT.md` reports 0 silently discarded
  form fields.
- **Review gate on assertions.** A contributor-created assertion is always
  `pending`; only reviewers and admins can create one already accepted.
- **Stated confidence.** `HeritageAssertion.confidence` has no default. An
  accepted assertion must state one of certain / likely / uncertain /
  speculative (model `save()` and `clean()`, the assertion API, the inline
  contribute routes); a pending one may leave it for the reviewer. Forms and
  relationship proposals start with no choice selected. System writers state
  theirs explicitly: identity merges `certain` (a decision, not an estimate),
  Wikidata statements `likely`, seed rows `uncertain`. Values outside the scale
  (seed rows wrote `medium`) were cleared to unstated by migration 0024.

What is not (yet):

- Records and assertions published **before** this enforcement keep whatever
  provenance they had. `manage.py audit_provenance` measures it, counting
  records, claims and identity bookkeeping separately (bookkeeping says which
  records are the same, not anything about heritage). Quote its figures, and
  `kg_quality_report` → `entity_source_coverage` /
  `provenance_coverage.with_registered_source`, rather than asserting coverage.
- Repairs that invent nothing: `--backfill-wikidata` points Wikidata cluster
  memberships at the Wikidata source their record cites; `--withdraw --as
  <curator> --manifest <path>` sends unsourced records and claims back to
  review (out of the public graph) and `--restore <path>` undoes it exactly.
- `HeritageAssertion.source` is still nullable on paths other than the
  contribute forms.
- The `AssertionRequiresSource` SHACL shape runs only on project merge, and
  SHACL-on-write is off by default.

What this means for the paper: the accurate claim is that new contributions
are source-backed by construction, and that coverage of the whole graph is
*measured* and reported as a figure, not asserted as a property. Backfilling
or withdrawing the unsourced older records, removing the silent `confidence`
default everywhere, and enabling SHACL-on-write would close the gap.

## Sample corpus policy

The Atlas ships a fictional sample corpus so the interface is explorable before
a deployment has data. It is a demonstration fixture and is governed by three
rules, each enforced in code:

1. **No real attribution.** `data/atlas-agents.ts` and `data/atlas-sources.ts`
   contain only fictional agents ("Sample Researcher A") and citations marked
   `SAMPLE DATA`. They previously named apparently-real Nepali scholars and real
   institutions — Tribhuvan University, the National Museum of Nepal, the Patan
   Museum, the Nepal National Archives — and attributed invented,
   confidence-scored heritage claims to them. Never reintroduce a real person,
   institution, or citation here.
2. **Never shown as live.** Every transition into live mode clears the sample
   corpus (`LIVE_TRANSITION_STATE`), and every live failure path — network
   error, auth error, empty result — clears it too (`EMPTY_LIVE_CORPUS`).
   Previously a failed load left the fictional globe on screen while
   `dataSource` still read `live`.
3. **Always labelled.** `SampleDataBanner` renders at the top of the atlas
   surface whenever the sample corpus is active. It is outside every collapsible
   panel and is not hidden on mobile; the previous indicator was an 11px button
   inside a `hidden md:flex` sidebar.

An empty live graph must look empty. That is the honest signal that the corpus
has not been loaded yet, and it is what a reviewer should see.

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
