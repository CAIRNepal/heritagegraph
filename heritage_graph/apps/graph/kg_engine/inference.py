"""
Materialize RDFS/OWL-RL inferences into the INFERRED named graph.

Uses ``owlrl`` when installed; reports novelty rate vs the public+schema union.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from apps.graph.kg_engine.partitions import GraphPartition

logger = logging.getLogger(__name__)


@dataclass
class InferenceReport:
    input_triples: int
    inferred_triples: int
    novel_triples: int
    novelty_rate: float
    stored: bool
    consistency_violations: int = 0
    violations: list[tuple[str, str, str]] | None = None


def _sparql_to_rdflib(store: Any) -> "Graph":
    """Build the reasoner input graph from PUBLIC ∪ SCHEMA, preserving RDF term
    kinds. IRIs, blank nodes, and typed/language literals are reconstructed from
    the store's typed iterator — a literal beginning with ``http`` is never
    misread as an IRI (the previous ``startswith('http')`` heuristic corrupted
    the graph fed to OWL-RL)."""
    from rdflib import BNode, Graph, Literal, URIRef

    g = Graph()
    for graph_uri in (GraphPartition.PUBLIC.uri(), GraphPartition.SCHEMA.uri()):
        if not graph_uri:
            continue
        for s, p, term in store.iter_named_graph_terms(graph_uri):
            if not s or not p or term is None:
                continue
            subj, pred = URIRef(s), URIRef(p)
            kind = term.get("kind")
            if kind == "uri":
                g.add((subj, pred, URIRef(term["value"])))
            elif kind == "bnode":
                g.add((subj, pred, BNode(term["value"])))
            else:
                lang, dt = term.get("lang"), term.get("datatype")
                if lang:
                    g.add((subj, pred, Literal(term["value"], lang=lang)))
                elif dt:
                    g.add((subj, pred, Literal(term["value"], datatype=URIRef(dt))))
                else:
                    g.add((subj, pred, Literal(term["value"])))
    return g


def _consistency_violations(graph: "Graph") -> list[tuple[str, str, str]]:
    """Detect class-disjointness violations against the (now-present) owl:disjointWith
    axioms. OWL-RL materialisation alone does not flag these, so we scan the
    closed graph: any individual asserted/entailed into two disjoint classes."""
    from rdflib import OWL, RDF

    disjoint: set[frozenset[str]] = set()
    for a, _, b in graph.triples((None, OWL.disjointWith, None)):
        disjoint.add(frozenset((str(a), str(b))))
    if not disjoint:
        return []

    types: dict[str, set[str]] = {}
    for s, _, o in graph.triples((None, RDF.type, None)):
        types.setdefault(str(s), set()).add(str(o))

    out: list[tuple[str, str, str]] = []
    for indiv, classes in types.items():
        for pair in disjoint:
            if pair <= classes:
                a, b = tuple(pair)
                out.append((indiv, a, b))
    return out


def _expand_inferences(data_graph: "Graph") -> "Graph":
    from rdflib import Graph

    expanded = Graph()
    for triple in data_graph:
        expanded.add(triple)
    try:
        from owlrl import DeductiveClosure, OWLRL_Semantics

        DeductiveClosure(OWLRL_Semantics).expand(expanded)
    except ImportError:
        logger.warning("owlrl not installed — skip inference expansion")
    except Exception as exc:
        logger.warning("owlrl expansion failed (%s) — using base graph only", exc)
    return expanded


def _novel_triples(base: set[tuple], expanded: set[tuple]) -> set[tuple]:
    return {t for t in expanded if t not in base}


def _valid_http_iri(iri: str) -> bool:
    if not iri.startswith("http"):
        return False
    return not any(ch in iri for ch in " \t\n<>\"{}|\\^`")


def materialize_inferred_graph(*, store: Any | None = None) -> InferenceReport:
    from apps.cidoc_data.rdf_entity_projection import _Triple
    from apps.graph.kg_engine.engine import get_kg_engine

    engine = get_kg_engine()
    store = store or engine.store
    base_g = _sparql_to_rdflib(store)
    base_set = {(str(s), str(p), str(o)) for s, p, o in base_g}

    expanded_g = _expand_inferences(base_g)
    expanded_set = {(str(s), str(p), str(o)) for s, p, o in expanded_g}
    novel = _novel_triples(base_set, expanded_set)
    violations = _consistency_violations(expanded_g)
    if violations:
        logger.warning(
            "KG consistency: %d class-disjointness violation(s); first: %s",
            len(violations),
            violations[0],
        )

    fixed: list[Any] = []
    for s, p, o in novel:
        if not _valid_http_iri(str(s)) or not _valid_http_iri(str(p)):
            continue
        if str(o).startswith("http"):
            if not _valid_http_iri(str(o)):
                continue
            fixed.append(_Triple(s, p, o, None))
        else:
            lexical = str(o).replace("\n", " ").strip()
            if not lexical or len(lexical) > 1500:
                continue
            fixed.append(_Triple(s, p, None, (lexical, "")))

    inferred_uri = GraphPartition.INFERRED.uri()
    stored = False
    if engine.enabled() and inferred_uri:
        from apps.cidoc_data.rdf_entity_projection import (
            INSERT_PREFIX_LINES,
            sparql_insert_for_triples,
        )

        store.clear_named_graph(inferred_uri)
        if not fixed:
            stored = True
        elif not store._update_endpoint() and store._local_available():
            stored = store.local_replace_named_graph(inferred_uri, fixed)
        else:
            batch_size = 400
            stored = True
            for i in range(0, len(fixed), batch_size):
                chunk = fixed[i : i + batch_size]
                insert_body = sparql_insert_for_triples(chunk, graph_uri=inferred_uri)
                if insert_body.startswith(INSERT_PREFIX_LINES):
                    insert_body = insert_body[len(INSERT_PREFIX_LINES) :]
                if not store.update(INSERT_PREFIX_LINES + insert_body):
                    stored = False
                    break

    input_n = len(base_set)
    inf_n = max(0, len(expanded_set) - input_n)
    nov_n = len(novel)
    rate = round(nov_n / inf_n, 4) if inf_n else 0.0
    return InferenceReport(
        input_triples=input_n,
        inferred_triples=inf_n,
        novel_triples=nov_n,
        novelty_rate=rate,
        stored=stored,
        consistency_violations=len(violations),
        violations=violations[:50],
    )
