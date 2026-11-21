from apps.cidoc_data.linkml_loader import (
    build_fresh_payload,
    invalidate_registry_cache,
)
from apps.cidoc_data.models import SchemaRegistry
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Rebuild ontology registry cache and persist a SchemaRegistry snapshot row."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Always write a new snapshot even if the latest row is already current.",
        )

    def handle(self, *args, **options):
        invalidate_registry_cache()
        payload = build_fresh_payload()
        core_hash = payload.get("core_hash") or payload["schema_version"]

        # Idempotent: this runs on every container boot (see entrypoint.sh), so
        # only persist a new snapshot when the latest row is actually out of date
        # — or when it predates contribute_hub (the stale-snapshot bug that left
        # the Contribute hub empty in production). Without this guard every
        # restart would append a redundant SchemaRegistry row.
        latest = SchemaRegistry.objects.order_by("-created_at").first()
        latest_json = latest.registry_json if latest and isinstance(latest.registry_json, dict) else {}
        already_current = (
            not options.get("force")
            and latest is not None
            and latest.schema_version == payload["schema_version"]
            and (latest.core_hash or "") == core_hash
            and bool((latest_json.get("contribute_hub") or {}).get("intents"))
        )
        if already_current:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Schema registry already current: version={payload['schema_version']} "
                    "(no snapshot created)."
                )
            )
            return

        SchemaRegistry.objects.create(
            tenant=None,
            schema_version=payload["schema_version"],
            core_hash=core_hash,
            extension_hash=payload.get("extension_hash"),
            registry_json=payload,
            jsonschema_blob=payload.get("registry_jsonschema"),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Schema registry rebuilt: version={payload['schema_version']} "
                f"(contribute_hub={'present' if payload.get('contribute_hub') else 'EMPTY'})."
            )
        )
