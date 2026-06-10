"""
Management command: seed_db

Loads curated global heritage data from CSV fixtures into CIDOC-CRM models.
Idempotent — skips rows whose lookup key already exists.

Also loads curated relationship assertions from fixtures/relationships.csv.

Usage:
    python manage.py seed_db
    python manage.py seed_db --flush
    python manage.py seed_db --no-rdf   # skip triplestore rebuild
"""

from __future__ import annotations

import csv
from pathlib import Path

from apps.cidoc_data.models import (
    ArchitecturalStructure,
    Deity,
    Event,
    Festival,
    Guthi,
    HeritageAssertion,
    HistoricalPeriod,
    IconographicObject,
    Location,
    Monument,
    Person,
    RitualEvent,
    Source,
    Tradition,
)
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

MODEL_MAP = [
    ("persons", Person, "name"),
    ("locations", Location, "name"),
    ("events", Event, "name"),
    ("historical_periods", HistoricalPeriod, "name"),
    ("traditions", Tradition, "name"),
    ("sources", Source, "title"),
    ("deities", Deity, "name"),
    ("guthis", Guthi, "name"),
    ("structures", ArchitecturalStructure, "name"),
    ("rituals", RitualEvent, "name"),
    ("festivals", Festival, "name"),
    ("iconographic_objects", IconographicObject, "name"),
    ("monuments", Monument, "name"),
]

MODEL_BY_NAME = {cls.__name__: cls for _, cls, _ in MODEL_MAP}

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "fixtures"
SEED_STATUS = "published"
SEED_CONTRIBUTOR = "seed_db"


class Command(BaseCommand):
    help = "Load curated heritage fixtures (global corpus, Nepal-rich) into Postgres + KG."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true", help="Delete seeded tables first.")
        parser.add_argument(
            "--no-rdf",
            action="store_true",
            help="Skip rdf_rebuild after loading (default: rebuild public graph).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not FIXTURES_DIR.is_dir():
            raise CommandError(f"Fixtures directory not found: {FIXTURES_DIR}")

        total_created = 0
        total_skipped = 0

        for csv_name, Model, lookup_field in MODEL_MAP:
            csv_path = FIXTURES_DIR / f"{csv_name}.csv"
            if not csv_path.exists():
                self.stderr.write(self.style.WARNING(f"  ⚠  {csv_name}.csv not found — skipping"))
                continue

            if options["flush"]:
                deleted, _ = Model.objects.all().delete()
                if deleted:
                    self.stdout.write(f"  🗑  {Model.__name__}: deleted {deleted} rows")

            created, skipped = self._load_model_csv(Model, lookup_field, csv_path)
            total_created += created
            total_skipped += skipped

        rel_created, rel_skipped = self._load_relationships()
        total_created += rel_created
        total_skipped += rel_skipped

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done — {total_created} records created, {total_skipped} skipped."
            )
        )

        if not options["no_rdf"]:
            self.stdout.write(self.style.MIGRATE_HEADING("Rebuilding public RDF graph…"))
            call_command("rdf_rebuild", purge_imports=True)

    def _load_model_csv(self, Model, lookup_field: str, csv_path: Path) -> tuple[int, int]:
        created = skipped = 0
        field_names = {f.name for f in Model._meta.get_fields()}

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                clean = {k.strip(): v.strip() for k, v in row.items() if k and v and v.strip()}
                lookup_val = clean.get(lookup_field, "")
                if not lookup_val:
                    skipped += 1
                    continue
                if Model.objects.filter(**{lookup_field: lookup_val}).exists():
                    skipped += 1
                    continue
                data = {k: v for k, v in clean.items() if k in field_names}
                data.setdefault("status", SEED_STATUS)
                try:
                    Model.objects.create(**data)
                    created += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"  ✗  {Model.__name__} '{lookup_val}': {e}"))
                    skipped += 1

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"  ✔  {Model.__name__}: {created} created, {skipped} skipped")
            )
        return created, skipped

    def _load_relationships(self) -> tuple[int, int]:
        csv_path = FIXTURES_DIR / "relationships.csv"
        if not csv_path.is_file():
            self.stdout.write("  ·  relationships.csv not found — skipping edges")
            return 0, 0

        created = skipped = 0
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                subj_model = MODEL_BY_NAME.get((row.get("subject_model") or "").strip())
                obj_model = MODEL_BY_NAME.get((row.get("object_model") or "").strip())
                pred = (row.get("predicate") or "").strip()
                subj_name = (row.get("subject_name") or "").strip()
                obj_name = (row.get("object_name") or "").strip()
                citation = (row.get("source_citation") or "HeritageGraph curated corpus").strip()
                if not (subj_model and obj_model and pred and subj_name and obj_name):
                    skipped += 1
                    continue
                subj_lookup = "title" if subj_model is Source else "name"
                obj_lookup = "title" if obj_model is Source else "name"
                subj = subj_model.objects.filter(**{subj_lookup: subj_name}).first()
                obj = obj_model.objects.filter(**{obj_lookup: obj_name}).first()
                if not subj or not obj:
                    skipped += 1
                    continue
                s_ct = ContentType.objects.get_for_model(subj_model)
                o_ct = ContentType.objects.get_for_model(obj_model)
                _, was_created = HeritageAssertion.objects.get_or_create(
                    content_type=s_ct,
                    object_id=subj.pk,
                    object_content_type=o_ct,
                    object_object_id=obj.pk,
                    asserted_property=pred if pred.startswith("relationship.") else f"relationship.{pred}",
                    defaults={
                        "reconciliation_status": "accepted",
                        "contributed_by": SEED_CONTRIBUTOR,
                        "attributed_to_agent": SEED_CONTRIBUTOR,
                        "source_citation": citation,
                        "confidence": "likely",
                    },
                )
                if not was_created:
                    HeritageAssertion.objects.filter(
                        content_type=s_ct,
                        object_id=subj.pk,
                        object_content_type=o_ct,
                        object_object_id=obj.pk,
                        asserted_property=pred if pred.startswith("relationship.") else f"relationship.{pred}",
                    ).update(
                        contributed_by=SEED_CONTRIBUTOR,
                        attributed_to_agent=SEED_CONTRIBUTOR,
                        source_citation=citation,
                    )
                created += int(was_created)
                skipped += int(not was_created)

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"  ✔  Relationships: {created} created, {skipped} skipped")
            )
        return created, skipped
