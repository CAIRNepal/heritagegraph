"""Federated museum projection — curated PUBLIC plus *linked* LUX stubs.

Yale LUX bulk data lives in ``imported/lux`` (and ``lux.collections.yale.edu``).
The heritage museum shows LUX only when a stub is anchored to a curated entity via
``skos:exactMatch`` (direct or via Yale ``owl:sameAs``), or via a bounded
label-match bootstrap. The full 3M+ Yale graph is never served in isolation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.queries import fetch_graph_projection
from apps.graph.kg_engine.store import KnowledgeGraphStore
from apps.graph.kg_engine.uris import curated_resource_uri_prefix
from apps.graph.ontology_config import RDF_PREFIXES

RDF = RDF_PREFIXES["rdf"]
RDFS = RDF_PREFIXES["rdfs"]
SKOS = RDF_PREFIXES["skos"]
OWL = RDF_PREFIXES["owl"]
YALE_LUX_PREFIX = "https://lux.collections.yale.edu/"


def lux_imported_graph_uri() -> str:
    override = str(getattr(settings, "RDF_LUX_IMPORTED_GRAPH_URI", "") or "").strip()
    if override:
        return override
    return GraphPartition.IMPORTED.uri(suffix="lux") or ""


def is_lux_stub_uri(iri: str | None) -> bool:
    return bool(iri and "/imported/lux/" in str(iri))


def museum_include_lux_default() -> bool:
    return bool(getattr(settings, "RDF_MUSEUM_INCLUDE_LUX", True))


def museum_lux_sample_limit() -> int:
    """How many *connected* LUX stub nodes to surface as an external layer even
    when no curated entity links to them. 0 disables the sample (linked-only)."""
    return int(getattr(settings, "RDF_LUX_SAMPLE_LIMIT", 400))


def lux_connected_sample_query(*, lux_uri: str, limit: int) -> str:
    """A bounded sample of LUX↔LUX edges (both ends typed) — the connected
    sub-graph of the imported Yale LUX stubs, shown as a labelled external layer."""
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
PREFIX owl: <{OWL}>
SELECT DISTINCT ?s ?p ?o ?plabel WHERE {{
  GRAPH <{lux_uri}> {{
    ?s ?p ?o .
    ?s rdf:type ?st .
    ?o rdf:type ?ot .
    FILTER(isIRI(?o))
    FILTER(?p != rdf:type && ?p != rdfs:label && ?p != rdfs:comment && ?p != owl:sameAs)
    OPTIONAL {{ ?p rdfs:label ?plabel }}
  }}
}}
LIMIT {int(limit)}
"""


def lux_read_store(base: KnowledgeGraphStore | None = None) -> KnowledgeGraphStore:
    """SPARQL reads for ``imported/lux`` — may use a separate remote endpoint."""
    lux_url = str(getattr(settings, "RDF_LUX_QUERY_URL", "") or "").strip()
    if lux_url:
        return KnowledgeGraphStore(query_url=lux_url)
    return base or KnowledgeGraphStore()


def _sparql_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


@dataclass(frozen=True)
class LuxLink:
    curated: str
    lux: str
    external: str | None
    method: str  # exactMatch | label


def public_exact_matches_query(*, public_uri: str) -> str:
    prefix = curated_resource_uri_prefix()
    return f"""
PREFIX skos: <{SKOS}>
SELECT ?curated ?target WHERE {{
  GRAPH <{public_uri}> {{
    ?curated skos:exactMatch ?target .
    FILTER(STRSTARTS(STR(?curated), "{prefix}"))
  }}
}}
"""


def lux_stub_for_yale_query(*, lux_uri: str, yale_uri: str) -> str:
    return f"""
PREFIX owl: <{OWL}>
PREFIX rdf: <{RDF}>
SELECT ?lux ?external WHERE {{
  GRAPH <{lux_uri}> {{
    ?lux owl:sameAs <{yale_uri}> .
    ?lux rdf:type ?t .
    OPTIONAL {{
      ?lux owl:sameAs ?external .
      FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
    }}
  }}
}}
LIMIT 1
"""


def lux_external_for_stub_query(*, lux_uri: str, lux_iri: str) -> str:
    return f"""
PREFIX owl: <{OWL}>
SELECT ?external WHERE {{
  GRAPH <{lux_uri}> {{
    <{lux_iri}> owl:sameAs ?external .
    FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
  }}
}}
LIMIT 1
"""


