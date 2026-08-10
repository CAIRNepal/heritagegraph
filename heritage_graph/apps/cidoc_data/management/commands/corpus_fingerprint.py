"""Write a reproducibility fingerprint for the DANAM corpus + ontology pin."""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.cidoc_data.danam_import.fingerprint import (
    fingerprint_corpus,
    reject_predicate_audit,
)


def _default_nq_path() -> Path:
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
        "Fingerprint danam-heritagegraph.nq (SHA-256, type/graph counts) and pin "
        "ontology / schema_version hashes for Nature methods reproducibility."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument("--file", type=str, default="")
        parser.add_argument(
            "--report-json",
            type=str,
            default="",
            help="Write fingerprint JSON (default: stdout summary only).",
        )
        parser.add_argument(
            "--reject-audit-json",
            type=str,
            default="",
            help="Also write L1 unmapped-predicate reject audit JSON.",
        )

    def handle(self, *args, **options) -> None:
        path = Path(options["file"]).expanduser() if options["file"] else _default_nq_path()
        if not path.is_file():
            raise CommandError(f"NQ file not found: {path}")

        fp = fingerprint_corpus(path, base_dir=Path(settings.BASE_DIR))
        self.stdout.write(self.style.MIGRATE_HEADING("Corpus fingerprint"))
        self.stdout.write(f"  nq_sha256       = {fp.nq_sha256}")
        self.stdout.write(f"  quads           = {fp.quad_count}")
        self.stdout.write(f"  bytes           = {fp.nq_bytes}")
        self.stdout.write(f"  schema_version  = {fp.schema_version[:16]}…")
        self.stdout.write(f"  ontology files  = {len(fp.ontology_files)}")
        self.stdout.write("  top types:")
        for iri, n in list(fp.type_counts.items())[:8]:
            short = iri.rsplit("/", 1)[-1].rsplit("#", 1)[-1]
            self.stdout.write(f"    {n:>6}  {short}")
        self.stdout.write("  graphs:")
        for g, n in list(fp.graph_counts.items())[:8]:
            self.stdout.write(f"    {n:>6}  {g}")

        report = (options["report_json"] or "").strip()
        if report:
            out = Path(report).expanduser()
            fp.write_json(out)
            self.stdout.write(self.style.SUCCESS(f"Wrote fingerprint → {out}"))

        reject_path = (options["reject_audit_json"] or "").strip()
        if reject_path:
            audit = reject_predicate_audit(path)
            out = Path(reject_path).expanduser()
            out.parent.mkdir(parents=True, exist_ok=True)
            import json

            out.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
            self.stdout.write(
                self.style.SUCCESS(
                    f"Wrote reject audit → {out} "
                    f"({audit['unmapped_predicate_count']} predicates, "
                    f"{audit['unmapped_quad_count']} quads)"
                )
            )
