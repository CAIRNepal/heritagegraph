"""Populate EntityRef rows from legacy CharField relation columns."""

from django.core.management.base import BaseCommand

from apps.cidoc_data.relation_backrefs import backfill_entityrefs_from_legacy_columns


class Command(BaseCommand):
    help = "Rebuild cidoc_data.EntityRef edges from CIDOC_RELATION_BACKREFS CharField columns."

    def handle(self, *args, **options):
        n = backfill_entityrefs_from_legacy_columns()
        self.stdout.write(self.style.SUCCESS(f"EntityRef rows created (new): {n}"))