def explicit_lux_links_query(*, public_uri: str, lux_uri: str, limit: int) -> str:
    prefix = curated_resource_uri_prefix()
    return f"""
PREFIX skos: <{SKOS}>
PREFIX owl: <{OWL}>
PREFIX rdf: <{RDF}>
SELECT DISTINCT ?curated ?lux ?external WHERE {{
  {{
    GRAPH <{public_uri}> {{
      ?curated skos:exactMatch ?lux .
      FILTER(STRSTARTS(STR(?curated), "{prefix}"))
      FILTER(CONTAINS(STR(?lux), "/imported/lux/"))
    }}
    OPTIONAL {{
      GRAPH <{lux_uri}> {{
        ?lux owl:sameAs ?external .
        FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
      }}
    }}
  }}
  UNION
  {{
    GRAPH <{public_uri}> {{
      ?curated skos:exactMatch ?external .
      FILTER(STRSTARTS(STR(?curated), "{prefix}"))
      FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
    }}
    GRAPH <{lux_uri}> {{
      ?lux owl:sameAs ?external .
      ?lux rdf:type ?t .
    }}
  }}
}}
LIMIT {int(limit)}
"""


def lux_label_lookup_query(*, lux_uri: str, label: str) -> str:
    safe = _sparql_escape(label.strip())
    return f"""
PREFIX rdfs: <{RDFS}>
PREFIX rdf: <{RDF}>
PREFIX owl: <{OWL}>
SELECT ?lux ?label ?type ?external WHERE {{
  GRAPH <{lux_uri}> {{
    ?lux rdfs:label ?label .
    ?lux rdf:type ?type .
    FILTER(LCASE(STR(?label)) = LCASE("{safe}"))
    OPTIONAL {{
      ?lux owl:sameAs ?external .
      FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
    }}
  }}
}}
LIMIT 3
"""


def lux_nodes_query(*, lux_uri: str, iris: list[str]) -> str:
    if not iris:
        return ""
    values = " ".join(f"<{iri}>" for iri in iris)
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
PREFIX owl: <{OWL}>
SELECT DISTINCT ?s ?type ?label ?comment ?wkt ?external WHERE {{
  GRAPH <{lux_uri}> {{
    VALUES ?s {{ {values} }}
    ?s rdf:type ?type .
    OPTIONAL {{ ?s rdfs:label ?label }}
    OPTIONAL {{ ?s rdfs:comment ?comment }}
    OPTIONAL {{
      ?s ?geop ?wkt .
      FILTER(isLiteral(?wkt) && CONTAINS(STR(?wkt), "POINT"))
    }}
    OPTIONAL {{
      ?s owl:sameAs ?external .
      FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
    }}
  }}
}}
"""


def lux_internal_edges_query(*, lux_uri: str, iris: list[str], limit: int) -> str:
    if not iris:
        return ""
    values = " ".join(f"<{iri}>" for iri in iris)
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
PREFIX owl: <{OWL}>
SELECT DISTINCT ?s ?p ?o ?plabel WHERE {{
  GRAPH <{lux_uri}> {{
    VALUES ?s {{ {values} }}
    VALUES ?o {{ {values} }}
    ?s ?p ?o .
    ?s rdf:type ?st .
    ?o rdf:type ?ot .
    OPTIONAL {{ ?p rdfs:label ?plabel }}
    FILTER(isIRI(?o))
    FILTER(?p != rdf:type && ?p != rdfs:label && ?p != rdfs:comment)
    FILTER(?p != owl:sameAs)
  }}
}}
LIMIT {int(limit)}
"""


def _normalize_label(label: str | None) -> str:
    if not label:
        return ""
    text = re.sub(r"\s+", " ", str(label).strip().lower())
    return text


