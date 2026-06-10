"""Canned SPARQL for the knowledge graph engine."""

from __future__ import annotations

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.store import KnowledgeGraphStore
from apps.graph.kg_engine.uris import curated_resource_uri_filter

RDFS = "http://www.w3.org/2000/01/rdf-schema#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"


def neighborhood_query(subject_uri: str, *, graph_uri: str | None, limit: int = 50) -> str:
    graph_clause = f"GRAPH <{graph_uri}>" if graph_uri else ""
    # `?valueType` lets the museum type/colour expanded neighbours straight from
    # their rdf:type (via RDF_CLASS_URI_TO_NODE_TYPE) — same as the full graph.
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
SELECT ?direction ?predicate ?value ?valueLabel ?valueType WHERE {{
  {{
    {graph_clause} {{
      <{subject_uri}> ?predicate ?value .
      BIND("outbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
      OPTIONAL {{ ?value rdf:type ?valueType }}
    }}
  }}
  UNION
  {{
    {graph_clause} {{
      ?value ?predicate <{subject_uri}> .
      BIND("inbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
      OPTIONAL {{ ?value rdf:type ?valueType }}
    }}
  }}
}}
LIMIT {int(limit)}
"""


def entity_types_query(*, graph_uri: str | None, limit: int = 200) -> str:
    graph_clause = f"GRAPH <{graph_uri}>" if graph_uri else ""
    return f"""
SELECT ?type (COUNT(?s) AS ?count) WHERE {{
  {graph_clause} {{
    ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type .
  }}
}}
GROUP BY ?type
ORDER BY DESC(?count)
LIMIT {int(limit)}
"""


def fetch_neighborhood(
    subject_uri: str, *, limit: int = 50, store: KnowledgeGraphStore | None = None
) -> list[dict[str, str]]:
    kg = store or KnowledgeGraphStore()
    sparql = neighborhood_query(
        subject_uri, graph_uri=GraphPartition.PUBLIC.uri(), limit=limit
    )
    return kg.select(sparql)


def fetch_type_counts(*, store: KnowledgeGraphStore | None = None) -> list[dict[str, str]]:
    kg = store or KnowledgeGraphStore()
    sparql = entity_types_query(graph_uri=GraphPartition.PUBLIC.uri())
    return kg.select(sparql)


# ── Whole-graph projection (museum live view) ─────────────────────────────────
#
# Two bounded queries — typed nodes, and edges *between* two typed nodes — so the
# museum renders the real KG (ontology rdf:type + actual triples) instead of the
# client-side heuristic reconstruction. Geometry is surfaced as a WKT literal
# (POINT) so the map view keeps working.


def graph_nodes_query(*, graph_uri: str | None, limit: int = 600) -> str:
    graph_clause = f"GRAPH <{graph_uri}>" if graph_uri else ""
    curated = curated_resource_uri_filter(var="?s")
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX schema: <https://schema.org/>
SELECT DISTINCT ?s ?type ?label ?comment ?crmNote ?image ?wkt WHERE {{
  {graph_clause} {{
    ?s rdf:type ?type .
    OPTIONAL {{ ?s rdfs:label ?label }}
    OPTIONAL {{ ?s rdfs:comment ?comment }}
    OPTIONAL {{ ?s crm:P3_has_note ?crmNote }}
    OPTIONAL {{ ?s schema:image ?image }}
    OPTIONAL {{ ?s ?geop ?wkt . FILTER(isLiteral(?wkt) && CONTAINS(STR(?wkt), "POINT")) }}
    FILTER(STRSTARTS(STR(?type), "http"))
    {curated}
  }}
}}
LIMIT {int(limit)}
"""


def graph_edges_query(*, graph_uri: str | None, limit: int = 3000) -> str:
    graph_clause = f"GRAPH <{graph_uri}>" if graph_uri else ""
    curated_s = curated_resource_uri_filter(var="?s")
    curated_o = curated_resource_uri_filter(var="?o")
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
SELECT DISTINCT ?s ?p ?o ?plabel WHERE {{
  {graph_clause} {{
    ?s ?p ?o .
    ?s rdf:type ?st .
    ?o rdf:type ?ot .
    OPTIONAL {{ ?p rdfs:label ?plabel }}
    FILTER(isIRI(?o))
    FILTER(?p != rdf:type && ?p != rdfs:label && ?p != rdfs:comment)
    {curated_s}
    {curated_o}
  }}
}}
LIMIT {int(limit)}
"""


def fetch_graph_projection(
    *,
    store: KnowledgeGraphStore | None = None,
    node_limit: int = 600,
    edge_limit: int = 3000,
) -> dict[str, list[dict[str, str]]]:
    kg = store or KnowledgeGraphStore()
    graph_uri = GraphPartition.PUBLIC.uri()
    return {
        "nodes": kg.select(graph_nodes_query(graph_uri=graph_uri, limit=node_limit)),
        "edges": kg.select(graph_edges_query(graph_uri=graph_uri, limit=edge_limit)),
    }
