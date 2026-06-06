"""Materialize OWL-RL inferences into graph/inferred and report novelty rate."""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand

from apps.graph.kg_engine.inference import materialize_inferred_graph


class Command(BaseCommand):
    help = "Run owlrl expansion on public+schema graphs; store novel triples in graph/inferred."

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
            "novelty_rate": report.novelty_rate,
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
            self.stdout.write(self.style.WARNING("Inferred graph not stored (RDF_SYNC off or empty)."))
