"""Re-project all CIDOC MetaData rows to the configured RDF endpoint (SPARQL UPDATE)."""

from django.core.management.base import BaseCommand

from apps.cidoc_data.rdf_signals import project_all_metadata_instances, rdf_sync_enabled


class Command(BaseCommand):
    help = "Emit INSERT DATA for every MetaData subclass row (requires RDF_SYNC_ENABLED + RDF_ENDPOINT_URL)."

    def handle(self, *args, **options):
        if not rdf_sync_enabled():
            self.stdout.write(self.style.WARNING("RDF_SYNC_ENABLED is off; nothing to do."))
            return
        n = project_all_metadata_instances()
        self.stdout.write(self.style.SUCCESS(f"Projected {n} instances to triplestore."))
