"""Verify the contribution -> RDF -> Oxigraph chain end-to-end.

Reports the active configuration, counts quads in the configured store
(local file or remote SPARQL), and optionally projects one MetaData row
to confirm signal handlers are wired and writes round-trip.

Usage:
    python manage.py rdf_diagnose
    python manage.py rdf_diagnose --project-first      # project one row
    python manage.py rdf_diagnose --project-all        # full rebuild
"""

from __future__ import annotations

import logging
from typing import Any

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Diagnose the CIDOC contribution -> RDF -> Oxigraph projection chain."

    def add_arguments(self, parser):
        parser.add_argument(
            "--project-first",
            action="store_true",
            help="Project the first available MetaData row to verify writes succeed.",
        )
        parser.add_argument(
            "--project-all",
            action="store_true",
            help="Re-project every MetaData row (delegates to rdf_rebuild).",
        )

    def handle(self, *args, **options):
        from apps.cidoc_data.rdf_signals import (
            _resource_uri,
            queue_entity_projection,
            rdf_sync_enabled,
        )
        from apps.cidoc_data.models import MetaData

        self.stdout.write(self.style.MIGRATE_HEADING("Configuration"))
        self.stdout.write(f"  RDF_SYNC_ENABLED       = {rdf_sync_enabled()}")
        self.stdout.write(
            f"  RDF_ENDPOINT_URL       = {getattr(settings, 'RDF_ENDPOINT_URL', '') or '<empty, uses local file fallback>'}"
        )
        self.stdout.write(
            f"  RDF_QUERY_URL          = {getattr(settings, 'RDF_QUERY_URL', '') or '<empty, falls back to RDF_ENDPOINT_URL or local file>'}"
        )
        self.stdout.write(
            f"  OXIGRAPH_URL           = {getattr(settings, 'OXIGRAPH_URL', '')}"
        )
        self.stdout.write(
            f"  OXIGRAPH_STORE_PATH    = {getattr(settings, 'OXIGRAPH_STORE_PATH', '')}"
        )
        self.stdout.write(
            f"  RDF_RESOURCE_BASE_URI  = {getattr(settings, 'RDF_RESOURCE_BASE_URI', '')}"
        )

        if not rdf_sync_enabled():
            self.stdout.write(
                self.style.WARNING(
                    "\nRDF_SYNC_ENABLED is OFF; contribution saves will NOT project to RDF."
                )
            )

        cfg = apps.get_app_config("cidoc_data")
        sql_rows = 0
        first_instance: Any | None = None
        for model in cfg.get_models():
            if (
                not issubclass(model, MetaData)
                or model is MetaData
                or model._meta.abstract
            ):
                continue
            n = model.objects.count()
            sql_rows += n
            if first_instance is None and n > 0:
                first_instance = model.objects.first()
        self.stdout.write(self.style.MIGRATE_HEADING("\nRelational state"))
        self.stdout.write(f"  CIDOC MetaData rows in DB: {sql_rows}")

        endpoint = (getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        if endpoint:
            self.stdout.write(self.style.MIGRATE_HEADING("\nRemote SPARQL store"))
            self._probe_remote(endpoint)
        else:
            self.stdout.write(self.style.MIGRATE_HEADING("\nLocal pyoxigraph store"))
            self._probe_local()

        if options["project_first"]:
            self.stdout.write(self.style.MIGRATE_HEADING("\nProjecting first row"))
            if first_instance is None:
                self.stdout.write(
                    self.style.WARNING(
                        "  Nothing to project: no MetaData rows in the database."
                    )
                )
            else:
                uri = _resource_uri(first_instance)
                self.stdout.write(f"  Subject: <{uri}>")
                queue_entity_projection(first_instance)
                self.stdout.write(self.style.SUCCESS("  Projection signal invoked."))
                if endpoint:
                    self._probe_remote(endpoint, subject_uri=uri)
                else:
                    self._probe_local(subject_uri=uri)

        if options["project_all"]:
            from django.core.management import call_command

            self.stdout.write(self.style.MIGRATE_HEADING("\nFull rebuild (rdf_rebuild)"))
            call_command("rdf_rebuild")

    def _probe_local(self, *, subject_uri: str | None = None) -> None:
        try:
            from pyoxigraph import NamedNode, Store
        except ImportError:
            self.stdout.write(
                self.style.ERROR(
                    "  pyoxigraph not installed; cannot inspect local store."
                )
            )
            return
        path = str(
            getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db") or "oxigraph_db"
        )
        try:
            store = Store(path)
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"  Could not open store at {path!r}: {exc}"))
            return
        total = sum(1 for _ in store.quads_for_pattern(None, None, None, None))
        self.stdout.write(f"  Store path:   {path}")
        self.stdout.write(f"  Total quads:  {total}")
        if subject_uri:
            n = sum(
                1
                for _ in store.quads_for_pattern(
                    NamedNode(subject_uri), None, None, None
                )
            )
            self.stdout.write(f"  Quads for <{subject_uri}>: {n}")

    def _probe_remote(self, endpoint: str, *, subject_uri: str | None = None) -> None:
        import requests

        query_url = (
            getattr(settings, "RDF_QUERY_URL", "").strip()
            or endpoint.replace("/update", "/query")
        )
        self.stdout.write(f"  Update endpoint: {endpoint}")
        self.stdout.write(f"  Query  endpoint: {query_url}")
        try:
            r = requests.get(
                query_url,
                params={"query": "SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }"},
                headers={"Accept": "application/sparql-results+json"},
                timeout=10,
            )
            r.raise_for_status()
            count = int(
                r.json()["results"]["bindings"][0]["c"]["value"]
            )
            self.stdout.write(f"  Total quads: {count}")
        except Exception as exc:
            self.stdout.write(
                self.style.ERROR(f"  Could not query remote endpoint: {exc}")
            )
            return
        if subject_uri:
            try:
                r = requests.get(
                    query_url,
                    params={
                        "query": (
                            f"SELECT (COUNT(*) AS ?c) WHERE {{ <{subject_uri}> ?p ?o }}"
                        )
                    },
                    headers={"Accept": "application/sparql-results+json"},
                    timeout=10,
                )
                r.raise_for_status()
                n = int(r.json()["results"]["bindings"][0]["c"]["value"])
                self.stdout.write(f"  Quads for <{subject_uri}>: {n}")
            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"  Subject probe failed: {exc}")
                )
