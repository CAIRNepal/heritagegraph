from apps.cidoc_data.linkml_loader import (
    build_fresh_payload,
    invalidate_registry_cache,
)
from apps.cidoc_data.models import SchemaRegistry
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Rebuild ontology registry cache and persist a SchemaRegistry snapshot row."

    def handle(self, *args, **options):
        invalidate_registry_cache()
        payload = build_fresh_payload()
        SchemaRegistry.objects.create(
            tenant=None,
            schema_version=payload["schema_version"],
            core_hash=payload.get("core_hash") or payload["schema_version"],
            extension_hash=payload.get("extension_hash"),
            registry_json=payload,
            jsonschema_blob=payload.get("registry_jsonschema"),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Schema registry rebuilt: version={payload['schema_version']}"
            )
        )
