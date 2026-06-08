"""
One-shot KG publish pipeline: rebuild PUBLIC graph, purge imports, verify, quality report.

Usage:
    python manage.py kg_publish
    python manage.py kg_publish --output reports/kg-quality.json
"""

from __future__ import annotations

from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Rebuild curated PUBLIC graph and emit quality metrics (single entry point)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="",
            help="Write kg_quality_report JSON to this path.",
        )
        parser.add_argument(
            "--include-unpublished",
            action="store_true",
            help="Dev only: project withheld-status entities too.",
        )

    def handle(self, *args, **options):
        rebuild_args = ["--purge-imports"]
        if options.get("include_unpublished"):
            rebuild_args.append("--include-unpublished")
        call_command("rdf_rebuild", *rebuild_args)
        call_command("kg_verify")
        out = (options.get("output") or "").strip()
        if out:
            Path(out).parent.mkdir(parents=True, exist_ok=True)
            call_command("kg_quality_report", output=out)
        else:
            call_command("kg_quality_report")
