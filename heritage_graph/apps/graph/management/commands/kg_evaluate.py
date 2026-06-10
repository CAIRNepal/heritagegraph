"""Evaluate the projected knowledge graph against an expert gold standard.

Computes precision / recall / F1 for:
  * type assignment   — did each gold entity receive its expected rdf:type(s)?
  * relationship edges — predicate/object triples vs. expected_triples (if given)
  * external alignment — skos:exactMatch targets vs. expected (alignments gold)

Gold format — ``evaluation/gold/entities.json`` (falls back to the sample):
    [ { "registry_key": "structure", "pk": 1,
        "expected_types": ["http://www.cidoc-crm.org/cidoc-crm/E22_Human-Made_Object"],
        "expected_triples": [["<predicateIRI>", "<objectIRI>"], ...] } ]

Optional ``evaluation/gold/alignments.json``:
    [ { "registry_key": "deity", "pk": 3,
        "expected_exact_match": ["http://www.wikidata.org/entity/Q..."] } ]

Usage:
    python manage.py kg_evaluate
    python manage.py kg_evaluate --gold evaluation/gold/entities.json --output evaluation/reports/evaluation.json
"""

from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
EXACT_MATCH = "http://www.w3.org/2004/02/skos/core#exactMatch"


def _prf(tp: int, fp: int, fn: int) -> dict:
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    if precision and recall:
        f1 = 2 * precision * recall / (precision + recall)
    elif precision is not None and recall is not None:
        f1 = 0.0
    else:
        f1 = None
    return {
        "precision": round(precision, 4) if precision is not None else None,
        "recall": round(recall, 4) if recall is not None else None,
        "f1": round(f1, 4) if f1 is not None else None,
        "tp": tp,
        "fp": fp,
        "fn": fn,
    }


class Command(BaseCommand):
    help = "Evaluate the projected KG against the gold standard (precision/recall/F1)."

    def add_arguments(self, parser):
        parser.add_argument("--gold", default="evaluation/gold/entities.json")
        parser.add_argument("--alignments", default="evaluation/gold/alignments.json")
        parser.add_argument("--output", default="evaluation/reports/evaluation.json")

    def _resolve_gold(self, root: Path, rel: str) -> Path | None:
        path = root / rel
        if path.is_file():
            return path
        sample = path.with_name(path.stem + ".sample" + path.suffix)
        if sample.is_file():
            self.stdout.write(self.style.WARNING(f"  {rel} not found — using {sample.name}"))
            return sample
        return None

    def handle(self, *args, **opts):
        from apps.graph.kg_engine.engine import get_kg_engine
        from apps.graph.kg_engine.partitions import GraphPartition
        from apps.graph.kg_engine.uris import resource_base

        root = Path(settings.BASE_DIR).parent
        gold_path = self._resolve_gold(root, opts["gold"])
        if not gold_path:
            self.stderr.write(self.style.ERROR(f"No gold file at {opts['gold']} (or .sample)."))
            return

        gold = json.loads(gold_path.read_text(encoding="utf-8"))
        engine = get_kg_engine()
        public = GraphPartition.PUBLIC.uri()
        base = resource_base().rstrip("/")

        type_tp = type_fp = type_fn = 0
        triple_tp = triple_fp = triple_fn = 0
        entities_with_expected_type = entities_typed_correctly = 0
        per_entity: list[dict] = []

        for g in gold:
            rk, pk = g.get("registry_key"), g.get("pk")
            if rk is None or pk is None:
                continue
            uri = f"{base}/{rk}/{pk}"
            rows = engine.query(
                f"SELECT ?p ?o WHERE {{ GRAPH <{public}> {{ <{uri}> ?p ?o }} }}"
            )
            actual_types = {r["o"] for r in rows if r.get("p") == RDF_TYPE}
            actual_triples = {(r.get("p"), r.get("o")) for r in rows if r.get("p") != RDF_TYPE}
            ent: dict = {"uri": uri, "registry_key": rk, "pk": pk, "found": bool(rows)}

            if "expected_types" in g:
                exp = set(g["expected_types"])
                tp = len(exp & actual_types)
                fp = len(actual_types - exp)
                fn = len(exp - actual_types)
                # Multi-typing is legitimate, so we report type *recall* as the
                # headline (did the entity get the expected type) plus exact-set match.
                type_tp += tp
                type_fp += fp
                type_fn += fn
                entities_with_expected_type += 1
                if exp <= actual_types:
                    entities_typed_correctly += 1
                ent["types"] = {
                    "expected": sorted(exp),
                    "actual": sorted(actual_types),
                    "matched": exp <= actual_types,
                }

            if "expected_triples" in g:
                exp_t = {tuple(t) for t in g["expected_triples"]}
                tp = len(exp_t & actual_triples)
                fp = len(actual_triples - exp_t)
                fn = len(exp_t - actual_triples)
                triple_tp += tp
                triple_fp += fp
                triple_fn += fn
                ent["triples"] = {"tp": tp, "fp": fp, "fn": fn}

            per_entity.append(ent)

        report: dict = {
            "gold_file": str(gold_path.relative_to(root)),
            "gold_entities": len(gold),
            "entities_found_in_graph": sum(1 for e in per_entity if e["found"]),
            "type_assignment": {
                **_prf(type_tp, type_fp, type_fn),
                "exact_set_match_rate": (
                    round(entities_typed_correctly / entities_with_expected_type, 4)
                    if entities_with_expected_type
                    else None
                ),
            },
            "relationship_triples": _prf(triple_tp, triple_fp, triple_fn),
        }

        # External alignment (optional)
        align_path = self._resolve_gold(root, opts["alignments"])
        if align_path:
            align = json.loads(align_path.read_text(encoding="utf-8"))
            a_tp = a_fp = a_fn = 0
            for g in align:
                rk, pk = g.get("registry_key"), g.get("pk")
                if rk is None or pk is None:
                    continue
                uri = f"{base}/{rk}/{pk}"
                rows = engine.query(
                    f"SELECT ?o WHERE {{ GRAPH <{public}> {{ <{uri}> <{EXACT_MATCH}> ?o }} }}"
                )
                actual = {r["o"] for r in rows}
                exp = set(g.get("expected_exact_match", []))
                a_tp += len(exp & actual)
                a_fp += len(actual - exp)
                a_fn += len(exp - actual)
            report["external_alignment"] = _prf(a_tp, a_fp, a_fn)

        out = root / opts["output"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({**report, "per_entity": per_entity}, indent=2) + "\n", encoding="utf-8")

        self.stdout.write(self.style.MIGRATE_HEADING("KG evaluation vs gold standard"))
        self.stdout.write(json.dumps({k: v for k, v in report.items() if k != "per_entity"}, indent=2))
        self.stdout.write(self.style.SUCCESS(f"\nWrote {out}"))
        if report["gold_entities"] < 30:
            self.stdout.write(
                self.style.WARNING(
                    f"\n⚠ Gold set has only {report['gold_entities']} entities — expand "
                    "evaluation/gold/entities.json to a statistically meaningful, "
                    "independently double-annotated sample before reporting these numbers."
                )
            )
