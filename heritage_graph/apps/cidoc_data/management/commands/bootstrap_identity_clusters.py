"""Bootstrap: one EntityCluster + accepted membership per clusterable entity."""

from __future__ import annotations

from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.identity_validation import assertable_model_names
from apps.cidoc_data.models import EntityCluster, HeritageAssertion
from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.db import transaction


def _display_title(instance) -> str:
    for attr in ("name", "title"):
        v = getattr(instance, attr, None)
        if v:
            return str(v)[:500]
    return str(instance.pk)


CLUSTERABLE_MODELS: tuple[tuple[str, str], ...] = (
    ("cidoc_data", "ArchitecturalStructure"),
    ("cidoc_data", "RitualEvent"),
    ("cidoc_data", "Festival"),
    ("cidoc_data", "IconographicObject"),
    ("cidoc_data", "Monument"),
    ("cidoc_data", "Deity"),
    ("cidoc_data", "Guthi"),
    ("cidoc_data", "Person"),
    ("cidoc_data", "Location"),
    ("cidoc_data", "Event"),
    ("cidoc_data", "HistoricalPeriod"),
    ("cidoc_data", "Tradition"),
    ("cidoc_data", "Source"),
    ("cidoc_data", "KumariTenure"),
    ("cidoc_data", "KumariSelection"),
    ("cidoc_data", "KumariRetirement"),
    ("cidoc_data", "SyncreticRelationship"),
    ("cidoc_data", "CasteGroup"),
    ("cidoc_data", "CalendarSystem"),
)


class Command(BaseCommand):
    help = (
        "Create singleton EntityCluster + accepted membership per clusterable row."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print counts without writing to the database.",
        )

    def handle(self, *args, **options) -> None:
        dry_run: bool = options["dry_run"]
        created_clusters = 0
        created_assertions = 0
        skipped = 0

        for app_label, model_name in CLUSTERABLE_MODELS:
            Model = apps.get_model(app_label, model_name)
            ct = ContentType.objects.get_for_model(Model, for_concrete_model=True)
            if ct.model not in assertable_model_names():
                self.stderr.write(
                    f"Skipping {model_name}: not in assertable_model_names()"
                )
                continue

            qs = Model.objects.all().order_by("pk")
            for obj in qs.iterator():
                exists = HeritageAssertion.objects.filter(
                    content_type=ct,
                    object_id=obj.pk,
                    asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
                    entity_cluster__isnull=False,
                    reconciliation_status="accepted",
                    supersedes__isnull=True,
                ).exists()
                if exists:
                    skipped += 1
                    continue

                label = _display_title(obj)
                if dry_run:
                    self.stdout.write(
                        f"Would bootstrap {ct.model}#{obj.pk} -> {label!r}"
                    )
                    created_clusters += 1
                    created_assertions += 1
                    continue

                with transaction.atomic():
                    cluster = EntityCluster.objects.create(
                        canonical_label=label,
                        type_scope=ct.model,
                        locked=False,
                        note="",
                    )
                    ha = HeritageAssertion(
                        content_type=ct,
                        object_id=obj.pk,
                        asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
                        asserted_value="",
                        assertion_content="Bootstrap singleton membership",
                        entity_cluster=cluster,
                        reconciliation_status="accepted",
                        confidence="certain",
                        contributed_by="bootstrap_identity_clusters",
                    )
                    ha.full_clean()
                    ha.save()
                created_clusters += 1
                created_assertions += 1

        msg = (
            f"Bootstrap complete: clusters={created_clusters}, "
            f"assertions={created_assertions}, skipped={skipped}, dry_run={dry_run}"
        )
        self.stdout.write(self.style.SUCCESS(msg))
