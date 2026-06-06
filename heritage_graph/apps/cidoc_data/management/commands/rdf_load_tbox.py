"""Load existing OWL/Turtle ontology into Oxigraph as schema (TBox) named graph — no YAML edits."""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Load ontology/Heritage.ttl into the triplestore schema graph "
        "(read-only TBox for SPARQL and documentation)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--ontology-path",
            default="",
            help="Path to Turtle file (default: repo ontology/Heritage.ttl)",
        )
        parser.add_argument(
            "--graph-uri",
            default="",
            help="Named graph for TBox (default: RDF_SCHEMA_GRAPH_URI setting)",
        )

    def handle(self, *args, **options):
        repo_root = Path(settings.BASE_DIR).parent
        ontology_path = Path(options["ontology_path"] or repo_root / "ontology" / "Heritage.ttl")
        if not ontology_path.is_file():
            raise CommandError(f"Ontology file not found: {ontology_path}")

        # The schema graph is the union of the LinkML OWL export plus the
        # generated CIDOC-CRM alignment bridge (rdfs:subClassOf + owl:disjointWith)
        # and the AAT-aligned SKOS controlled vocabularies. Without the bridge,
        # no heritage class entails its CRM supertype and no disjointness is
        # checkable; without the vocab, the Getty AAT mappings never reach the store.
        ontology_dir = ontology_path.parent
        tbox_paths = [ontology_path]
        for extra in (
            ontology_dir / "heritagegraph-crm-bridge.ttl",
            ontology_dir / "lod" / "skos-vocabularies.ttl",
        ):
            if extra.is_file():
                tbox_paths.append(extra)

        graph_uri = (
            options["graph_uri"]
            or getattr(settings, "RDF_SCHEMA_GRAPH_URI", "")
            or "https://w3id.org/heritagegraph/graph/schema"
        )

        endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        if endpoint:
            self._load_remote(endpoint, graph_uri, tbox_paths)
        else:
            count = self._load_local(graph_uri, tbox_paths)
            self.stdout.write(f"  triples in schema graph: {count}")

        loaded = ", ".join(p.name for p in tbox_paths)
        self.stdout.write(
            self.style.SUCCESS(
                f"Loaded TBox ({loaded}) into graph <{graph_uri}>."
            )
        )

    def _load_remote(self, endpoint: str, graph_uri: str, tbox_paths: list[Path]) -> None:
        import requests

        base = endpoint.replace("/update", "").replace("/sparql", "").rstrip("/")
        store_url = f"{base}/store"
        # First file replaces the graph (PUT); remaining files append (POST).
        for idx, path in enumerate(tbox_paths):
            ttl = path.read_text(encoding="utf-8")
            method = requests.put if idx == 0 else requests.post
            response = method(
                store_url,
                params={"graph": graph_uri},
                data=ttl.encode("utf-8"),
                headers={"Content-Type": "text/turtle"},
                timeout=120,
            )
            response.raise_for_status()

    def _load_local(self, graph_uri: str, tbox_paths: list[Path]) -> int:
        try:
            from pyoxigraph import NamedNode, RdfFormat
            from apps.graph.kg_engine.store import _open_local_store
        except ImportError as exc:
            raise CommandError("pyoxigraph is required for local TBox load.") from exc

        store_path = str(
            getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db") or "oxigraph_db"
        )
        try:
            store = _open_local_store(store_path)
        except OSError as exc:
            raise CommandError(
                "Cannot open Oxigraph store (another process may hold the lock, "
                "e.g. runserver). Stop Django and retry."
            ) from exc

        graph_name = NamedNode(graph_uri)
        for quad in list(store.quads_for_pattern(None, None, None, graph_name)):
            store.remove(quad)

        # Native Turtle load — handles blank nodes and relative IRIs (rdflib→NamedNode cannot).
        for path in tbox_paths:
            store.bulk_load(
                path=str(path.resolve()),
                format=RdfFormat.TURTLE,
                to_graph=graph_name,
            )
        return sum(
            1 for _ in store.quads_for_pattern(None, None, None, graph_name)
        )
