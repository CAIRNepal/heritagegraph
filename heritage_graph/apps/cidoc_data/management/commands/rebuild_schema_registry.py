from django.core.management.base import BaseCommand

from apps.cidoc_data.linkml_loader import (
    build_fresh_payload,
    invalidate_registry_cache,
)
from apps.cidoc_data.models import SchemaRegistry


class Command(BaseCommand):
    help = "Rebuild ontology registry cache and persist a SchemaRegistry snapshot row."

    def handle(self, *args, **options):
        invalidate_registry_cache()
        payload = build_fresh_payload()
        SchemaRegistry.objects.create(
            tenant=None,
            schema_version=payload["schema_version"],
            core_hash=payload["schema_version"],
            extension_hash=None,
            registry_json=payload,
            jsonschema_blob=None,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Schema registry rebuilt: version={payload['schema_version']}"
            )
        )
