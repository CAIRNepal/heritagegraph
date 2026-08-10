"""
Materialize RDFS/OWL-RL inferences into the INFERRED named graph.

Uses ``owlrl`` when installed; reports novelty rate vs the public+schema union.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from apps.graph.kg_engine.partitions import GraphPartition

if TYPE_CHECKING:
    # rdflib is imported lazily inside the functions below; this makes the
    # string annotations resolvable to type checkers and linters.
    from rdflib import Graph

logger = logging.getLogger(__name__)


@dataclass
class InferenceReport:
    """Outcome of one OWL-RL materialisation pass.

    `inferred_triples` counts everything the reasoner derived that was not
    already asserted. Most of that is bookkeeping -- `x rdf:type owl:Thing`,
    reflexive `owl:sameAs`, closure over the RDF/RDFS/OWL vocabularies -- which
    is entailed but carries no heritage knowledge.

    `novel_triples` counts only the derived statements that survive the
    tautology filter, and `novelty_rate` is that share. This is the figure the
    evaluation harness asks for ("% non-tautological inferences"); reporting
    derived-over-derived instead would always be 1.0 by construction and would
    measure nothing.
    """

    input_triples: int
    inferred_triples: int
    novel_triples: int
    tautological_triples: int
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


# Namespaces whose subjects describe the vocabulary rather than the heritage
# domain. OWL-RL closes over its own axioms, and those entailments say nothing
# about Nepalese heritage.
_VOCABULARY_NAMESPACES = (
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "http://www.w3.org/2000/01/rdf-schema#",
    "http://www.w3.org/2002/07/owl#",
    "http://www.w3.org/2001/XMLSchema#",
)

# Types every resource trivially belongs to.
_TRIVIAL_TYPES = (
    "http://www.w3.org/2002/07/owl#Thing",
    "http://www.w3.org/2000/01/rdf-schema#Resource",
    "http://www.w3.org/2002/07/owl#NamedIndividual",
)

# Predicates that OWL-RL always derives reflexively (x R x).
_REFLEXIVE_PREDICATES = (
    "http://www.w3.org/2002/07/owl#sameAs",
    "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    "http://www.w3.org/2000/01/rdf-schema#subPropertyOf",
    "http://www.w3.org/2002/07/owl#equivalentClass",
    "http://www.w3.org/2002/07/owl#equivalentProperty",
)

_RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


def _derived_triples(base: set[tuple], expanded: set[tuple]) -> set[tuple]:
    """Triples the reasoner produced that were not already asserted."""
    return expanded - base


def _is_tautological(triple: tuple[str, str, str]) -> bool:
    """True when a derived triple is entailed but carries no domain knowledge.

    Filtered out:
      - membership of a universal class (owl:Thing, rdfs:Resource, …)
      - reflexive identity/subsumption (x owl:sameAs x, c rdfs:subClassOf c, …)
      - closure over the RDF/RDFS/OWL/XSD vocabularies themselves
    """
    subject, predicate, obj = triple

    if predicate == _RDF_TYPE and obj in _TRIVIAL_TYPES:
        return True

    if predicate in _REFLEXIVE_PREDICATES and subject == obj:
        return True

    if subject.startswith(_VOCABULARY_NAMESPACES):
        return True

    return False


def _partition_derived(
    derived: set[tuple],
) -> tuple[set[tuple], set[tuple]]:
    """Split derived triples into (informative, tautological)."""
    informative: set[tuple] = set()
    tautological: set[tuple] = set()
    for triple in derived:
        if _is_tautological(triple):
            tautological.add(triple)
        else:
            informative.add(triple)
    return informative, tautological


def _valid_http_iri(iri: str) -> bool:
    if not iri.startswith("http"):
        return False
    return not any(ch in iri for ch in ' \t\n<>"{}|\\^`')


def materialize_inferred_graph(*, store: Any | None = None) -> InferenceReport:
    from apps.cidoc_data.rdf_entity_projection import _Triple
    from apps.graph.kg_engine.engine import get_kg_engine

    engine = get_kg_engine()
    store = store or engine.store
    base_g = _sparql_to_rdflib(store)
    base_set = {(str(s), str(p), str(o)) for s, p, o in base_g}

    expanded_g = _expand_inferences(base_g)
    expanded_set = {(str(s), str(p), str(o)) for s, p, o in expanded_g}
    derived = _derived_triples(base_set, expanded_set)
    novel, tautological = _partition_derived(derived)
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
    derived_n = len(derived)
    nov_n = len(novel)
    taut_n = len(tautological)
    rate = round(nov_n / derived_n, 4) if derived_n else 0.0
    return InferenceReport(
        input_triples=input_n,
        inferred_triples=derived_n,
        novel_triples=nov_n,
        tautological_triples=taut_n,
        novelty_rate=rate,
        stored=stored,
        consistency_violations=len(violations),
        violations=violations[:50],
    )
