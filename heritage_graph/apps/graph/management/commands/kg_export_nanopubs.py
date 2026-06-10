"""Export accepted assertions as nanopublication TriG files."""

from __future__ import annotations

from pathlib import Path

from apps.graph.kg_engine.nanopub_export import export_nanopubs
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Write one TriG nanopublication per accepted HeritageAssertion."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            default="",
            help="Default: <repo>/ontology/lod/nanopubs/",
        )

    def handle(self, *args, **options):
        out = Path(
            options["output_dir"]
            or (Path(settings.BASE_DIR).parent / "ontology" / "lod" / "nanopubs")
        )
        n = export_nanopubs(out)
        self.stdout.write(self.style.SUCCESS(f"Exported {n} nanopublications to {out}"))
