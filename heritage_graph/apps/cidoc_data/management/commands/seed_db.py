"""
Management command: seed_db

Loads dummy heritage data from CSV files in heritage_graph/fixtures/ into
all CIDOC-CRM models.  Idempotent — skips rows whose `name` (or `title`
for Source) already exists, so running it twice won't create duplicates.

Usage:
    python manage.py seed_db            # load all models
    python manage.py seed_db --flush    # wipe existing data first, then load
"""

import csv
import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.cidoc_data.models import (
    ArchitecturalStructure,
    Deity,
    Event,
    Festival,
    Guthi,
    HistoricalPeriod,
    IconographicObject,
    Location,
    Monument,
    Person,
    RitualEvent,
    Source,
    Tradition,
)

# Mapping: CSV filename (without .csv) → (Model, lookup field)
MODEL_MAP = [
    ("persons",              Person,                  "name"),
    ("locations",            Location,                "name"),
    ("events",               Event,                   "name"),
    ("historical_periods",   HistoricalPeriod,        "name"),
    ("traditions",           Tradition,               "name"),
    ("sources",              Source,                   "title"),
    ("deities",              Deity,                    "name"),
    ("guthis",               Guthi,                   "name"),
    ("structures",           ArchitecturalStructure,  "name"),
    ("rituals",              RitualEvent,             "name"),
    ("festivals",            Festival,                "name"),
    ("iconographic_objects", IconographicObject,      "name"),
    ("monuments",            Monument,                "name"),
]

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "fixtures"


class Command(BaseCommand):
    help = "Load dummy heritage data from CSV fixtures into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing rows in seeded tables before loading.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not FIXTURES_DIR.is_dir():
            raise CommandError(f"Fixtures directory not found: {FIXTURES_DIR}")

        flush = options["flush"]
        total_created = 0
        total_skipped = 0

        for csv_name, Model, lookup_field in MODEL_MAP:
            csv_path = FIXTURES_DIR / f"{csv_name}.csv"
            if not csv_path.exists():
                self.stderr.write(self.style.WARNING(
                    f"  ⚠  {csv_name}.csv not found — skipping"
                ))
                continue

            model_label = Model.__name__

            # Optionally flush
            if flush:
                deleted, _ = Model.objects.all().delete()
                if deleted:
                    self.stdout.write(f"  🗑  {model_label}: deleted {deleted} rows")

            created = 0
            skipped = 0

            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Strip whitespace from keys and values
                    clean = {k.strip(): v.strip() for k, v in row.items() if k}

                    lookup_val = clean.get(lookup_field, "")
                    if not lookup_val:
                        self.stderr.write(self.style.WARNING(
                            f"  ⚠  {model_label}: row missing '{lookup_field}' — skipped"
                        ))
                        skipped += 1
                        continue

                    # Skip if already exists
                    if Model.objects.filter(**{lookup_field: lookup_val}).exists():
                        skipped += 1
                        continue

                    # Only keep keys that are actual model fields
                    field_names = {f.name for f in Model._meta.get_fields()}
                    data = {k: v for k, v in clean.items() if k in field_names and v}

                    try:
                        Model.objects.create(**data)
                        created += 1
                    except Exception as e:
                        self.stderr.write(self.style.ERROR(
                            f"  ✗  {model_label} '{lookup_val}': {e}"
                        ))
                        skipped += 1

            total_created += created
            total_skipped += skipped

            if created:
                self.stdout.write(self.style.SUCCESS(
                    f"  ✔  {model_label}: {created} created, {skipped} skipped"
                ))
            else:
                self.stdout.write(
                    f"  ·  {model_label}: 0 created, {skipped} skipped (all exist)"
                )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done — {total_created} records created, {total_skipped} skipped."
        ))
