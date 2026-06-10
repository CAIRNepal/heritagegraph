# HeritageGraph evaluation harness (Phase 1)

## Gold subset

Place expert-annotated JSON under `evaluation/gold/`:

- `entities.json` — list of `{ "registry_key", "pk", "expected_triples": [...] }`
- `alignments.json` — list of `{ "cluster_id", "expected_same_as": ["https://www.wikidata.org/entity/Q..."] }`

## Commands

```bash
# Precision / recall / F1 vs the gold standard (type assignment, triples, alignment)
python manage.py kg_evaluate \
    --gold evaluation/gold/entities.json \
    --alignments evaluation/gold/alignments.json \
    --output evaluation/reports/evaluation.json

python manage.py kg_quality_report --output evaluation/reports/latest.json
python manage.py kg_verify
python manage.py rdf_export_dump --output-dir ontology/lod/dumps
python3 tools/emit_skos_vocabularies.py
python manage.py test apps.cidoc_data.tests
```

## Metrics reported

See `kg_quality_report` for: triple counts, dangling edges, assertion acceptance rate, external identifier coverage, inferred graph size.

## Phase 3 evaluation

```bash
python manage.py kg_materialize_inference --output evaluation/reports/inference.json
# Report novelty_rate for papers (target: document % non-tautological inferences)
python manage.py kg_export_linkset
python manage.py kg_export_nanopubs --output-dir ontology/lod/nanopubs
```
