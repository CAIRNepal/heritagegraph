"""Import DANAM reconciled N-Quads into Postgres (L1 materialization).

See ``documentation/research/DANAM_CORPUS_INTEGRATION_REPORT.md``.

Examples::

    python manage.py import_danam_nq --dry-run --limit 20
    python manage.py import_danam_nq --pass structures --limit 100
    python manage.py import_danam_nq --pass all --rebuild --report-json /tmp/danam-report.json
"""

from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.cidoc_data.danam_import.nq import file_sha256
from apps.cidoc_data.danam_import.materialize import run_import


def _default_nq_path() -> Path:
    # BASE_DIR is heritage_graph/; repo root is parent.
    base = Path(settings.BASE_DIR).resolve()
    candidates = [
        base.parent / "data" / "reconciled" / "danam-heritagegraph.nq",
        base / "data" / "reconciled" / "danam-heritagegraph.nq",
        Path.cwd() / "data" / "reconciled" / "danam-heritagegraph.nq",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


class Command(BaseCommand):
    help = (
        "Materialize danam-heritagegraph.nq into CIDOC rows + assertions "
        "(idempotent by external IRI). Does NOT load into graph/public — "
        "use --rebuild after apply."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--file",
            type=str,
            default="",
            help="Path to danam-heritagegraph.nq (default: data/reconciled/…)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing to Postgres.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Max subjects per pass (structures or beliefs).",
        )
        parser.add_argument(
            "--pass",
            dest="pass_name",
            choices=("structures", "assertions", "all"),
            default="structures",
            help="ETL pass to run (default: structures).",
        )
        parser.add_argument(
            "--rebuild",
            action="store_true",
            help="After apply, run rdf_rebuild (requires RDF_SYNC_ENABLED).",
        )
        parser.add_argument(
            "--report-json",
            type=str,
            default="",
            help="Write ImportReport JSON to this path.",
        )
        parser.add_argument(
            "--expected-sha256",
            type=str,
            default="",
            help="If set, abort when the input file SHA-256 does not match.",
        )

    def handle(self, *args, **options) -> None:
        path = Path(options["file"]).expanduser() if options["file"] else _default_nq_path()
        if not path.is_file():
            raise CommandError(
                f"NQ file not found: {path}\n"
                "Place danam-heritagegraph.nq under data/reconciled/ "
                "(gitignored) or pass --file."
            )

        dry_run: bool = bool(options["dry_run"])
        # Default safety: require explicit apply (no --dry-run) — but allow
        # either. If neither dry-run nor a clear apply intent… treat missing
        # dry-run as apply. Documented in help.

        sha = file_sha256(path)
        expected = (options["expected_sha256"] or "").strip().lower()
        if expected and sha.lower() != expected:
            raise CommandError(
                f"SHA-256 mismatch.\n  expected: {expected}\n  actual:   {sha}"
            )

        self.stdout.write(self.style.MIGRATE_HEADING("DANAM NQ import (L1)"))
        self.stdout.write(f"  file     = {path}")
        self.stdout.write(f"  sha256   = {sha}")
        self.stdout.write(f"  pass     = {options['pass_name']}")
        self.stdout.write(f"  dry_run  = {dry_run}")
        self.stdout.write(f"  limit    = {options['limit']}")

        # Bulk ETL should not project every row into Oxigraph live — that turns a
        # ~7k structure load into hours of store writes. Default off unless the
        # operator explicitly wants per-row sync; use --rebuild for one shot.
        rdf_env = os.environ.get("RDF_SYNC_ENABLED")
        if rdf_env is None and not options["dry_run"]:
            os.environ["RDF_SYNC_ENABLED"] = "0"
            self.stdout.write(
                self.style.WARNING(
                    "  RDF_SYNC_ENABLED forced off for bulk import "
                    "(use --rebuild or rdf_rebuild afterwards)."
                )
            )

        report = run_import(
            path,
            pass_name=options["pass_name"],
            dry_run=dry_run,
            limit=options["limit"],
        )

        self.stdout.write(f"  quads    = {report.quad_count}")
        self.stdout.write(f"  parse_err= {report.parse_errors}")
        if report.schema_version:
            self.stdout.write(f"  schema   = {report.schema_version[:20]}…")
        if report.ontology_pin:
            self.stdout.write(f"  ont_pins = {len(report.ontology_pin)} files")
        if report.reject_audit and not report.reject_audit.get("skipped"):
            self.stdout.write(
                f"  rejects  = {report.reject_audit.get('unmapped_predicate_count', 0)} preds / "
                f"{report.reject_audit.get('unmapped_quad_count', 0)} quads (L0-only)"
            )
        self.stdout.write(f"  created  = {report.created}")
        self.stdout.write(f"  updated  = {report.updated}")
        self.stdout.write(f"  skipped  = {report.skipped}")
        self.stdout.write(f"  failures = {len(report.failures)}")
        if report.samples:
            self.stdout.write("  samples:")
            for sample in report.samples[:5]:
                self.stdout.write(f"    {sample}")

        report_path = (options["report_json"] or "").strip()
        if report_path:
            out = Path(report_path).expanduser()
            report.write_json(out)
            self.stdout.write(self.style.SUCCESS(f"Wrote report → {out}"))

        if options["rebuild"]:
            if dry_run:
                self.stdout.write(
                    self.style.WARNING("--rebuild ignored during --dry-run")
                )
            else:
                self.stdout.write(self.style.MIGRATE_HEADING("rdf_rebuild"))
                call_command("rdf_rebuild")

        if report.failures:
            self.stdout.write(
                self.style.WARNING(
                    f"Completed with {len(report.failures)} row failure(s)."
                )
            )
        elif dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    "Dry run complete. Re-run without --dry-run to apply."
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS("Import apply complete."))
