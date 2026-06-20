"""VoID + DCAT dataset description generator with live triple counts from Oxigraph."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def generate_void_dcat() -> str:
    """Query Oxigraph for live counts and render a void-dataset.ttl string."""
    from django.conf import settings

    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.partitions import GraphPartition

    engine = get_kg_engine()
    base = str(
        getattr(settings, "RDF_RESOURCE_BASE_URI", "https://w3id.org/heritagegraph")
    ).rstrip("/")
    sparql_url = (
        str(getattr(settings, "RDF_PUBLIC_SPARQL_URL", "") or "").strip()
        or "/cidoc/sparql/"
    )
    public_graph = GraphPartition.PUBLIC.uri() or f"{base}/graph/public"

    # ── Live triple count ────────────────────────────────────────────────────
    total_triples = 0
    try:
        rows = engine.store.select(
            "SELECT (COUNT(*) AS ?c) WHERE { { ?s ?p ?o } UNION { GRAPH ?g { ?s ?p ?o } } }"
        )
        if rows:
            total_triples = int(rows[0].get("c", 0) or 0)
    except Exception as exc:
        logger.warning("void_generator: triple count query failed: %s", exc)

    # ── Distinct RDF types present in the public graph ───────────────────────
    distinct_types: list[str] = []
    try:
        rdf_type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        type_rows = engine.store.select(
            f"SELECT DISTINCT ?type WHERE {{"
            f"  GRAPH <{public_graph}> {{ ?s <{rdf_type}> ?type }}"
            f"}} LIMIT 100"
        )
        distinct_types = [r["type"] for r in type_rows if r.get("type")]
    except Exception as exc:
        logger.warning("void_generator: type query failed: %s", exc)

    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    classes_block = ""
    if distinct_types:
        classes_block = (
            "\n".join(
                f"  void:class <{t}> ;" for t in distinct_types[:50]
            )
            + "\n"
        )

    return (
        "@prefix void: <http://rdfs.org/ns/void#> .\n"
        "@prefix dcat: <http://www.w3.org/ns/dcat#> .\n"
        "@prefix dcterms: <http://purl.org/dc/terms/> .\n"
        "@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n"
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n"
        "\n"
        "<https://w3id.org/heritagegraph/dataset/public>\n"
        "  a void:Dataset, dcat:Dataset ;\n"
        '  dcterms:title "HeritageGraph public knowledge graph"@en ;\n'
        "  dcterms:description"
        ' "CIDOC-CRM assertions on cultural heritage sites and objects in Nepal,'
        ' maintained by CAIR-Nepal."@en ;\n'
        "  dcterms:creator <https://cairnepal.org/> ;\n"
        "  dcterms:license <https://creativecommons.org/licenses/by/4.0/> ;\n"
        f'  dcterms:issued "{now_iso}"^^xsd:dateTime ;\n'
        '  dcat:version "1.0" ;\n'
        f"  void:triples {total_triples} ;\n"
        f"  void:uriSpace <{base}/> ;\n"
        f"  void:sparqlEndpoint <{sparql_url}> ;\n"
        f"  void:subset <{public_graph}> ;\n"
        f"{classes_block}"
        "  dcat:distribution [\n"
        "    a dcat:Distribution ;\n"
        '    dcterms:format "text/turtle" ;\n'
        f"    dcat:accessURL <{base}/lod/dataset/> ;\n"
        '    dcat:mediaType "text/turtle" ;\n'
        "  ] , [\n"
        "    a dcat:Distribution ;\n"
        '    dcterms:format "application/ld+json" ;\n'
        f"    dcat:accessURL <{base}/lod/dataset/> ;\n"
        '    dcat:mediaType "application/ld+json" ;\n'
        "  ] .\n"
    )
