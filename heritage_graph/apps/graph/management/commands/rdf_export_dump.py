"""Export public (+ optional schema) named graphs to N-Quads / Turtle."""

from __future__ import annotations

from pathlib import Path

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.rdf_serialize import dump_graph_ntriples
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Export RDF dumps for FAIR publication (named graph triple iteration)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            default="",
            help="Directory for dumps (default: <repo>/ontology/lod/dumps).",
        )
        parser.add_argument(
            "--format",
            choices=("nt", "ttl"),
            default="nt",
            help="Serialization format (nt = N-Triples lines; ttl not yet implemented).",
        )

    def handle(self, *args, **options):
        if options["format"] != "nt":
            self.stderr.write(
                self.style.WARNING("Only --format nt is supported; using nt.")
            )

        public = GraphPartition.PUBLIC.uri()
        schema = GraphPartition.SCHEMA.uri()
        out_dir = Path(
            options["output_dir"]
            or (Path(settings.BASE_DIR).parent / "ontology" / "lod" / "dumps")
        )
        out_dir.mkdir(parents=True, exist_ok=True)

        for label, graph in (("public", public), ("schema", schema)):
            if not graph:
                continue
            path = out_dir / f"heritagegraph-{label}.nt"
            # The store's own serialiser keeps datatypes, language tags and
            # escaping; the line formatter used before dropped all three.
            data = dump_graph_ntriples(graph)
            path.write_bytes(data)
            n = data.count(b"\n")
            self.stdout.write(self.style.SUCCESS(f"Wrote {path} ({n} triples)"))