def discover_lux_links(
    *,
    store: KnowledgeGraphStore,
    curated_iris: set[str],
    curated_labels: dict[str, str],
    link_limit: int,
    label_match_limit: int,
) -> list[LuxLink]:
    public_uri = GraphPartition.PUBLIC.uri()
    lux_uri = lux_imported_graph_uri()
    if not public_uri or not lux_uri or not curated_iris:
        return []

    links: list[LuxLink] = []
    seen_curated: set[str] = set()
    seen_lux: set[str] = set()

    curated_store = store
    lux_store = lux_read_store(store)
    split_endpoints = (
        curated_store._query_endpoint() != lux_store._query_endpoint()  # noqa: SLF001
    )

    if split_endpoints:
        for row in curated_store.select(
            public_exact_matches_query(public_uri=public_uri)
        ):
            curated = row.get("curated")
            target = row.get("target")
            if not curated or not target or curated not in curated_iris:
                continue
            if curated in seen_curated:
                continue
            lux = None
            external = None
            if "/imported/lux/" in str(target):
                lux = str(target)
                for ext_row in lux_store.select(
                    lux_external_for_stub_query(lux_uri=lux_uri, lux_iri=lux)
                ):
                    external = ext_row.get("external")
            elif str(target).startswith(YALE_LUX_PREFIX):
                external = str(target)
                for lux_row in lux_store.select(
                    lux_stub_for_yale_query(lux_uri=lux_uri, yale_uri=external)
                ):
                    lux = lux_row.get("lux")
                    external = lux_row.get("external") or external
            if not lux or lux in seen_lux:
                continue
            seen_curated.add(curated)
            seen_lux.add(lux)
            links.append(
                LuxLink(
                    curated=curated,
                    lux=lux,
                    external=external,
                    method="exactMatch",
                )
            )
            if len(links) >= link_limit:
                return links
    else:
        for row in curated_store.select(
            explicit_lux_links_query(
                public_uri=public_uri, lux_uri=lux_uri, limit=link_limit
            )
        ):
            curated = row.get("curated")
            lux = row.get("lux")
            if not curated or not lux or curated not in curated_iris:
                continue
            if curated in seen_curated or lux in seen_lux:
                continue
            seen_curated.add(curated)
            seen_lux.add(lux)
            links.append(
                LuxLink(
                    curated=curated,
                    lux=lux,
                    external=row.get("external") or None,
                    method="exactMatch",
                )
            )
            if len(links) >= link_limit:
                return links

    if label_match_limit <= 0:
        return links

    label_candidates = [
        (iri, _normalize_label(label))
        for iri, label in curated_labels.items()
        if iri in curated_iris and iri not in seen_curated and _normalize_label(label)
    ]
    label_candidates.sort(key=lambda pair: len(pair[1]))

    for curated, norm_label in label_candidates[: label_match_limit * 3]:
        if len([ln for ln in links if ln.method == "label"]) >= label_match_limit:
            break
        if curated in seen_curated:
            continue
        for row in lux_store.select(
            lux_label_lookup_query(lux_uri=lux_uri, label=norm_label)
        ):
            lux = row.get("lux")
            if not lux or lux in seen_lux:
                continue
            seen_curated.add(curated)
            seen_lux.add(lux)
            links.append(
                LuxLink(
                    curated=curated,
                    lux=lux,
                    external=row.get("external") or None,
                    method="label",
                )
            )
            break

    return links[:link_limit]


