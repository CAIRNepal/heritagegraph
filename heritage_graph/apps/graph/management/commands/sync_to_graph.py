from __future__ import annotations

import logging

from django.core.management.base import BaseCommand

from apps.cidoc_data.models import MetaData
from apps.cidoc_data.rdf_signals import queue_entity_projection, rdf_sync_enabled
from apps.graph.client import graph_client

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Bulk-sync CIDOC MetaData rows to Oxigraph using the registry projection "
        "(same path as post_save signals)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0, help="Optional limit per model")

    def handle(self, *args, **options):
        if not rdf_sync_enabled():
            self.stdout.write(
                self.style.ERROR("RDF_SYNC_ENABLED is off — nothing to sync.")
            )
            return

        endpoint = __import__("django.conf", fromlist=["settings"]).settings
        has_remote = bool(str(getattr(endpoint, "RDF_ENDPOINT_URL", "") or "").strip())
        if has_remote and not graph_client.health():
            self.stdout.write(
                self.style.WARNING(
                    "Oxigraph health check failed; projection may still use RDF_ENDPOINT_URL."
                )
            )

        limit = int(options.get("limit") or 0)
        from django.apps import apps

        cfg = apps.get_app_config("cidoc_data")
        total = 0
        errors = 0

        for model in cfg.get_models():
            if (
                not issubclass(model, MetaData)
                or model is MetaData
                or model._meta.abstract
            ):
                continue
            label = model.__name__
            qs = model.objects.all()
            if limit:
                qs = qs[:limit]
            synced = 0
            for instance in qs.iterator():
                try:
                    queue_entity_projection(instance)
                    synced += 1
                except Exception as exc:
                    errors += 1
                    logger.exception(
                        "Graph sync failed for %s id=%s: %s", label, instance.pk, exc
                    )
            total += synced
            self.stdout.write(self.style.SUCCESS(f"[{label}] projected={synced}"))

        self.stdout.write(
            self.style.SUCCESS(f"Done. projected={total} errors={errors}")
        )
