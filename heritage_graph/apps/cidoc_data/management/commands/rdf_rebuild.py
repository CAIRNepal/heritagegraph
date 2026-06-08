"""Rebuild the public RDF graph from all CIDOC MetaData rows in PostgreSQL."""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.cidoc_data.rdf_publish import public_graph_uri
from apps.cidoc_data.rdf_signals import rdf_sync_enabled


class Command(BaseCommand):
    help = (
        "Project every CIDOC MetaData row into the public RDF graph "
        "(idempotent per-subject replace)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report configuration only; do not write triples.",
        )
        parser.add_argument(
            "--if-empty",
            action="store_true",
            help=(
                "Only rebuild when the public graph has no triples. "
                "Safe to run on every boot — populates a fresh triplestore once "
                "and is a no-op afterwards."
            ),
        )
        parser.add_argument(
            "--include-unpublished",
            action="store_true",
            help=(
                "Project all MetaData rows regardless of review status (dev/demo only). "
                "Default: only accepted/merged/published rows enter graph/public."
            ),
        )
        parser.add_argument(
            "--purge-imports",
            action="store_true",
            help="After rebuild, remove non-curated IRIs (e.g. bulk LUX) from graph/public.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("RDF rebuild"))
        self.stdout.write(f"  RDF_SYNC_ENABLED      = {rdf_sync_enabled()}")
        self.stdout.write(
            f"  RDF_ENDPOINT_URL      = {getattr(settings, 'RDF_ENDPOINT_URL', '') or '<local pyoxigraph>'}"
        )
        self.stdout.write(f"  RDF_PUBLIC_GRAPH_URI  = {public_graph_uri() or '<default graph>'}")
        self.stdout.write(
            f"  RDF_RESOURCE_BASE_URI = {getattr(settings, 'RDF_RESOURCE_BASE_URI', '')}"
        )
        self.stdout.write(
            f"  RDF_SHACL_ON_WRITE    = {getattr(settings, 'RDF_SHACL_VALIDATE_ON_WRITE', False)}"
        )

        if not rdf_sync_enabled():
            self.stdout.write(
                self.style.WARNING("RDF_SYNC_ENABLED is off — enable it before rebuilding.")
            )
            return

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("Dry run complete."))
            return

        from apps.graph.kg_engine.engine import get_kg_engine

        if options["if_empty"]:
            existing = self._public_graph_triple_count()
            if existing > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Public graph already has {existing} triples; skipping rebuild (--if-empty)."
                    )
                )
                return
            self.stdout.write("Public graph is empty — proceeding with rebuild.")

        count = get_kg_engine().rebuild_public_graph(
            include_unpublished=bool(options.get("include_unpublished"))
        )
        self.stdout.write(self.style.SUCCESS(f"Projected {count} published MetaData instances."))

        from apps.cidoc_data.rdf_signals import project_all_accepted_assertions

        acount = project_all_accepted_assertions()
        self.stdout.write(self.style.SUCCESS(f"Projected {acount} accepted assertions (assertion + prov graphs)."))

        if options.get("purge_imports"):
            from django.core.management import call_command

            call_command("kg_purge_public_imports", apply=True)

        self._print_publication_summary()
        self.stdout.write("Run: python manage.py kg_verify && python manage.py kg_quality_report")

    def _print_publication_summary(self) -> None:
        """Post-rebuild counts: Postgres vs PUBLIC graph (curated namespace)."""
        from django.apps import apps as django_apps

        from apps.cidoc_data.models import MetaData
        from apps.cidoc_data.publication_policy import PUBLISHED_STATUSES
        from apps.graph.kg_engine.engine import get_kg_engine
        from apps.graph.kg_engine.partitions import GraphPartition
        from apps.graph.kg_engine.uris import curated_resource_uri_prefix

        total = published = 0
        for model in django_apps.get_app_config("cidoc_data").get_models():
            if not issubclass(model, MetaData) or model is MetaData or model._meta.abstract:
                continue
            total += model.objects.count()
            published += model.objects.filter(status__in=PUBLISHED_STATUSES).count()

        public = GraphPartition.PUBLIC.uri()
        prefix = curated_resource_uri_prefix()
        try:
            rows = get_kg_engine().query(
                f"""SELECT (COUNT(DISTINCT ?s) AS ?nodes) (COUNT(*) AS ?triples) WHERE {{
  GRAPH <{public}> {{ ?s ?p ?o FILTER(STRSTARTS(STR(?s), "{prefix}")) }}
}}"""
            )
            b = rows[0] if rows else {}
            nodes = b.get("nodes", "?")
            triples = b.get("triples", "?")
        except Exception as exc:
            nodes, triples = "?", f"error: {exc}"

        self.stdout.write(self.style.MIGRATE_HEADING("Publication summary"))
        self.stdout.write(f"  Postgres entities (all)     = {total}")
        self.stdout.write(f"  Postgres entities (published status) = {published}")
        self.stdout.write(f"  PUBLIC graph (curated IRIs) = {nodes} subjects, {triples} triples")
        if published == 0:
            self.stdout.write(
                self.style.WARNING(
                    "  No entities with explicit published/accepted status — "
                    "legacy NULL-status curated rows still publish. "
                    "New submissions stay withheld until review sets status."
                )
            )

    def _public_graph_triple_count(self) -> int:
        """Triple count in the public named graph (0 if empty or unreachable).

        Returning 0 on any error makes --if-empty fail open: a fresh or
        unreachable store proceeds to a (idempotent) rebuild rather than
        silently staying empty.
        """
        from apps.graph.kg_engine.engine import get_kg_engine
        from apps.graph.kg_engine.partitions import GraphPartition

        graph_uri = GraphPartition.PUBLIC.uri()
        if graph_uri:
            sparql = f"SELECT (COUNT(*) AS ?c) WHERE {{ GRAPH <{graph_uri}> {{ ?s ?p ?o }} }}"
        else:
            sparql = "SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }"
        try:
            rows = get_kg_engine().query(sparql)
            return int(rows[0]["c"]) if rows and rows[0].get("c") else 0
        except Exception as exc:  # noqa: BLE001 — never block boot on a probe
            self.stdout.write(
                self.style.WARNING(f"  Could not probe public graph ({exc}); assuming empty.")
            )
            return 0
