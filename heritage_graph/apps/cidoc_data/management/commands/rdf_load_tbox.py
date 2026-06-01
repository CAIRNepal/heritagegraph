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

        graph_uri = (
            options["graph_uri"]
            or getattr(settings, "RDF_SCHEMA_GRAPH_URI", "")
            or "https://w3id.org/heritagegraph/graph/schema"
        )

        ttl = ontology_path.read_text(encoding="utf-8")
        endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        if endpoint:
            self._load_remote(endpoint, graph_uri, ttl)
        else:
            self._load_local(graph_uri, ttl, ontology_path)

        self.stdout.write(
            self.style.SUCCESS(
                f"Loaded TBox from {ontology_path} into graph <{graph_uri}>."
            )
        )

    def _load_remote(self, endpoint: str, graph_uri: str, ttl: str) -> None:
        import requests

        base = endpoint.replace("/update", "").replace("/sparql", "").rstrip("/")
        put_url = f"{base}/store"
        response = requests.put(
            put_url,
            params={"graph": graph_uri},
            data=ttl.encode("utf-8"),
            headers={"Content-Type": "text/turtle"},
            timeout=120,
        )
        response.raise_for_status()

    def _load_local(self, graph_uri: str, ttl: str, ontology_path: Path) -> None:
        try:
            from pyoxigraph import NamedNode, Store
            from rdflib import Graph
        except ImportError as exc:
            raise CommandError("pyoxigraph and rdflib are required for local TBox load.") from exc

        store_path = getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db")
        store = Store(str(store_path))
        graph_name = NamedNode(graph_uri)

        for q in list(store.quads_for_pattern(None, None, None, graph_name)):
            store.remove(q)

        rdf = Graph()
        rdf.parse(str(ontology_path), format="turtle")
        from pyoxigraph import Literal, Quad

        for s, p, o in rdf:
            s_n = NamedNode(str(s))
            p_n = NamedNode(str(p))
            if hasattr(o, "toPython"):
                if o.datatype is not None:
                    o_term = Literal(str(o), datatype=NamedNode(str(o.datatype)))
                elif o.language:
                    o_term = Literal(str(o), language=str(o.language))
                else:
                    o_term = Literal(str(o))
            else:
                o_term = NamedNode(str(o))
            store.add(Quad(s_n, p_n, o_term, graph_name))
