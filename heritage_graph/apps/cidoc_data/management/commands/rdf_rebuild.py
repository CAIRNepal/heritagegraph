"""Rebuild the public RDF graph from all CIDOC MetaData rows in PostgreSQL."""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.cidoc_data.rdf_publish import public_graph_uri
from apps.cidoc_data.rdf_signals import project_all_metadata_instances, rdf_sync_enabled


class Command(BaseCommand):
    help = (
        "Project every CIDOC MetaData row into the public RDF graph "
        "(idempotent per-subject replace)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report configuration only; do not write triples.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("RDF rebuild"))
        self.stdout.write(f"  RDF_SYNC_ENABLED      = {rdf_sync_enabled()}")
        self.stdout.write(
            f"  RDF_ENDPOINT_URL      = {getattr(settings, 'RDF_ENDPOINT_URL', '') or '<local pyoxigraph>'}"
        )
        self.stdout.write(f"  RDF_PUBLIC_GRAPH_URI  = {public_graph_uri() or '<default graph>'}")
        self.stdout.write(
            f"  RDF_RESOURCE_BASE_URI = {getattr(settings, 'RDF_RESOURCE_BASE_URI', '')}"
        )
        self.stdout.write(
            f"  RDF_SHACL_ON_WRITE    = {getattr(settings, 'RDF_SHACL_VALIDATE_ON_WRITE', False)}"
        )

        if not rdf_sync_enabled():
            self.stdout.write(
                self.style.WARNING("RDF_SYNC_ENABLED is off — enable it before rebuilding.")
            )
            return

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("Dry run complete."))
            return

        from apps.graph.kg_engine.engine import get_kg_engine

        count = get_kg_engine().rebuild_public_graph()
        self.stdout.write(self.style.SUCCESS(f"Projected {count} MetaData instances."))
        self.stdout.write("Run: python manage.py rdf_diagnose")
