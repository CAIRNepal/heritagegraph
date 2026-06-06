"""Export public (+ optional schema) named graphs to N-Quads / Turtle."""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.rdf_serialize import format_nt_line


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
            self.stderr.write(self.style.WARNING("Only --format nt is supported; using nt."))

        engine = get_kg_engine()
        store = engine.store
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
            lines: list[str] = []
            for s, p, o in store.iter_named_graph_triples(graph):
                if s and p and o is not None:
                    lines.append(format_nt_line(s, p, o))
            path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote {path} ({len(lines)} triples)"))
