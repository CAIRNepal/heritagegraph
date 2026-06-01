"""Knowledge graph HTTP API (SPARQL-backed)."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cidoc_data.rdf_signals import is_readonly_sparql_query
from apps.graph.kg_engine.engine import get_kg_engine


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
