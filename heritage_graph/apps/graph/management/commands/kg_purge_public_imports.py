"""
Remove non-curated instance IRIs from the public RDF graph.

Bulk external imports (e.g. Yale LUX stubs under ``imported/lux/``) must stay in
their own named graphs and be linked via ``skos:exactMatch``, not merged into
``graph/public``. Also removes legacy ``{resource_base}/property/`` ghost
predicates from older projection code.

Usage:
  python manage.py kg_purge_public_imports          # dry-run counts
  python manage.py kg_purge_public_imports --apply  # execute DELETE
"""

from __future__ import annotations

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.uris import (
    curated_resource_uri_prefix,
    legacy_property_predicate_prefix,
    resource_base,
)
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Purge bulk-import / non-curated IRIs from the public RDF graph (linkset model)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Execute DELETE (default is dry-run: report counts only).",
        )

    def handle(self, *args, **options):
        engine = get_kg_engine()
        if not engine.enabled():
            self.stdout.write(self.style.WARNING("RDF_SYNC_ENABLED is off — nothing to purge."))
            return

        public = GraphPartition.PUBLIC.uri()
        prefix = curated_resource_uri_prefix()
        ghost_prefix = legacy_property_predicate_prefix()
        self.stdout.write(f"  public graph     = {public}")
        self.stdout.write(f"  curated prefix   = {prefix}")
        self.stdout.write(f"  resource base    = {resource_base()}")

        count_q = f"""
SELECT (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o .
    FILTER(
      !STRSTARTS(STR(?s), "{prefix}")
      || (STRSTARTS(STR(?o), "https://lux.")
          || STRSTARTS(STR(?o), "https://w3id.org/heritagegraph/imported/"))
    )
  }}
}}
"""
        rows = engine.query(count_q)
        n = int((rows[0].get("n") if rows else 0) or 0)
        ghost_q = f"""
SELECT (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o .
    FILTER(STRSTARTS(STR(?p), "{ghost_prefix}"))
  }}
}}
"""
        grow = engine.query(ghost_q)
        gn = int((grow[0].get("n") if grow else 0) or 0)

        if n == 0:
            self.stdout.write(self.style.SUCCESS("Public graph is clean — no non-curated triples."))
        else:
            self.stdout.write(
                self.style.WARNING(f"  {n} triple(s) in PUBLIC reference non-curated IRIs.")
            )

        if gn == 0:
            self.stdout.write(self.style.SUCCESS("No legacy /property/ ghost predicates in PUBLIC."))
        else:
            self.stdout.write(
                self.style.WARNING(f"  {gn} legacy /property/ ghost triple(s) in PUBLIC.")
            )

        if not options["apply"]:
            if n or gn:
                self.stdout.write("  Re-run with --apply to delete them.")
            return

        if not n and not gn:
            self.stdout.write(self.style.SUCCESS("Nothing to remove."))
            return

        # Delete exactly what the COUNT queries above detect, so detection and
        # removal can never diverge (the previous store.purge_public_graph helper
        # missed imported-subject triples it had reported).
        removed_pollution = 0
        removed_ghost = 0
        if n:
            del_pollution = f"""
DELETE {{ GRAPH <{public}> {{ ?s ?p ?o }} }}
WHERE {{ GRAPH <{public}> {{ ?s ?p ?o .
  FILTER(
    !STRSTARTS(STR(?s), "{prefix}")
    || STRSTARTS(STR(?o), "https://lux.")
    || STRSTARTS(STR(?o), "https://w3id.org/heritagegraph/imported/")
  )
}} }}
"""
            if engine.store.update(del_pollution):
                removed_pollution = n
        if gn:
            del_ghost = f"""
DELETE {{ GRAPH <{public}> {{ ?s ?p ?o }} }}
WHERE {{ GRAPH <{public}> {{ ?s ?p ?o .
  FILTER(STRSTARTS(STR(?p), "{ghost_prefix}"))
}} }}
"""
            if engine.store.update(del_ghost):
                removed_ghost = gn
        if removed_pollution:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Removed {removed_pollution} non-curated triple(s) from PUBLIC."
                )
            )
        if removed_ghost:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Removed {removed_ghost} legacy /property/ ghost triple(s) from PUBLIC."
                )
            )
        if not removed_pollution and not removed_ghost:
            self.stdout.write(self.style.SUCCESS("Nothing to remove."))
