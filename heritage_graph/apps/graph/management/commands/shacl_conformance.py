"""Validate the published graph against the generated SHACL shapes.

Write-time validation checks one record's triples at a time; this checks what
is actually published -- the public graph plus the assertion and provenance
graphs the shapes for beliefs target -- in one pass, and writes:

* ``shacl-conformance.json`` -- conforms, triple and shape counts, and the
  violations grouped by shape, path and constraint, with sample focus nodes;
* ``shacl-conformance-report.ttl`` -- the full SHACL validation report.

``--check`` exits non-zero when the graph does not conform.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.rdf_serialize import format_nt_line
from django.conf import settings
from django.core.management.base import BaseCommand

PARTITIONS = (
    GraphPartition.PUBLIC,
    GraphPartition.ASSERTION,
    GraphPartition.PROVENANCE,
)


def _data_graph():
    from rdflib import Graph

    store = get_kg_engine().store
    lines: list[str] = []
    per_graph: dict[str, int] = {}
    for partition in PARTITIONS:
        base = partition.uri()
        if not base:
            continue
        # Beliefs and their provenance live in one named graph per assertion
        # (<base>/<assertion id>, nanopublication style), not in the base graph.
        graphs = [base]
        if partition is not GraphPartition.PUBLIC:
            rows = store.select(
                "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } "
                f'FILTER(STRSTARTS(STR(?g), "{base}")) }}'
            )
            graphs = sorted({r["g"] for r in rows if r.get("g")} | {base})
        n = 0
        for uri in graphs:
            for s, p, o in store.iter_named_graph_triples(uri):
                if s and p and o is not None:
                    lines.append(format_nt_line(s, p, o))
                    n += 1
        per_graph[partition.value] = n
    graph = Graph()
    if lines:
        graph.parse(data="\n".join(lines), format="nt")
    return graph, per_graph


def run() -> tuple[dict, str]:
    import pyshacl
    from apps.cidoc_data.shacl_validate import _load_shapes_graph
    from apps.graph.rdf_publish import default_shapes_path
    from rdflib import Namespace
    from rdflib.namespace import RDF

    SH = Namespace("http://www.w3.org/ns/shacl#")
    shapes = _load_shapes_graph()
    data, per_graph = _data_graph()
    conforms, results_graph, report_text = pyshacl.validate(
        data,
        shacl_graph=shapes,
        inference="rdfs",
        abort_on_first=False,
        meta_shacl=False,
    )
    groups: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    severities: Counter = Counter()
    for result in results_graph.subjects(RDF.type, SH.ValidationResult):
        shape = str(results_graph.value(result, SH.sourceShape) or "")
        path = str(results_graph.value(result, SH.resultPath) or "")
        component = str(results_graph.value(result, SH.sourceConstraintComponent) or "")
        severities[
            str(results_graph.value(result, SH.resultSeverity) or "").rsplit("#", 1)[-1]
        ] += 1
        groups[(shape, path, component.rsplit("#", 1)[-1])].append(
            str(results_graph.value(result, SH.focusNode) or "")
        )
    violations = [
        {
            "shape": shape,
            "path": path,
            "constraint": component,
            "count": len(nodes),
            "sample_focus_nodes": sorted(nodes)[:5],
        }
        for (shape, path, component), nodes in sorted(
            groups.items(), key=lambda kv: -len(kv[1])
        )
    ]
    summary = {
        "generated": date.today().isoformat(),
        "shapes_file": str(Path(default_shapes_path()).name),
        "node_shapes": len(set(shapes.subjects(RDF.type, SH.NodeShape))),
        "graphs": per_graph,
        "triples_validated": len(data),
        "conforms": bool(conforms),
        "results_by_severity": dict(severities),
        "violations": violations,
        "write_time_validation": bool(
            getattr(settings, "RDF_SHACL_VALIDATE_ON_WRITE", False)
        ),
        "write_time_strict": bool(
            getattr(settings, "RDF_SHACL_STRICT_ON_WRITE", False)
        ),
    }
    return summary, results_graph.serialize(format="turtle")


class Command(BaseCommand):
    help = "Validate the published graph against the generated SHACL shapes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            type=Path,
            help="Where to write the summary and report (default: print only).",
        )
        parser.add_argument(
            "--check", action="store_true", help="Fail if not conforming."
        )

    def handle(self, *args, **opts):
        summary, report_ttl = run()
        if opts["output_dir"]:
            out = opts["output_dir"]
            out.mkdir(parents=True, exist_ok=True)
            (out / "shacl-conformance.json").write_text(
                json.dumps(summary, indent=2) + "\n"
            )
            (out / "shacl-conformance-report.ttl").write_text(report_ttl)
            self.stdout.write(f"wrote {out}/shacl-conformance.json and the full report")
        self.stdout.write(
            f"{'CONFORMS' if summary['conforms'] else 'DOES NOT CONFORM'} — "
            f"{summary['triples_validated']} triples, "
            f"{summary['node_shapes']} node shapes, "
            f"results {summary['results_by_severity'] or 'none'}"
        )
        for v in summary["violations"][:15]:
            self.stdout.write(
                f"  {v['count']:>5}  {v['shape'].rsplit('#', 1)[-1]}  "
                f"{v['path'].rsplit('/', 1)[-1]}  {v['constraint']}"
            )
        if opts["check"] and not summary["conforms"]:
            raise SystemExit(1)
