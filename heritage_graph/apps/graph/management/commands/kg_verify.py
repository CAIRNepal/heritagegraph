"""
Diagnose the live knowledge-graph pipeline end to end: is the store the signals
WRITE to the same one the museum READS from, how many real edges exist (by
predicate), how many relationship assertions are accepted vs pending, and are
there dangling edges? Pinpoints why the museum's Live KG looks disconnected.

Usage:  python manage.py kg_verify
"""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.uris import curated_resource_uri_prefix

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


class Command(BaseCommand):
    help = "End-to-end diagnostic for the contribution → Oxigraph → museum pipeline."

    def handle(self, *args, **opts):
        engine = get_kg_engine()
        store = engine.store
        public = GraphPartition.PUBLIC.uri()
        ok = self.style.SUCCESS
        warn = self.style.WARNING

        # ── 1. Store consistency: writes vs reads must target the same store ──
        self.stdout.write(self.style.MIGRATE_HEADING("1. Store target"))
        write_target = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        try:
            read_target = store._query_endpoint() or ""  # type: ignore[attr-defined]
        except Exception:
            read_target = ""
        self.stdout.write(f"  RDF_SYNC_ENABLED   = {engine.enabled()}")
        self.stdout.write(f"  write target       = {write_target or '<local pyoxigraph>'}")
        self.stdout.write(f"  read  target       = {read_target or '<local pyoxigraph>'}")
        self.stdout.write(f"  OXIGRAPH_URL       = {getattr(settings, 'OXIGRAPH_URL', '')}")
        self.stdout.write(f"  OXIGRAPH_STORE_PATH= {getattr(settings, 'OXIGRAPH_STORE_PATH', '')}")
        self.stdout.write(f"  public graph       = {public}")
        if (write_target or "") != (read_target or ""):
            self.stdout.write(
                warn(
                    "  ⚠ WRITE and READ targets differ — signals may write triples the "
                    "museum never sees. This alone can make the graph look disconnected."
                )
            )
        else:
            self.stdout.write(ok("  ✓ writes and reads target the same store"))

        # ── 2. Triple counts ──────────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("2. Public graph size"))
        try:
            stats = engine.stats()
            self.stdout.write(f"  total triples  = {stats.total_triples}")
            self.stdout.write(f"  public triples = {stats.public_triples}")
        except Exception as exc:
            self.stdout.write(warn(f"  stats failed: {exc}"))

        # ── 3. Real entity→entity edges, by predicate ──────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("3. Edges (entity→entity) by predicate"))
        prefix = curated_resource_uri_prefix()
        edge_q = f"""
SELECT ?p (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o . ?s a ?st . ?o a ?ot .
    FILTER(?p != <{RDF_TYPE}>)
    FILTER(STRSTARTS(STR(?s), "{prefix}"))
    FILTER(STRSTARTS(STR(?o), "{prefix}"))
  }}
}} GROUP BY ?p ORDER BY DESC(?n)
"""
        try:
            rows = engine.query(edge_q)
            if not rows:
                self.stdout.write(warn("  (no entity→entity edges in the public graph)"))
            for r in rows:
                self.stdout.write(f"  {r.get('n', '?'):>5}  {r.get('p', '')}")
        except Exception as exc:
            self.stdout.write(warn(f"  edge query failed: {exc}"))

        # ── 3b. Graph connectivity (curated namespace only) ───────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("3b. Connectivity (curated only)"))
        conn_q = f"""
SELECT (COUNT(*) AS ?edges) (COUNT(DISTINCT ?s) AS ?connected) WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o .
    FILTER(isIRI(?o))
    FILTER(?p != <{RDF_TYPE}>)
    FILTER(STRSTARTS(STR(?s), "{prefix}"))
    FILTER(STRSTARTS(STR(?o), "{prefix}"))
  }}
}}
"""
        try:
            rows = engine.query(conn_q)
            if rows:
                b = rows[0]
                self.stdout.write(
                    f"  entity→entity edges: {b.get('edges', '?')}  "
                    f"subjects with ≥1 edge: {b.get('connected', '?')}"
                )
        except Exception as exc:
            self.stdout.write(warn(f"  connectivity query failed: {exc}"))

        # ── 3c. Bulk-import pollution + legacy ghost predicates in PUBLIC ─────
        self.stdout.write(self.style.MIGRATE_HEADING("3c. Non-curated pollution in PUBLIC"))
        pollute_q = f"""
SELECT (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o .
    FILTER(!STRSTARTS(STR(?s), "{prefix}")
         || STRSTARTS(STR(?o), "https://lux.")
         || STRSTARTS(STR(?o), "https://w3id.org/heritagegraph/imported/"))
  }}
}}
"""
        try:
            rows = engine.query(pollute_q)
            n = int((rows[0].get("n") if rows else 0) or 0)
            if n == 0:
                self.stdout.write(ok("  ✓ no bulk-import / external IRIs in PUBLIC"))
            else:
                self.stdout.write(
                    warn(
                        f"  ⚠ {n} triple(s) reference non-curated IRIs — "
                        "run: python manage.py kg_purge_public_imports --apply"
                    )
                )
        except Exception as exc:
            self.stdout.write(warn(f"  pollution query failed: {exc}"))

        from apps.graph.kg_engine.uris import legacy_property_predicate_prefix

        ghost_prefix = legacy_property_predicate_prefix()
        ghost_q = f"""
SELECT (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o .
    FILTER(STRSTARTS(STR(?p), "{ghost_prefix}"))
  }}
}}
"""
        try:
            rows = engine.query(ghost_q)
            gn = int((rows[0].get("n") if rows else 0) or 0)
            if gn == 0:
                self.stdout.write(ok("  ✓ no legacy /property/ ghost predicates in PUBLIC"))
            elif gn:
                self.stdout.write(
                    warn(
                        f"  ⚠ {gn} legacy /property/ ghost triple(s) — "
                        "run: python manage.py kg_purge_public_imports --apply"
                    )
                )
        except Exception as exc:
            self.stdout.write(warn(f"  ghost predicate query failed: {exc}"))

        # ── 4. Relationship assertions: accepted vs pending ────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("4. relationship.* assertions (Postgres)"))
        try:
            from django.db.models import Count
            from apps.cidoc_data.models import HeritageAssertion

            qs = (
                HeritageAssertion.objects.filter(asserted_property__startswith="relationship.")
                .values("reconciliation_status")
                .annotate(n=Count("id"))
                .order_by("-n")
            )
            counts = {row["reconciliation_status"]: row["n"] for row in qs}
            if not counts:
                self.stdout.write(
                    warn("  (no relationship.* assertions — approve RelationshipProposals or run seed_test_relationships)")
                )
            for status_, n in counts.items():
                marker = ok("→ projects") if status_ == "accepted" else "(not projected)"
                self.stdout.write(f"  {n:>5}  {status_:<12} {marker}")
        except Exception as exc:
            self.stdout.write(warn(f"  assertion count failed: {exc}"))

        # ── 5. Dangling edges (object IRI has no rdf:type in public graph) ─────
        self.stdout.write(self.style.MIGRATE_HEADING("5. Dangling edges"))
        dangling_q = f"""
SELECT (COUNT(*) AS ?n) WHERE {{
  GRAPH <{public}> {{
    ?s a ?st . ?s ?p ?o .
    FILTER(isIRI(?o)) FILTER(?p != <{RDF_TYPE}>)
    FILTER NOT EXISTS {{ GRAPH <{public}> {{ ?o a ?ot }} }}
  }}
}}
"""
        try:
            rows = engine.query(dangling_q)
            n = rows[0].get("n") if rows else "0"
            self.stdout.write(
                f"  {n} edge(s) point to an object with no rdf:type "
                "(dropped by the museum — a URI-scheme/identity mismatch if large)."
            )
        except Exception as exc:
            self.stdout.write(warn(f"  dangling query failed: {exc}"))

        self.stdout.write(
            "\nReading: edges>0 in §3 → the graph is connected. If §3 is empty but §4 shows "
            "accepted assertions, check §1 (store mismatch) and run `rdf_rebuild`. If §4 is "
            "empty, there are no relationships yet — seed or approve proposals."
        )
