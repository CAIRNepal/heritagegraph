"""Score two independent annotations of the same sample.

    manage.py score_annotations A.csv B.csv --output-dir DIR

writes ``agreement.json`` (observed agreement and Cohen's kappa over the
judgements both annotators made) and ``adjudication.csv`` (the rows they
disagreed on, for a third person to settle in a ``final`` column).

    manage.py score_annotations A.csv B.csv \
        --adjudicated adjudication.csv --output-dir DIR

additionally writes ``precision.json`` — the share of judged statements that
are correct, overall and per record type — and ``gold-entities.json`` in the
format ``kg_evaluate`` reads. Rows marked ``unsure`` by the final judgement
count towards neither side and are reported separately.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

LABELS = ("correct", "incorrect", "unsure")
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


def _read(path: Path) -> dict[str, dict]:
    with path.open(newline="", encoding="utf-8") as fh:
        return {row["row_id"]: row for row in csv.DictReader(fh)}


def cohen_kappa(pairs: list[tuple[str, str]]) -> float | None:
    """Cohen's kappa for two raters over the same items."""
    n = len(pairs)
    if n == 0:
        return None
    observed = sum(a == b for a, b in pairs) / n
    left = Counter(a for a, _ in pairs)
    right = Counter(b for _, b in pairs)
    expected = sum(left[k] * right[k] for k in set(left) | set(right)) / (n * n)
    if expected == 1:
        return 1.0
    return round((observed - expected) / (1 - expected), 4)


def agreement(a: dict, b: dict) -> tuple[dict, list[dict]]:
    if set(a) != set(b):
        raise CommandError("The two sheets do not cover the same rows.")
    pairs, disagreements, skipped = [], [], 0
    for rid in sorted(a, key=int):
        ja, jb = (
            a[rid]["judgement"].strip().lower(),
            b[rid]["judgement"].strip().lower(),
        )
        if ja not in LABELS or jb not in LABELS:
            skipped += 1
            continue
        pairs.append((ja, jb))
        if ja != jb:
            disagreements.append(
                {**a[rid], "judgement_A": ja, "judgement_B": jb, "final": ""}
            )
    report = {
        "rows": len(a),
        "judged_by_both": len(pairs),
        "not_judged_by_both": skipped,
        "observed_agreement": round(sum(x == y for x, y in pairs) / len(pairs), 4)
        if pairs
        else None,
        "cohen_kappa": cohen_kappa(pairs),
        "disagreements": len(disagreements),
    }
    return report, disagreements


def final_judgements(a: dict, b: dict, adjudicated: dict | None) -> dict[str, str]:
    out = {}
    for rid in a:
        ja, jb = (
            a[rid]["judgement"].strip().lower(),
            b[rid]["judgement"].strip().lower(),
        )
        if ja == jb and ja in LABELS:
            out[rid] = ja
        elif adjudicated and rid in adjudicated:
            final = adjudicated[rid].get("final", "").strip().lower()
            if final in LABELS:
                out[rid] = final
    return out


def precision(rows: dict, finals: dict) -> dict:
    per_type = defaultdict(Counter)
    for rid, verdict in finals.items():
        per_type[rows[rid]["record_type"]][verdict] += 1
    total = Counter()
    for c in per_type.values():
        total.update(c)

    def share(c: Counter):
        judged = c["correct"] + c["incorrect"]
        return round(c["correct"] / judged, 4) if judged else None

    return {
        "statements_with_final_judgement": sum(total.values()),
        "statements_without": len(rows) - sum(total.values()),
        "counts": dict(total),
        "precision": share(total),
        "per_type": {
            t: {"counts": dict(c), "precision": share(c)}
            for t, c in sorted(per_type.items())
        },
    }


def gold_entities(rows: dict, finals: dict, sample_path: Path | None) -> list[dict]:
    """Correct statements become expected types and triples for kg_evaluate."""
    by_iri = defaultdict(lambda: {"types": set(), "triples": set()})
    for rid, verdict in finals.items():
        if verdict != "correct":
            continue
        r = rows[rid]
        value = r.get("corrected_value") or r["value"]
        if r["predicate"] == RDF_TYPE:
            by_iri[r["record_iri"]]["types"].add(value)
        elif value.startswith(("http://", "https://")):
            by_iri[r["record_iri"]]["triples"].add((r["predicate"], value))
    keys = {}
    if sample_path and sample_path.is_file():
        from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model
        from django.apps import apps

        for rec in json.loads(sample_path.read_text())["records"]:
            model = apps.get_model("cidoc_data", rec["model"])
            keys[rec["iri"]] = (registry_class_key_for_model(model), rec["pk"])
    out = []
    for iri, g in sorted(by_iri.items()):
        key, pk = keys.get(iri, (None, None))
        if key is None:
            continue
        out.append(
            {
                "registry_key": key,
                "pk": pk,
                "expected_types": sorted(g["types"]),
                "expected_triples": sorted([list(t) for t in g["triples"]]),
            }
        )
    return out


class Command(BaseCommand):
    help = "Agreement between two annotators; precision and gold after adjudication."

    def add_arguments(self, parser):
        parser.add_argument("sheet_a", type=Path)
        parser.add_argument("sheet_b", type=Path)
        parser.add_argument("--adjudicated", type=Path)
        parser.add_argument("--sample", type=Path, help="sample.json from the draw.")
        parser.add_argument("--output-dir", type=Path, required=True)

    def handle(self, *args, **opts):
        a, b = _read(opts["sheet_a"]), _read(opts["sheet_b"])
        out: Path = opts["output_dir"]
        out.mkdir(parents=True, exist_ok=True)
        report, disagreements = agreement(a, b)
        (out / "agreement.json").write_text(json.dumps(report, indent=2) + "\n")
        if disagreements:
            with (out / "adjudication.csv").open(
                "w", newline="", encoding="utf-8"
            ) as fh:
                writer = csv.DictWriter(fh, fieldnames=list(disagreements[0]))
                writer.writeheader()
                writer.writerows(disagreements)
        self.stdout.write(
            f"agreement {report['observed_agreement']}, "
            f"kappa {report['cohen_kappa']} over "
            f"{report['judged_by_both']} rows; {report['disagreements']} to adjudicate"
        )
        if not opts["adjudicated"] and disagreements:
            return
        adjudicated = _read(opts["adjudicated"]) if opts["adjudicated"] else None
        finals = final_judgements(a, b, adjudicated)
        prec = precision(a, finals)
        (out / "precision.json").write_text(json.dumps(prec, indent=2) + "\n")
        gold = gold_entities(a, finals, opts["sample"])
        (out / "gold-entities.json").write_text(json.dumps(gold, indent=2) + "\n")
        self.stdout.write(
            f"precision {prec['precision']} over "
            f"{prec['statements_with_final_judgement']} "
            f"statements; {len(gold)} gold entities written"
        )
