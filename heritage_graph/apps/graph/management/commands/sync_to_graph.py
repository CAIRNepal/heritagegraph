from __future__ import annotations

import logging

from django.core.management.base import BaseCommand

from apps.graph.client import graph_client
from apps.graph.serializers import (
    architectural_structure_to_triples,
    person_to_triples,
    triples_to_nt,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Bulk-sync Django CIDOC instances to Oxigraph (SPARQL INSERT DATA)"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0, help="Optional limit per model")

    def handle(self, *args, **options):
        if not graph_client.health():
            self.stdout.write(
                self.style.ERROR("Oxigraph is not reachable. Check OXIGRAPH_URL / container health.")
            )
            return

        limit = int(options.get("limit") or 0)

        from apps.cidoc_data.models import ArchitecturalStructure, Person

        model_jobs = [
            ("Person", Person.objects.select_related("contributor").all(), person_to_triples),
            (
                "ArchitecturalStructure",
                ArchitecturalStructure.objects.select_related("contributor").all(),
                architectural_structure_to_triples,
            ),
        ]

        for label, qs, fn in model_jobs:
            synced = 0
            errors = 0
            for instance in (qs[:limit] if limit else qs).iterator():
                try:
                    _uri, triples = fn(instance)
                    graph_client.insert_data(triples_to_nt(triples))
                    synced += 1
                except Exception as exc:
                    errors += 1
                    logger.exception("Graph sync failed for %s id=%s: %s", label, instance.pk, exc)

            self.stdout.write(self.style.SUCCESS(f"[{label}] synced={synced} errors={errors}"))

