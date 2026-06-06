"""Knowledge graph HTTP API (SPARQL-backed)."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

import re

from apps.cidoc_data.rdf_signals import is_readonly_sparql_query
from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition

_POINT_RE = re.compile(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", re.IGNORECASE)


def _local_name(iri: str) -> str:
    """Local name of an IRI (after the last # or /)."""
    if not iri:
        return ""
    for sep in ("#", "/"):
        if sep in iri:
            iri = iri.rsplit(sep, 1)[-1]
    return iri


def _resource_uri_from_ct(content_type, pk) -> str | None:
    """Canonical resource IRI from a (ContentType, pk) — mirrors resource_uri_for_instance
    without fetching the row (ContentTypes are cached)."""
    from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model
    from apps.graph.kg_engine.uris import resource_base

    if content_type is None or pk is None:
        return None
    model = content_type.model_class()
    if model is None:
        return None
    seg = registry_class_key_for_model(model) or model.__name__.lower()
    return f"{resource_base().rstrip('/')}/{str(seg).strip().lower()}/{pk}"


def _assertion_provenance_map() -> dict[tuple[str, str, str], dict]:
    """(subjectIRI, predicateLocal, objectIRI) → provenance, from accepted relationship.*
    assertions (the system of record). Lets every KG edge cite who/why/confidence/when."""
    from apps.cidoc_data.models import HeritageAssertion

    out: dict[tuple[str, str, str], dict] = {}
    qs = HeritageAssertion.objects.filter(
        asserted_property__startswith="relationship.",
        reconciliation_status="accepted",
    ).select_related("source")
    for a in qs.iterator():
        s = _resource_uri_from_ct(a.content_type, a.object_id)
        o = _resource_uri_from_ct(a.object_content_type, a.object_object_id)
        if not s or not o:
            continue
        pred = a.asserted_property[len("relationship.") :]
        out[(s, pred, o)] = {
            "source": (getattr(a.source, "title", None) if a.source_id else None)
            or (a.source_citation or None),
            "confidence": a.confidence or None,
            "confidenceScore": float(a.confidence_score)
            if a.confidence_score is not None
            else None,
            "assertedBy": a.attributed_to_agent or a.contributed_by or None,
            "temporalScope": a.temporal_scope_edtf or None,
            "assertedAt": a.created_at.isoformat() if a.created_at else None,
        }
    return out


# Statuses that mean "not yet reviewed/published"; excluded when scope=reviewed.
_UNPUBLISHED_STATUSES = {"pending_review", "draft", "rejected"}


def _unpublished_iris() -> set[str]:
    """Resource IRIs of CIDOC rows that are not yet reviewed (for scope=reviewed)."""
    from django.apps import apps as dj
    from apps.cidoc_data.models import MetaData
    from apps.cidoc_data.rdf_publish import resource_uri_for_instance

    out: set[str] = set()
    for model in dj.get_app_config("cidoc_data").get_models():
        if not issubclass(model, MetaData) or model is MetaData or model._meta.abstract:
            continue
        rows = model.objects.filter(status__in=_UNPUBLISHED_STATUSES).only("id")
        out.update(resource_uri_for_instance(o) for o in rows)
        blank = model.objects.filter(status__isnull=True).only("id")
        out.update(resource_uri_for_instance(o) for o in blank)
    return out


class KnowledgeGraphStatsView(APIView):
    """GET /cidoc/kg/stats/ — triple counts and store health."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        engine = get_kg_engine()
        stats = engine.stats()
        return Response(
            {
                "rdf_sync_enabled": engine.enabled(),
                "store_healthy": engine.store.health(),
                "total_triples": stats.total_triples,
                "public_graph_triples": stats.public_triples,
                "schema_graph_triples": stats.schema_triples,
                "source": stats.source,
                "type_histogram": engine.type_histogram(),
            }
        )


class KnowledgeGraphNeighborhoodView(APIView):
    """GET /cidoc/kg/neighborhood/?uri=<resource-iri> — inbound/outbound edges in public graph."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        uri = (request.query_params.get("uri") or "").strip()
        if not uri:
            return Response(
                {"error": "Missing query parameter `uri`."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = min(int(request.query_params.get("limit") or 50), 200)
        rows = get_kg_engine().neighborhood(uri, limit=limit)
        return Response({"uri": uri, "edges": rows, "count": len(rows)})


class KnowledgeGraphQueryView(APIView):
    """POST /cidoc/kg/query/ — read-only SPARQL SELECT (same guard as SparqlProxyView)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        sparql = (request.data.get("query") or request.data.get("sparql") or "").strip()
        if not sparql:
            return Response(
                {"error": "Missing `query` in JSON body."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not is_readonly_sparql_query(sparql):
            return Response(
                {"error": "Only read-only SPARQL is allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        rows = get_kg_engine().query(sparql)
        return Response({"results": rows, "count": len(rows)})


class KnowledgeGraphGraphView(APIView):
    """GET /cidoc/kg/graph/ — whole public-graph projection as render-ready JSON.

    Returns ontology-typed nodes (`rdf:type` IRIs) and the real edges between
    them, so the heritage museum can display the actual knowledge graph instead
    of a client-side heuristic reconstruction. The frontend maps each type IRI to
    a NodeType via the generated RDF_CLASS_URI_TO_NODE_TYPE table.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        node_limit = min(int(request.query_params.get("node_limit") or 600), 2000)
        edge_limit = min(int(request.query_params.get("edge_limit") or 3000), 10000)
        # scope=all (default, testing) shows every typed entity; scope=reviewed
        # drops pending/draft rows so a published build only exposes curated data.
        scope = (request.query_params.get("scope") or "all").strip().lower()
        excluded = _unpublished_iris() if scope == "reviewed" else set()
        projection = get_kg_engine().graph(node_limit=node_limit, edge_limit=edge_limit)

        # Aggregate node rows (one row per type/wkt combination) into one entry per IRI.
        nodes: dict[str, dict] = {}
        for row in projection["nodes"]:
            iri = row.get("s")
            if not iri or iri in excluded:
                continue
            node = nodes.setdefault(
                iri,
                {
                    "id": iri,
                    "types": [],
                    "label": None,
                    "comment": None,
                    "lat": None,
                    "long": None,
                },
            )
            type_iri = row.get("type")
            if type_iri and type_iri not in node["types"]:
                node["types"].append(type_iri)
            if not node["label"] and row.get("label"):
                node["label"] = row["label"]
            if not node["comment"] and row.get("comment"):
                node["comment"] = row["comment"]
            wkt = row.get("wkt")
            if wkt and node["lat"] is None:
                m = _POINT_RE.search(str(wkt))
                if m:
                    # WKT is POINT(longitude latitude).
                    node["long"], node["lat"] = m.group(1), m.group(2)

        # Fall back to the IRI local name when a resource carries no rdfs:label.
        for node in nodes.values():
            if not node["label"]:
                node["label"] = _local_name(node["id"])

        # Provenance per edge (source/confidence/asserter/temporal) from accepted
        # assertions — makes every relationship citable, a research-grade requirement.
        provenance = _assertion_provenance_map()

        node_ids = set(nodes)
        edges = []
        edges_with_prov = 0
        for row in projection["edges"]:
            s, p, o = row.get("s"), row.get("p"), row.get("o")
            if not (s and p and o) or s == o:
                continue
            if s not in node_ids or o not in node_ids:
                continue
            p_local = _local_name(p)
            prov = provenance.get((s, p_local, o))
            if prov:
                edges_with_prov += 1
            edges.append(
                {
                    "source": s,
                    "target": o,
                    "predicate": p,
                    "predicateLocal": p_local,
                    "predicateLabel": row.get("plabel") or p_local,
                    # null for FK-relation/structural edges (provenance = the entity's own record)
                    "provenance": prov,
                }
            )

        return Response(
            {
                "graph": GraphPartition.PUBLIC.uri(),
                "scope": scope,
                "nodes": list(nodes.values()),
                "edges": edges,
                "counts": {
                    "nodes": len(nodes),
                    "edges": len(edges),
                    "edgesWithProvenance": edges_with_prov,
                },
            }
        )
