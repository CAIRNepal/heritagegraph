"""Canned SPARQL for the knowledge graph engine."""

from __future__ import annotations

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.store import KnowledgeGraphStore

RDFS = "http://www.w3.org/2000/01/rdf-schema#"


def neighborhood_query(subject_uri: str, *, graph_uri: str | None, limit: int = 50) -> str:
    graph_clause = f"GRAPH <{graph_uri}>" if graph_uri else ""
    return f"""
PREFIX rdfs: <{RDFS}>
SELECT ?direction ?predicate ?value ?valueLabel WHERE {{
  {{
    {graph_clause} {{
      <{subject_uri}> ?predicate ?value .
      BIND("outbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
    }}
  }}
  UNION
  {{
    {graph_clause} {{
      ?value ?predicate <{subject_uri}> .
      BIND("inbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
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
