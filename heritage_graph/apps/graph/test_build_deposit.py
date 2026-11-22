"""A dataset deposit is complete, exact RDF, and checksummed."""

import json
import tempfile
from io import StringIO
from pathlib import Path

from apps.cidoc_data.models import Deity
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

_TMP = tempfile.mkdtemp(prefix="hg_deposit_")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",
    RDF_QUERY_URL="",
)
class BuildDepositTest(TestCase):
    def test_deposit_round_trips_and_detects_tampering(self):
        from pyoxigraph import Literal, RdfFormat, parse

        with self.captureOnCommitCallbacks(execute=True):
            Deity.objects.create(
                name="Vishnu",
                labels={"ne": "विष्णु"},
                note="First line.\nSecond line.",
                status="accepted",
                source_citation="A book.",
            )
        out = Path(tempfile.mkdtemp()) / "deposit"
        call_command(
            "build_deposit", output_dir=out, dataset_version="9.9.9", stdout=StringIO()
        )

        for rel in (
            "README.md",
            "LICENSE-DATA",
            "zenodo.json",
            "SHA256SUMS",
            "manifest.json",
            "reports/competency-queries.json",
        ):
            self.assertTrue((out / rel).is_file(), rel)
        quads = list(
            parse(
                path=str(out / "data/heritagegraph-public.nq"), format=RdfFormat.N_QUADS
            )
        )
        literals = [q.object for q in quads if isinstance(q.object, Literal)]
        self.assertIn("ne", {lit.language for lit in literals})
        self.assertIn("First line.\nSecond line.", {lit.value for lit in literals})

        manifest = json.loads((out / "manifest.json").read_text())
        self.assertEqual(manifest["version"], "9.9.9")
        self.assertEqual(
            json.loads((out / "zenodo.json").read_text())["license"], "cc-by-4.0"
        )
        call_command("build_deposit", check=out, stdout=StringIO())

        (out / "README.md").write_text("tampered")
        with self.assertRaises(CommandError):
            call_command("build_deposit", check=out, stdout=StringIO())


class CompetencyQueryParseTest(TestCase):
    def test_every_question_is_parsed_with_its_graphs(self):
        from apps.graph.management.commands.run_competency_queries import (
            QUERIES,
            parse,
        )

        questions = parse(QUERIES.read_text())
        self.assertEqual([q["id"] for q in questions], [f"CQ{i}" for i in range(1, 11)])
        for q in questions:
            self.assertIn("PREFIX rdf:", q["sparql"])
            self.assertNotIn("\n# ", q["sparql"])
