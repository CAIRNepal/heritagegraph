"""Draw a stratified sample of published records for expert annotation.

Writes, into ``--output-dir``:

* ``annotator-A.csv`` and ``annotator-B.csv`` — identical sheets, one row per
  statement the public graph makes about each sampled record (types, labels,
  links, dates, coordinates), with the record's cited source. Each annotator
  fills ``judgement`` (correct / incorrect / unsure) independently.
* ``sample.json`` — the sampled records and the seed, so the draw is
  reproducible.
* ``INSTRUCTIONS.md`` — what to judge and how.

Then ``score_annotations`` computes agreement and, after adjudication, the
graph's precision and the gold file ``kg_evaluate`` reads.
"""

from __future__ import annotations

import csv
import json
import random
from collections import defaultdict
from pathlib import Path

from apps.cidoc_data.publication_policy import is_published_for_rdf
from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.uris import resource_uri_for_instance
from django.apps import apps
from django.core.management.base import BaseCommand, CommandError

COLUMNS = [
    "row_id",
    "record_iri",
    "record_label",
    "record_type",
    "predicate",
    "value",
    "value_label",
    "cited_source",
    "judgement",
    "corrected_value",
    "note",
]

# Bookkeeping the annotators cannot judge against a source.
SKIP_PREDICATES = {
    "https://cair-nepal.org/heritagegraph/access_tier",
    "http://www.w3.org/2002/07/owl#sameAs",
}

INSTRUCTIONS = """# Annotating the HeritageGraph sample

Each row is one statement the public graph makes about a record. Judge it
against your own expertise and any source you trust, **without consulting the
other annotator**.

- `judgement`: `correct`, `incorrect` or `unsure`.
- `corrected_value`: if incorrect, what it should be (optional).
- `note`: your source or reasoning (encouraged for `incorrect`).

Judge the claim, not its wording: a label in a different but accepted
transliteration is `correct`; a temple linked to the wrong district is
`incorrect`. Mark `unsure` rather than guess. `cited_source` is what the
platform cites; it is context, not the answer.
"""


def _published_records():
    from apps.cidoc_data.models import MetaData

    by_type = defaultdict(list)
    for model in apps.get_app_config("cidoc_data").get_models():
        if not issubclass(model, MetaData) or model is MetaData or model._meta.abstract:
            continue
        for row in model.objects.all():
            if is_published_for_rdf(row):
                by_type[model.__name__].append(row)
    return by_type


def _stratified(by_type: dict, size: int, seed: int) -> list:
    rng = random.Random(seed)
    total = sum(len(v) for v in by_type.values())
    if total == 0:
        raise CommandError("No published records to sample.")
    picked = []
    for name in sorted(by_type):
        rows = sorted(by_type[name], key=lambda r: r.pk)
        share = max(2, round(size * len(rows) / total))
        picked.extend(rng.sample(rows, min(share, len(rows))))
    rng.shuffle(picked)
    return picked


def _statements(uri: str) -> list[dict]:
    public = GraphPartition.PUBLIC.uri()
    rows = get_kg_engine().store.select(
        "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
        f"SELECT ?p ?o ?ol WHERE {{ GRAPH <{public}> {{ <{uri}> ?p ?o . "
        "OPTIONAL { ?o rdfs:label ?ol } } } ORDER BY ?p ?o"
    )
    seen, out = set(), []
    for r in rows:
        key = (r.get("p"), r.get("o"))
        if key in seen or r.get("p") in SKIP_PREDICATES:
            continue
        seen.add(key)
        out.append(
            {
                "predicate": r.get("p", ""),
                "value": r.get("o", ""),
                "value_label": r.get("ol", ""),
            }
        )
    return out


class Command(BaseCommand):
    help = "Draw a stratified sample of published records for expert annotation."

    def add_arguments(self, parser):
        parser.add_argument("--output-dir", type=Path, required=True)
        parser.add_argument("--size", type=int, default=40)
        parser.add_argument("--seed", type=int, default=20261122)

    def handle(self, *args, **opts):
        out: Path = opts["output_dir"]
        out.mkdir(parents=True, exist_ok=True)
        records = _stratified(_published_records(), opts["size"], opts["seed"])
        rows, sample = [], []
        for record in records:
            uri = resource_uri_for_instance(record)
            label = (
                getattr(record, "name", None)
                or getattr(record, "title", "")
                or str(record)
            )
            source = (
                record.source.name if getattr(record, "source", None) else ""
            ) or (record.source_citation or "")
            sample.append(
                {
                    "model": type(record).__name__,
                    "pk": record.pk,
                    "iri": uri,
                    "label": label,
                }
            )
            for st in _statements(uri):
                rows.append(
                    {
                        "row_id": len(rows) + 1,
                        "record_iri": uri,
                        "record_label": label,
                        "record_type": type(record).__name__,
                        **st,
                        "cited_source": source,
                        "judgement": "",
                        "corrected_value": "",
                        "note": "",
                    }
                )
        for name in ("annotator-A.csv", "annotator-B.csv"):
            with (out / name).open("w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=COLUMNS)
                writer.writeheader()
                writer.writerows(rows)
        (out / "sample.json").write_text(
            json.dumps(
                {"seed": opts["seed"], "size": opts["size"], "records": sample},
                indent=2,
            )
            + "\n"
        )
        (out / "INSTRUCTIONS.md").write_text(INSTRUCTIONS)
        types = sorted({s["model"] for s in sample})
        self.stdout.write(
            f"{len(sample)} records across {len(types)} types, {len(rows)} statements "
            f"to judge, written to {out}"
        )
