"""
Remove public-graph subjects whose backing database row no longer exists.

``rebuild_public_graph`` iterates live rows, so it can refresh or withhold any
subject it still finds in Postgres — but a subject whose row was deleted outside
the delete signals (bulk SQL cleanup, ``QuerySet.delete()`` on a raw table,
fixtures torn down out of band) is invisible to it and stays in ``graph/public``
forever. Those ghosts are indistinguishable from real heritage to every public
consumer: the KG projection, the Atlas, and the Museum all render them.

IRIs that do not resolve to a concrete CIDOC MetaData model are left untouched —
assertions, clusters, and vocabulary terms share the curated namespace and are
not owned by a MetaData row.

Usage:
  python manage.py kg_purge_orphans          # dry-run report
  python manage.py kg_purge_orphans --apply  # execute DELETE
"""

from __future__ import annotations

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.uris import (
    curated_resource_uri_prefix,
    metadata_model_and_pk_for_resource_uri,
)
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Purge public-graph subjects whose backing database row was deleted."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Execute DELETE (default is dry-run: report only).",
        )

    def handle(self, *args, **options):
        engine = get_kg_engine()
        if not engine.enabled():
            self.stdout.write(
                self.style.WARNING("RDF_SYNC_ENABLED is off — nothing to purge.")
            )
            return

        public = GraphPartition.PUBLIC.uri()
        prefix = curated_resource_uri_prefix()
        self.stdout.write(self.style.MIGRATE_HEADING("Orphan subject scan"))
        self.stdout.write(f"  public graph   = {public}")
        self.stdout.write(f"  curated prefix = {prefix}")

        subjects = self._curated_subjects(public, prefix)
        self.stdout.write(f"  curated subjects in PUBLIC = {len(subjects)}")

        orphans: list[tuple[str, str]] = []
        live = unresolvable = 0
        for uri in subjects:
            resolved = metadata_model_and_pk_for_resource_uri(uri)
            if resolved is None:
                orphan_label = self._orphan_cultural_entity_label(uri)
                if orphan_label is None:
                    unresolvable += 1
                    continue
                orphans.append((uri, orphan_label))
                continue
            model, pk = resolved
            if model.objects.filter(pk=pk).exists():
                live += 1
            else:
                orphans.append((uri, f"{model.__name__} pk={pk} deleted"))

        self.stdout.write(f"  backed by a live row       = {live}")
        self.stdout.write(f"  not MetaData-owned (kept)  = {unresolvable}")

        if not orphans:
            self.stdout.write(
                self.style.SUCCESS("No orphaned subjects — graph is in sync.")
            )
            return

        self.stdout.write(
            self.style.WARNING(f"  orphaned subjects          = {len(orphans)}")
        )
        for uri, reason in orphans:
            self.stdout.write(f"    {uri}  ({reason})")

        if not options["apply"]:
            self.stdout.write("  Re-run with --apply to delete them.")
            return

        removed = 0
        for uri, _reason in orphans:
            if engine.delete_resource(uri):
                removed += 1
        self.stdout.write(
            self.style.SUCCESS(f"Removed {removed} orphaned subject(s) from PUBLIC.")
        )
        if removed != len(orphans):
            queued = len(orphans) - removed
            self.stdout.write(
                self.style.WARNING(
                    f"{queued} deletion(s) queued to the outbox; run rdf_drain_outbox."
                )
            )

    def _curated_subjects(self, public: str, prefix: str) -> list[str]:
        sparql = f"""
SELECT DISTINCT ?s WHERE {{
  GRAPH <{public}> {{
    ?s ?p ?o .
    FILTER(STRSTARTS(STR(?s), "{prefix}"))
  }}
}}
"""
        try:
            rows = get_kg_engine().query(sparql)
        except Exception as exc:  # noqa: BLE001 — report, never crash an ops command
            self.stdout.write(self.style.ERROR(f"  SPARQL scan failed: {exc}"))
            return []
        return [str(r["s"]) for r in rows if r.get("s")]

    def _orphan_cultural_entity_label(self, uri: str) -> str | None:
        """Reason string when ``uri`` is a CulturalEntity IRI with no row, else None.

        Wrapper IRIs (``…/entity/<uuid>``) are not MetaData-owned, so the generic
        resolver skips them, but they are still deletable ghosts once the
        ``CulturalEntity`` row is gone.
        """
        from apps.graph.kg_engine.uris import cultural_entity_uri
        from django.apps import apps as django_apps

        try:
            entity_id = str(uri).rstrip("/").rsplit("/", 1)[-1]
        except Exception:  # noqa: BLE001
            return None
        if cultural_entity_uri(entity_id) != str(uri):
            return None
        try:
            model = django_apps.get_model("heritage_data", "CulturalEntity")
        except LookupError:
            return None
        if model.objects.filter(entity_id=entity_id).exists():
            return None
        return f"CulturalEntity {entity_id} deleted"
