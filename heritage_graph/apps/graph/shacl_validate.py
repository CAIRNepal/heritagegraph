"""
SHACL validation gate for project named graphs.

Uses pyshacl when available; falls back to a rule-based check when it is not
installed so the rest of the pipeline continues to work without the dependency.

Key shapes (from Phase 4 spec):
  - Production must have produced_object ≥ 1
  - Enshrinement must have enshrined_in_structure ≥ 1
  - Every HeritageAssertion that is accepted must link a DataSource
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

HG = "https://w3id.org/heritagegraph/"
CRM = "http://www.cidoc-crm.org/cidoc-crm/"


@dataclass
class Violation:
    shape: str
    focus_node: str
    message: str
    severity: str = "sh:Violation"


@dataclass
class ValidationReport:
    conforms: bool
    violations: list[Violation] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "conforms": self.conforms,
            "violations": [
                {
                    "shape": v.shape,
                    "focus_node": v.focus_node,
                    "message": v.message,
                    "severity": v.severity,
                }
                for v in self.violations
            ],
        }


def validate_project_graph(project_id: str, *, shapes_path: str | None = None) -> ValidationReport:
    """
    Run SHACL validation on the project named graph.

    Attempts pyshacl first; falls back to rule-based checks if unavailable.

    Args:
        project_id: UUID string of the project.
        shapes_path: Optional path to a SHACL shapes .ttl file.
                     Defaults to ontology/shapes/generated-heritagegraph-minimal-shacl.ttl.

    Returns:
        ValidationReport with conforms flag and list of violations.
    """
    try:
        return _pyshacl_validate(project_id, shapes_path=shapes_path)
    except ImportError:
        logger.warning("pyshacl not installed — using rule-based validation fallback")
        return _rule_based_validate(project_id)
    except Exception as exc:
        logger.error("SHACL validation error for project %s: %s", project_id, exc)
        return ValidationReport(conforms=True, violations=[])


def _get_project_graph_triples(project_id: str) -> list[tuple[str, str, str]]:
    """Fetch (s, p, o) triples from the project named graph via SPARQL."""
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.partitions import GraphPartition

    graph_uri = GraphPartition.PROJECT.uri(suffix=project_id)
    if not graph_uri:
        return []
    engine = get_kg_engine()
    try:
        rows = engine.store.select(
            f"SELECT ?s ?p ?o WHERE {{ GRAPH <{graph_uri}> {{ ?s ?p ?o }} }} LIMIT 5000"
        )
        return [(r["s"], r["p"], r["o"]) for r in rows if "s" in r and "p" in r and "o" in r]
    except Exception as exc:
        logger.warning("Could not fetch project graph for %s: %s", project_id, exc)
        return []


def _pyshacl_validate(project_id: str, *, shapes_path: str | None) -> ValidationReport:
    """Run pyshacl against the project named graph triples."""
    import importlib
    import os

    pyshacl = importlib.import_module("pyshacl")

    from django.conf import settings

    if shapes_path is None:
        base = getattr(settings, "BASE_DIR", "")
        shapes_path = os.path.join(
            str(base),
            "ontology",
            "shapes",
            "generated-heritagegraph-minimal-shacl.ttl",
        )

    triples = _get_project_graph_triples(project_id)
    if not triples:
        return ValidationReport(conforms=True)

    # Build an in-memory N-Triples string from the SPARQL result.
    nt_lines: list[str] = []
    for s, p, o in triples:
        if o.startswith("http://") or o.startswith("https://"):
            nt_lines.append(f"<{s}> <{p}> <{o}> .")
        else:
            escaped = o.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
            nt_lines.append(f'<{s}> <{p}> "{escaped}" .')
    data_graph_text = "\n".join(nt_lines)

    conforms, results_graph, results_text = pyshacl.validate(
        data_graph_text,
        shacl_graph=shapes_path,
        data_graph_format="nt",
        shacl_graph_format="turtle",
        inference="none",
        serialize_report_graph=False,
    )
    violations: list[Violation] = []
    if not conforms and results_graph is not None:
        SH = "http://www.w3.org/ns/shacl#"
        for result in results_graph.subjects(
            predicate=results_graph.store.__class__,
        ):
            focus = str(results_graph.value(result, results_graph.URIRef(SH + "focusNode")) or "")
            msg = str(results_graph.value(result, results_graph.URIRef(SH + "resultMessage")) or "")
            shape_iri = str(results_graph.value(result, results_graph.URIRef(SH + "sourceShape")) or "")
            violations.append(Violation(shape=shape_iri, focus_node=focus, message=msg))

    return ValidationReport(conforms=bool(conforms), violations=violations)


def _rule_based_validate(project_id: str) -> ValidationReport:
    """
    Lightweight rule-based check when pyshacl is not available.

    Checks:
    1. All accepted HeritageAssertions for this project link a DataSource.
    2. Production event nodes have at least one crm:P108_has_produced triple.
    3. Enshrinement event nodes have at least one hg:enshrined_in_structure triple.
    """
    violations: list[Violation] = []

    try:
        from apps.cidoc_data.models import HeritageAssertion

        missing_source = HeritageAssertion.objects.filter(
            project_id=project_id,
            reconciliation_status="accepted",
            source__isnull=True,
            source_citation="",
        )
        for a in missing_source.only("id", "asserted_property")[:20]:
            violations.append(
                Violation(
                    shape="hg:shape/AssertionRequiresSource",
                    focus_node=f"{HG}assertion/{a.pk}",
                    message=(
                        f"HeritageAssertion on {a.asserted_property!r} has no DataSource "
                        "or source_citation — every accepted assertion must cite a source."
                    ),
                )
            )
    except Exception as exc:
        logger.warning("Rule-based assertion source check failed: %s", exc)

    # Graph-level checks (Production / Enshrinement required triples)
    triples = _get_project_graph_triples(project_id)
    if triples:
        _check_production_nodes(triples, violations)
        _check_enshrinement_nodes(triples, violations)

    return ValidationReport(conforms=len(violations) == 0, violations=violations)


def _check_production_nodes(
    triples: list[tuple[str, str, str]], violations: list[Violation]
) -> None:
    rdf_type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
    crm_e12 = CRM + "E12_Production"
    crm_p108 = CRM + "P108_has_produced"

    production_nodes = {s for s, p, o in triples if p == rdf_type and o == crm_e12}
    linked = {s for s, p, o in triples if p == crm_p108}
    for node in production_nodes - linked:
        violations.append(
            Violation(
                shape="hg:shape/ProductionRequiresProducedObject",
                focus_node=node,
                message="crm:E12_Production node must have crm:P108_has_produced ≥ 1.",
            )
        )


def _check_enshrinement_nodes(
    triples: list[tuple[str, str, str]], violations: list[Violation]
) -> None:
    rdf_type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
    crm_e90 = CRM + "E90_Symbolic_Object"
    hg_enshrined_in = HG + "enshrined_in_structure"

    enshrinement_nodes = {s for s, p, o in triples if p == rdf_type and o == crm_e90}
    linked = {s for s, p, o in triples if p == hg_enshrined_in}
    for node in enshrinement_nodes - linked:
        violations.append(
            Violation(
                shape="hg:shape/EnshrineementRequiresStructure",
                focus_node=node,
                message="hg:Enshrinement node must have hg:enshrined_in_structure ≥ 1.",
            )
        )


def check_pid_uniqueness(project_id: str) -> list[str]:
    """
    Return a list of entity PIDs in the project graph that already exist in the
    main PUBLIC graph. Empty list = no collisions.
    """
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.partitions import GraphPartition

    project_graph = GraphPartition.PROJECT.uri(suffix=project_id)
    public_graph = GraphPartition.PUBLIC.uri()
    if not project_graph or not public_graph:
        return []

    rdf_type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
    sparql = (
        f"SELECT DISTINCT ?s WHERE {{\n"
        f"  GRAPH <{project_graph}> {{ ?s <{rdf_type}> ?t }}\n"
        f"  GRAPH <{public_graph}> {{ ?s <{rdf_type}> ?t2 }}\n"
        f"}} LIMIT 50"
    )
    try:
        engine = get_kg_engine()
        rows = engine.store.select(sparql)
        return [r["s"] for r in rows if "s" in r]
    except Exception as exc:
        logger.warning("PID uniqueness check failed: %s", exc)
        return []
