# HeritageGraph evaluation harness

## What counts as a result

`kg_evaluate` embeds a `reportable` verdict in every report it writes. A run is
**not** reportable when any of these hold, and the reasons are listed in
`not_reportable_because`:

- the gold file is the `*.sample.json` format example rather than an annotated
  gold standard (the sample is only used when you pass `--allow-sample`);
- the gold set has fewer than 30 entities (`--min-gold` to change the floor);
- none of the gold entities exist in the public graph, which measures the
  projection pipeline rather than extraction quality.

Numbers from a non-reportable run must not appear in a paper, a slide, or the
Methods page. `--require-valid` makes the command exit non-zero so CI can
enforce that.

**Status:** no reportable evaluation exists yet. `evaluation/gold/` currently
holds only the format example. Producing a real gold standard — an independently
double-annotated sample with inter-annotator agreement reported — is outstanding
work, not a code task.

## Gold subset

Place expert-annotated JSON under `evaluation/gold/`:

- `entities.json` — list of `{ "registry_key", "pk", "expected_types": [...],
  "expected_triples": [[predicate, object], ...] }`
- `alignments.json` — list of `{ "registry_key", "pk", "expected_exact_match":
  ["http://www.wikidata.org/entity/Q..."] }`

Annotation requirements for a reportable set:

1. At least 30 entities (more for per-class breakdowns).
2. Two annotators working independently, with disagreements adjudicated.
3. Inter-annotator agreement (Cohen's κ) recorded alongside the set.
4. Entities sampled from the corpus you are reporting on, not hand-picked.

## Commands

```bash
# Precision / recall / F1 vs the gold standard (types, triples, alignment)
python manage.py kg_evaluate \
    --gold evaluation/gold/entities.json \
    --alignments evaluation/gold/alignments.json \
    --output evaluation/reports/evaluation.json \
    --require-valid

python manage.py kg_quality_report --output evaluation/reports/latest.json
python manage.py kg_verify
python manage.py rdf_export_dump --output-dir ontology/lod/dumps
python3 tools/emit_skos_vocabularies.py
python manage.py test apps.cidoc_data.tests
```

Reports under `evaluation/reports/` are generated artifacts and are gitignored:
they describe one machine at one moment, and a committed copy invites a stale
run being quoted as a result. Publish the reportable run with the Zenodo
deposit.

## Metrics reported

`kg_quality_report`: triple counts, dangling edges, assertion acceptance rate,
external identifier coverage, inferred graph size, SHACL-on-write state.

`kg_materialize_inference` reports:

- `inferred_triples` — everything OWL-RL derived that was not already asserted.
- `novel_triples` — the subset that is **non-tautological**: excludes
  universal-class membership (`owl:Thing`, `rdfs:Resource`), reflexive
  identity/subsumption (`x owl:sameAs x`), and closure over the RDF/RDFS/OWL/XSD
  vocabularies.
- `novelty_rate` — `novel_triples / inferred_triples`.

Only the filtered, informative triples are written to `graph/inferred`. Note
that a rate of exactly 1.0 previously indicated a broken metric rather than a
perfect one: derived-over-derived is 1.0 by construction.

## Phase 3

```bash
python manage.py kg_materialize_inference --output evaluation/reports/inference.json
python manage.py kg_export_linkset
python manage.py kg_export_nanopubs --output-dir ontology/lod/nanopubs
```
