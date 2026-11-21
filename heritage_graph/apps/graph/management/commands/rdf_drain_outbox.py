"""Drain pending RDF sync outbox rows."""

from __future__ import annotations

from apps.graph.kg_engine.outbox import drain_pending
from apps.graph.models import RDFSyncOutbox
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Retry failed knowledge graph writes from RDFSyncOutbox."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        pending = RDFSyncOutbox.objects.filter(processed_at__isnull=True).count()
        self.stdout.write(f"Pending outbox rows: {pending}")
        ok, failed = drain_pending(limit=int(options["limit"]))
        self.stdout.write(self.style.SUCCESS(f"Processed ok={ok} failed={failed}"))