def fetch_museum_projection_with_lux(
    *,
    store: KnowledgeGraphStore | None = None,
    node_limit: int = 600,
    edge_limit: int = 3000,
    lux_link_limit: int | None = None,
    lux_label_match_limit: int | None = None,
) -> dict[str, list[dict[str, str]] | list[LuxLink]]:
    kg = store or KnowledgeGraphStore()
    curated = fetch_graph_projection(
        store=kg, node_limit=node_limit, edge_limit=edge_limit
    )

    link_cap = lux_link_limit
    if link_cap is None:
        link_cap = int(getattr(settings, "RDF_LUX_LINKED_NODE_LIMIT", 150))
    label_cap = lux_label_match_limit
    if label_cap is None:
        label_cap = int(getattr(settings, "RDF_LUX_LABEL_MATCH_LIMIT", 40))

    curated_iris: set[str] = set()
    curated_labels: dict[str, str] = {}
    for row in curated["nodes"]:
        iri = row.get("s")
        if not iri:
            continue
        curated_iris.add(iri)
        if row.get("label"):
            curated_labels[iri] = str(row["label"])

    links = discover_lux_links(
        store=kg,
        curated_iris=curated_iris,
        curated_labels=curated_labels,
        link_limit=link_cap,
        label_match_limit=label_cap,
    )
    lux_uri = lux_imported_graph_uri()
    lux_store = lux_read_store(kg)

    # Connected sample of LUX stubs — surfaced as a labelled external layer even
    # when nothing curated links to them, so the museum can show Yale LUX.
    sample_edges: list[dict[str, str]] = []
    sampled_iris: set[str] = set()
    sample_limit = museum_lux_sample_limit()
    if lux_uri and sample_limit > 0:
        for row in lux_store.select(
            lux_connected_sample_query(
                lux_uri=lux_uri, limit=min(sample_limit * 4, max(edge_limit, 1000))
            )
        ):
            s, o = row.get("s"), row.get("o")
            if not s or not o:
                continue
            if (
                len(sampled_iris) >= sample_limit
                and s not in sampled_iris
                and o not in sampled_iris
            ):
                continue
            sampled_iris.add(s)
            sampled_iris.add(o)
            sample_edges.append(
                {"s": s, "p": row.get("p"), "o": o, "plabel": row.get("plabel")}
            )

    if not links and not sampled_iris:
        return {**curated, "lux_links": links, "lux_sampled": []}

    link_iris = [link.lux for link in links]
    all_lux_iris = list(dict.fromkeys(link_iris + sorted(sampled_iris)))
    # Fetch node detail in batches — a single VALUES clause with hundreds of IRIs
    # overflows the SPARQL GET URL and silently returns nothing.
    lux_nodes: list[dict[str, str]] = []
    for i in range(0, len(all_lux_iris), 30):
        chunk = all_lux_iris[i : i + 30]
        lux_nodes.extend(lux_store.select(lux_nodes_query(lux_uri=lux_uri, iris=chunk)))
    lux_edges = (
        lux_store.select(
            lux_internal_edges_query(
                lux_uri=lux_uri, iris=link_iris, limit=min(edge_limit, 5000)
            )
        )
        if link_iris
        else []
    )

    bridge_edges: list[dict[str, str]] = []
    for link in links:
        bridge_edges.append(
            {
                "s": link.curated,
                "p": f"{SKOS}exactMatch",
                "o": link.lux,
                "plabel": "exact match",
            }
        )

    return {
        "nodes": list(curated["nodes"]) + lux_nodes,
        "edges": list(curated["edges"]) + lux_edges + sample_edges + bridge_edges,
        "lux_links": links,
        "lux_sampled": sorted(sampled_iris),
    }


def lux_neighborhood_query(*, subject_uri: str, lux_uri: str, limit: int) -> str:
    return f"""
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
PREFIX owl: <{OWL}>
SELECT ?direction ?predicate ?value ?valueLabel ?valueType WHERE {{
  {{
    GRAPH <{lux_uri}> {{
      <{subject_uri}> ?predicate ?value .
      BIND("outbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
      OPTIONAL {{ ?value rdf:type ?valueType }}
      FILTER(!isIRI(?value) || !STRSTARTS(STR(?value), "{YALE_LUX_PREFIX}"))
      FILTER(?predicate != owl:sameAs)
    }}
  }}
  UNION
  {{
    GRAPH <{lux_uri}> {{
      ?value ?predicate <{subject_uri}> .
      BIND("inbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
      OPTIONAL {{ ?value rdf:type ?valueType }}
      FILTER(!isIRI(?value) || !STRSTARTS(STR(?value), "{YALE_LUX_PREFIX}"))
      FILTER(?predicate != owl:sameAs)
    }}
  }}
}}
LIMIT {int(limit)}
"""


def curated_lux_bridge_neighbors_query(
    *, subject_uri: str, public_uri: str, lux_uri: str, limit: int
) -> str:
    return f"""
PREFIX skos: <{SKOS}>
PREFIX owl: <{OWL}>
PREFIX rdf: <{RDF}>
PREFIX rdfs: <{RDFS}>
SELECT ?direction ?predicate ?value ?valueLabel ?valueType WHERE {{
  {{
    GRAPH <{public_uri}> {{
      <{subject_uri}> skos:exactMatch ?target .
      BIND("{SKOS}exactMatch" AS ?predicate)
      BIND("outbound" AS ?direction)
    }}
    {{
      BIND(?target AS ?value)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
      OPTIONAL {{ ?value rdf:type ?valueType }}
    }}
    FILTER(CONTAINS(STR(?value), "/imported/lux/"))
  }}
  UNION
  {{
    GRAPH <{public_uri}> {{
      <{subject_uri}> skos:exactMatch ?external .
      FILTER(STRSTARTS(STR(?external), "{YALE_LUX_PREFIX}"))
    }}
    GRAPH <{lux_uri}> {{
      ?value owl:sameAs ?external .
      ?value rdf:type ?valueType .
      BIND("{SKOS}exactMatch" AS ?predicate)
      BIND("outbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
    }}
  }}
  UNION
  {{
    GRAPH <{public_uri}> {{
      ?value skos:exactMatch <{subject_uri}> .
      BIND("{SKOS}exactMatch" AS ?predicate)
      BIND("inbound" AS ?direction)
      OPTIONAL {{ ?value rdfs:label ?valueLabel }}
      OPTIONAL {{ ?value rdf:type ?valueType }}
    }}
    FILTER(CONTAINS(STR(?value), "/imported/lux/"))
  }}
}}
LIMIT {int(limit)}
"""


