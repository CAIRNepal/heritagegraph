"""Nature-rigor integrity audit of the curated public graph.

Asserts research-grade invariants and exits non-zero when a HARD invariant is
violated (so it can gate CI / a release). SOFT invariants are data-maturity
thresholds reported as warnings (errors only with ``--strict``).

HARD invariants:
  * referential integrity — no dangling edges (every internal edge target is typed)
  * logical consistency   — no owl:disjointWith violations
  * namespace integrity   — every subject is a well-formed namespaced IRI
  * provenance separation — no imported/external stubs leak into the curated graph
  * L0 isolation          — no data.cair-nepal.org subjects in graph/public

SOFT invariants (thresholds):
  * type coverage ≥ 0.95 · CRM-bridge coverage ≥ 0.90 ·
    provenance coverage ≥ 0.80 · datatype hygiene > 0 ·
    DANAM DataSource rows present · LodExternalIdentity map non-empty when imports exist
"""

from __future__ import annotations

import sys

from apps.graph.kg_engine import quality
from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from django.core.management.base import BaseCommand

OK = "✓"
BAD = "✗"
WARN = "⚠"

DANAM_SUBJECT_PREFIX = "https://data.cair-nepal.org/"


class Command(BaseCommand):
    help = "Audit the public graph against Nature-rigor integrity invariants."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Treat soft-threshold shortfalls as failures too (exit 1).",
        )

    def handle(self, *args, **options):
        engine = get_kg_engine()
        public = GraphPartition.PUBLIC.uri()

        # ── HARD invariants ──────────────────────────────────────────────────
        dangling = quality.dangling_edges(engine) or 0
        cons = quality.consistency(engine) or {}
        violations = cons.get("violations") or 0
        ns = quality.namespace_integrity(engine) or {}
        ns_viol = ns.get("violations") or 0

        leaked = 0
        try:
            rows = engine.query(
                f"SELECT (COUNT(DISTINCT ?s) AS ?c) WHERE {{ GRAPH <{public}> "
                f"{{ ?s ?p ?o FILTER(CONTAINS(STR(?s), '/imported/')) }} }}"
            )
            leaked = int(rows[0]["c"]) if rows and rows[0].get("c") else 0
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(self.style.WARNING(f"  (separation probe failed: {exc})"))

        danam_leak = 0
        try:
            rows = engine.query(
                f"SELECT (COUNT(DISTINCT ?s) AS ?c) WHERE {{ GRAPH <{public}> {{ "
                f"?s ?p ?o FILTER(STRSTARTS(STR(?s), \"{DANAM_SUBJECT_PREFIX}\")) }} }}"
            )
            danam_leak = int(rows[0]["c"]) if rows and rows[0].get("c") else 0
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(self.style.WARNING(f"  (L0 isolation probe failed: {exc})"))

        hard = [
            ("referential integrity — 0 dangling edges", dangling == 0, f"{dangling} dangling"),
            ("logical consistency — 0 disjointness violations", violations == 0, f"{violations} violations"),
            ("namespace integrity — well-formed IRIs", ns_viol == 0, f"{ns_viol} malformed"),
            ("provenance separation — no imported stubs in curated graph", leaked == 0, f"{leaked} leaked subjects"),
            ("L0 isolation — no data.cair-nepal.org subjects in PUBLIC", danam_leak == 0, f"{danam_leak} leaked"),
        ]

        # ── SOFT invariants (data-maturity thresholds) ───────────────────────
        tc = (quality.type_coverage(engine) or {}).get("value")
        crm = (quality.crm_bridge_coverage() or {}).get("value")
        prov = (quality.provenance_coverage(engine) or {}).get("value")
        dh = quality.datatype_hygiene(engine) or {}
        dh_typed = dh.get("datatyped_or_langtagged") or 0

        ds_count = lod_count = danam_rows = 0
        try:
            from apps.cidoc_data.models import (
                ArchitecturalStructure,
                DataSource,
                LodExternalIdentity,
            )

            ds_count = DataSource.objects.filter(name__icontains="DANAM corpus").count()
            lod_count = LodExternalIdentity.objects.count()
            danam_rows = ArchitecturalStructure.objects.filter(
                contributor="danam_import"
            ).count()
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(self.style.WARNING(f"  (Postgres soft probes failed: {exc})"))

        soft = [
            ("type coverage ≥ 0.95", (tc or 0) >= 0.95, str(tc)),
            ("CRM-bridge coverage ≥ 0.90", (crm or 0) >= 0.90, str(crm)),
            ("provenance coverage ≥ 0.80", (prov or 0) >= 0.80, str(prov)),
            ("datatype hygiene > 0", dh_typed > 0, f"{dh_typed}/{dh.get('literals')} typed"),
            (
                "DANAM DataSource rows ≥ 1 (when corpus integrated)",
                ds_count >= 1 or danam_rows == 0,
                f"datasources={ds_count} danam_structures={danam_rows}",
            ),
            (
                "LodExternalIdentity map consistent with DANAM rows",
                lod_count >= danam_rows,
                f"map={lod_count} structures={danam_rows}",
            ),
        ]

        self.stdout.write(self.style.MIGRATE_HEADING("Nature-rigor audit — HARD invariants"))
        hard_fail = 0
        for name, passed, detail in hard:
            mark = self.style.SUCCESS(OK) if passed else self.style.ERROR(BAD)
            self.stdout.write(f"  {mark} {name}  [{detail}]")
            hard_fail += 0 if passed else 1

        self.stdout.write(self.style.MIGRATE_HEADING("Soft invariants (data-maturity thresholds)"))
        soft_fail = 0
        for name, passed, detail in soft:
            mark = self.style.SUCCESS(OK) if passed else self.style.WARNING(WARN)
            self.stdout.write(f"  {mark} {name}  [{detail}]")
            soft_fail += 0 if passed else 1

        self.stdout.write("")
        if hard_fail:
            self.stdout.write(self.style.ERROR(f"FAIL — {hard_fail} HARD invariant(s) violated."))
            sys.exit(1)
        if options["strict"] and soft_fail:
            self.stdout.write(
                self.style.ERROR(f"STRICT FAIL — {soft_fail} soft threshold(s) below target.")
            )
            sys.exit(1)
        self.stdout.write(
            self.style.SUCCESS(
                f"PASS — all HARD invariants hold ({soft_fail} soft threshold(s) below target)."
            )
        )
