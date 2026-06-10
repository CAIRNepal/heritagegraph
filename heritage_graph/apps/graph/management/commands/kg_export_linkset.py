"""Generate VoID linkset TTL for Wikidata / external authority alignments."""

from __future__ import annotations

from pathlib import Path

from apps.graph.kg_engine.linkset_export import write_linkset
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Write linkset TTL from EntityCluster.external_identifiers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="",
            help="Output path (default: ontology/lod/linkset.ttl).",
        )

    def handle(self, *args, **options):
        path = Path(
            options["output"]
            or (Path(settings.BASE_DIR).parent / "ontology" / "lod" / "linkset.ttl")
        )
        write_linkset(path)
        self.stdout.write(self.style.SUCCESS(f"Wrote {path}"))
