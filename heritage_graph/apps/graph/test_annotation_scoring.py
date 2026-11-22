"""Agreement and precision from two annotation sheets."""

import csv
import json
import tempfile
from io import StringIO
from pathlib import Path

from apps.graph.management.commands.prepare_annotation_sample import COLUMNS
from apps.graph.management.commands.score_annotations import cohen_kappa
from django.core.management import call_command
from django.test import SimpleTestCase

TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


def _sheet(path: Path, judgements: list[str]):
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        for i, j in enumerate(judgements, start=1):
            w.writerow(
                {
                    "row_id": i,
                    "record_iri": "https://cair-nepal.org/heritagegraph/resource/deity/1",
                    "record_label": "Vishnu",
                    "record_type": "Deity",
                    "predicate": TYPE
                    if i == 1
                    else "https://cair-nepal.org/heritagegraph/p",
                    "value": f"https://example.org/{i}",
                    "judgement": j,
                }
            )


class CohenKappaTest(SimpleTestCase):
    def test_known_values(self):
        self.assertEqual(cohen_kappa([("a", "a"), ("b", "b")]), 1.0)
        # 20 items: both yes 10, both no 5, A-yes/B-no 3, A-no/B-yes 2
        # p_o = 0.75, p_e = (13*12 + 7*8)/400 = 0.53, kappa = 0.4681
        pairs = (
            [("y", "y")] * 10 + [("n", "n")] * 5 + [("y", "n")] * 3 + [("n", "y")] * 2
        )
        self.assertEqual(cohen_kappa(pairs), 0.4681)
        self.assertIsNone(cohen_kappa([]))


class ScoreAnnotationsTest(SimpleTestCase):
    def test_agreement_then_adjudicated_precision(self):
        d = Path(tempfile.mkdtemp())
        _sheet(d / "A.csv", ["correct", "correct", "incorrect", "unsure"])
        _sheet(d / "B.csv", ["correct", "incorrect", "incorrect", "unsure"])
        call_command(
            "score_annotations",
            d / "A.csv",
            d / "B.csv",
            output_dir=d,
            stdout=StringIO(),
        )
        agreement = json.loads((d / "agreement.json").read_text())
        self.assertEqual(agreement["judged_by_both"], 4)
        self.assertEqual(agreement["disagreements"], 1)
        self.assertFalse((d / "precision.json").exists())  # waits for adjudication

        with (d / "adjudication.csv").open(newline="", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        rows[0]["final"] = "correct"
        with (d / "adj.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        call_command(
            "score_annotations",
            d / "A.csv",
            d / "B.csv",
            adjudicated=d / "adj.csv",
            output_dir=d,
            stdout=StringIO(),
        )
        prec = json.loads((d / "precision.json").read_text())
        # 2 correct, 1 incorrect, 1 unsure (excluded): precision 2/3
        self.assertEqual(prec["counts"], {"correct": 2, "incorrect": 1, "unsure": 1})
        self.assertEqual(prec["precision"], 0.6667)