def _lux_node_row(
    lux_iri: str,
    *,
    lux_store: KnowledgeGraphStore,
    lux_uri: str,
    label: str | None = None,
    type_iri: str | None = None,
) -> dict[str, str]:
    row: dict[str, str] = {
        "direction": "outbound",
        "predicate": f"{SKOS}exactMatch",
        "value": lux_iri,
    }
    if label:
        row["valueLabel"] = label
    if type_iri:
        row["valueType"] = type_iri
        return row
    for type_row in lux_store.select(
        f"""
PREFIX rdf: <{RDF}>
SELECT ?type WHERE {{
  GRAPH <{lux_uri}> {{ <{lux_iri}> rdf:type ?type }}
}}
LIMIT 1
"""
    ):
        if type_row.get("type"):
            row["valueType"] = type_row["type"]
    for label_row in lux_store.select(
        f"""
PREFIX rdfs: <{RDFS}>
SELECT ?label WHERE {{
  GRAPH <{lux_uri}> {{ <{lux_iri}> rdfs:label ?label }}
}}
LIMIT 1
"""
    ):
        if not row.get("valueLabel") and label_row.get("label"):
            row["valueLabel"] = label_row["label"]
    return row


def bridge_neighbors_for_curated(
    subject_uri: str,
    *,
    curated_store: KnowledgeGraphStore,
    lux_store: KnowledgeGraphStore,
    public_uri: str,
    lux_uri: str,
    limit: int,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for match in curated_store.select(
        f"""
PREFIX skos: <{SKOS}>
SELECT ?target WHERE {{
  GRAPH <{public_uri}> {{ <{subject_uri}> skos:exactMatch ?target }}
}}
LIMIT {int(limit)}
"""
    ):
        target = match.get("target")
        if not target:
            continue
        if "/imported/lux/" in str(target):
            rows.append(
                _lux_node_row(
                    str(target), lux_store=lux_store, lux_uri=lux_uri
                )
            )
        elif str(target).startswith(YALE_LUX_PREFIX):
            for lux_row in lux_store.select(
                lux_stub_for_yale_query(lux_uri=lux_uri, yale_uri=str(target))
            ):
                lux = lux_row.get("lux")
                if lux:
                    rows.append(
                        _lux_node_row(
                            lux,
                            lux_store=lux_store,
                            lux_uri=lux_uri,
                        )
                    )
        if len(rows) >= limit:
            break
    return rows[:limit]


def fetch_federated_neighborhood(
    subject_uri: str,
    *,
    limit: int = 50,
    store: KnowledgeGraphStore | None = None,
    include_lux: bool = True,
) -> list[dict[str, str]]:
    from apps.graph.kg_engine.queries import neighborhood_query

    kg = store or KnowledgeGraphStore()
    public_uri = GraphPartition.PUBLIC.uri()
    lux_uri = lux_imported_graph_uri()

    lux_store = lux_read_store(kg)
    if is_lux_stub_uri(subject_uri) and lux_uri:
        rows = lux_store.select(
            lux_neighborhood_query(
                subject_uri=subject_uri, lux_uri=lux_uri, limit=limit
            )
        )
        return rows[:limit]

    rows = kg.select(
        neighborhood_query(subject_uri, graph_uri=public_uri, limit=limit)
    )
    if not include_lux or not museum_include_lux_default() or not lux_uri:
        return rows[:limit]

    if kg._query_endpoint() != lux_store._query_endpoint():  # noqa: SLF001
        bridge = bridge_neighbors_for_curated(
            subject_uri,
            curated_store=kg,
            lux_store=lux_store,
            public_uri=public_uri or "",
            lux_uri=lux_uri,
            limit=max(10, limit // 2),
        )
    else:
        bridge = kg.select(
            curated_lux_bridge_neighbors_query(
                subject_uri=subject_uri,
                public_uri=public_uri or "",
                lux_uri=lux_uri,
                limit=max(10, limit // 2),
            )
        )
    merged = rows + bridge
    return merged[:limit]
