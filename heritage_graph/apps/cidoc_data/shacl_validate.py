"""
SHACL validation for registry-driven RDF projections (existing generated shapes).

Uses ``ontology/shapes/generated-heritagegraph-minimal-shacl.ttl`` — no ontology edits.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_shapes_graph():
    from rdflib import Graph

    from apps.graph.rdf_publish import default_shapes_path

    path = default_shapes_path()
    if not path.is_file():
        raise FileNotFoundError(f"SHACL shapes not found: {path}")
    shapes = Graph()
    shapes.parse(str(path), format="turtle")
    return shapes


def triples_to_rdflib_graph(triples: list[Any]):
    """Build an in-memory RDF graph from projection ``_Triple`` rows."""
    from rdflib import Graph, Literal, URIRef

    from apps.cidoc_data.rdf_entity_projection import RDF_PREFIXES

    graph = Graph()
    for prefix, uri in RDF_PREFIXES.items():
        graph.bind(prefix, uri)

    for triple in triples:
        subject = URIRef(triple.subj)
        predicate = URIRef(triple.pred)
        if triple.obj_uri:
            graph.add((subject, predicate, URIRef(triple.obj_uri)))
            continue
        if not triple.literal:
            continue
        lexical, datatype = triple.literal
        if not datatype:
            graph.add((subject, predicate, Literal(lexical)))
            continue
        if datatype.endswith("wktLiteral"):
            graph.add(
                (subject, predicate, Literal(lexical, datatype=URIRef(datatype)))
            )
        elif datatype.startswith(RDF_PREFIXES["xsd"]):
            local = datatype.removeprefix(RDF_PREFIXES["xsd"])
            from rdflib.namespace import XSD

            xsd_type = getattr(XSD, local, None)
            if xsd_type is not None:
                graph.add((subject, predicate, Literal(lexical, datatype=xsd_type)))
            else:
                graph.add(
                    (subject, predicate, Literal(lexical, datatype=URIRef(datatype))
                )
        else:
            graph.add((subject, predicate, Literal(lexical, datatype=URIRef(datatype)))
    return graph


def validate_projection_triples(triples: list[Any]) -> tuple[bool, str]:
    """
    Validate projected triples against generated SHACL shapes.

    Returns ``(conforms, report_text)``. When pyshacl or shapes are missing, returns
    ``(True, "")`` so publication is not blocked in dev environments.
    """
    if not triples:
        return True, ""

    try:
        import pyshacl
    except ImportError:
        logger.debug("pyshacl not installed; skipping SHACL validation on write")
        return True, ""

    try:
        shapes = _load_shapes_graph()
    except FileNotFoundError as exc:
        logger.warning("%s", exc)
        return True, ""

    data = triples_to_rdflib_graph(triples)
    try:
        conforms, _, report_text = pyshacl.validate(
            data,
            shacl_graph=shapes,
            inference="rdfs",
            abort_on_first=False,
            meta_shacl=False,
        )
        return bool(conforms), str(report_text or "")
    except Exception as exc:
        logger.warning("SHACL validation error: %s", exc)
        if getattr(settings, "RDF_SHACL_FAIL_OPEN_ON_ERROR", True):
            return True, str(exc)
        return False, str(exc)


def validate_shacl_if_enabled(data_graph: Any, shapes_graph: Any | None = None) -> None:
    """Legacy hook — prefer ``validate_projection_triples``."""
    del shapes_graph
    if data_graph is None:
        return
    try:
        import pyshacl
    except ImportError:
        return
    shapes = _load_shapes_graph()
    conforms, report = pyshacl.validate(
        data_graph,
        shacl_graph=shapes,
        inference="rdfs",
        abort_on_first=False,
        meta_shacl=False,
    )
    if not conforms:
        raise ValueError(report)
