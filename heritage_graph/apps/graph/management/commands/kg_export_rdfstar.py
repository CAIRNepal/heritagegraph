"""Export RDF-star style provenance annotations (TriG)."""

from __future__ import annotations

from pathlib import Path

from apps.graph.kg_engine.rdfstar_export import export_rdfstar_trig
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Write TriG with quoted-triple provenance annotations for relationship assertions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="",
            help="Output file (default: ontology/lod/annotations.trig).",
        )

    def handle(self, *args, **options):
        path = Path(
            options["output"]
            or (Path(settings.BASE_DIR).parent / "ontology" / "lod" / "annotations.trig")
        )
        n = export_rdfstar_trig(path)
        self.stdout.write(self.style.SUCCESS(f"Wrote {n} annotated triples to {path}"))
