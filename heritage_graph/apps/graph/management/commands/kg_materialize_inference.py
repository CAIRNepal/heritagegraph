"""Materialize OWL-RL inferences into graph/inferred and report novelty rate."""

from __future__ import annotations

import json

from apps.graph.kg_engine.inference import materialize_inferred_graph
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Run owlrl expansion on public+schema graphs; store the "
        "non-tautological triples in graph/inferred."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="",
            help="Write InferenceReport JSON to this path.",
        )

    def handle(self, *args, **options):
        report = materialize_inferred_graph()
        payload = {
            "input_triples": report.input_triples,
            "inferred_triples": report.inferred_triples,
            "novel_triples": report.novel_triples,
            "tautological_triples": report.tautological_triples,
            "novelty_rate": report.novelty_rate,
            "novelty_rate_definition": (
                "novel_triples / inferred_triples, where novel excludes "
                "universal-class membership, reflexive identity/subsumption, "
                "and closure over the RDF/RDFS/OWL/XSD vocabularies"
            ),
            "consistency_violations": report.consistency_violations,
            "stored": report.stored,
        }
        text = json.dumps(payload, indent=2)
        self.stdout.write(text)
        if options["output"]:
            with open(options["output"], "w", encoding="utf-8") as fh:
                fh.write(text)
        if report.stored:
            self.stdout.write(self.style.SUCCESS("Inferred graph updated."))
        else:
            self.stdout.write(
                self.style.WARNING(
                    "Inferred graph not stored (RDF_SYNC off or empty)."
                )
            )
