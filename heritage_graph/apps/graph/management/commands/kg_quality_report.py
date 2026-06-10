"""KG quality metrics for research evaluation (Phase 1)."""

from __future__ import annotations

import json

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from django.core.management.base import BaseCommand

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


class Command(BaseCommand):
    help = "Emit JSON quality metrics: triple counts, dangling edges, assertion coverage, SHACL sample."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="",
            help="Write JSON to this path (default: stdout only).",
        )

    def handle(self, *args, **options):
        engine = get_kg_engine()
        public = GraphPartition.PUBLIC.uri()
        stats = engine.stats()

        dangling_q = f"""
SELECT (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s a ?st . ?s ?p ?o .
    FILTER(isIRI(?o)) FILTER(?p != <{RDF_TYPE}>)
    FILTER NOT EXISTS {{ GRAPH <{public}> {{ ?o a ?ot }} }}
  }}
}}
"""
        dangling = int((engine.query(dangling_q) or [{"n": "0"}])[0].get("n", 0))

        from apps.cidoc_data.models import HeritageAssertion

        rel_total = HeritageAssertion.objects.filter(
            asserted_property__startswith="relationship."
        ).count()
        rel_accepted = HeritageAssertion.objects.filter(
            asserted_property__startswith="relationship.",
            reconciliation_status="accepted",
        ).count()

        from apps.cidoc_data.models import EntityCluster

        with_external = EntityCluster.objects.exclude(external_identifiers={}).count()
        clusters = EntityCluster.objects.filter(merged_into__isnull=True).count()

        inferred_uri = GraphPartition.INFERRED.uri()
        inferred_count = 0
        if inferred_uri:
            rows = engine.query(
                f"SELECT (COUNT(*) AS ?c) WHERE {{ GRAPH <{inferred_uri}> {{ ?s ?p ?o }} }}"
            )
            if rows:
                inferred_count = int(rows[0].get("c", 0) or 0)

        report = {
            "store_healthy": engine.store.health(),
            "total_triples": stats.total_triples,
            "public_triples": stats.public_triples,
            "schema_triples": stats.schema_triples,
            "dangling_edges": dangling,
            "relationship_assertions_total": rel_total,
            "relationship_assertions_accepted": rel_accepted,
            "assertion_acceptance_rate": (
                round(rel_accepted / rel_total, 4) if rel_total else None
            ),
            "entity_clusters": clusters,
            "clusters_with_external_identifiers": with_external,
            "external_identifier_coverage": (
                round(with_external / clusters, 4) if clusters else None
            ),
            "inferred_graph_triples": inferred_count,
            "shacl_validate_on_write": bool(
                getattr(
                    __import__("django.conf", fromlist=["settings"]).settings,
                    "RDF_SHACL_VALIDATE_ON_WRITE",
                    False,
                )
            ),
            # Part 7: the five guarantees, each backed by concrete metrics.
            "guarantees": __import__(
                "apps.graph.kg_engine.quality", fromlist=["build_quality_report"]
            ).build_quality_report(engine),
        }

        text = json.dumps(report, indent=2)
        self.stdout.write(text)
        out = options.get("output") or ""
        if out:
            with open(out, "w", encoding="utf-8") as fh:
                fh.write(text)
            self.stdout.write(self.style.SUCCESS(f"Wrote {out}"))
