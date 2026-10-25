"""Import data/wikidata/heritage-snapshot.json into the live graph.

    python manage.py import_wikidata_heritage            # import, then rdf_rebuild
    python manage.py import_wikidata_heritage --no-rebuild

Refresh the snapshot first with `tools/fetch_wikidata_heritage.py` when the
seed list changes; this command never touches the network.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from apps.cidoc_data.wikidata_import import run_import
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings

DATA_DIR = Path(settings.BASE_DIR).parent / "data" / "wikidata"


class Command(BaseCommand):
    help = (
        "Import the frozen Wikidata heritage snapshot (records, labels, images, edges)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--snapshot", default=str(DATA_DIR / "heritage-snapshot.json")
        )
        parser.add_argument("--seeds", default=str(DATA_DIR / "seeds.yaml"))
        parser.add_argument(
            "--no-rebuild", action="store_true", help="Skip rdf_rebuild afterwards."
        )

    def handle(self, *args, **options):
        snapshot = Path(options["snapshot"])
        if not snapshot.is_file():
            raise CommandError(
                f"Snapshot not found: {snapshot}. Run tools/fetch_wikidata_heritage.py."
            )
        seeds = {
            s["qid"]: s
            for s in (yaml.safe_load(Path(options["seeds"]).read_text()) or {}).get(
                "seeds", []
            )
        }

        # Per-row projection would write every record to the store one by one;
        # a single rebuild afterwards is the same result in a fraction of the time.
        # The signal handlers read settings, which are loaded by now, so an
        # environment variable set here would change nothing.
        with override_settings(RDF_SYNC_ENABLED=False):
            report = run_import(snapshot, seeds)

        self.stdout.write(self.style.MIGRATE_HEADING("Wikidata import"))
        self.stdout.write(f"  created  {dict(sorted(report.created.items()))}")
        self.stdout.write(f"  updated  {dict(sorted(report.updated.items()))}")
        self.stdout.write(f"  skipped  {dict(sorted(report.skipped.items()))}")
        if report.matched_existing:
            self.stdout.write(
                f"  enriched {len(report.matched_existing)} existing rows by exact name:"
            )
            for line in report.matched_existing:
                self.stdout.write(f"    {line}")

        if not options["no_rebuild"]:
            call_command("rdf_rebuild", purge_imports=True)
