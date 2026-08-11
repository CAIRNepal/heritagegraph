"""
CARE-aware SPARQL proxy.

Injects FILTER NOT EXISTS clauses for sensitive access tiers before forwarding
queries to the Oxigraph backend.  The CARE/TK access model:

  anonymous / public_user   → hide sensitive_indigenous + community_only
  community_member          → hide sensitive_indigenous only
  curator / staff           → no filter (full access)

The response carries an X-CARE-Filtered header with the number of hidden tier
filter clauses injected (useful for UI: "N triples hidden").
"""

from __future__ import annotations

import logging
import re

import requests
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views import View

logger = logging.getLogger(__name__)

HG = "https://w3id.org/heritagegraph/"

# Ordered from most to least restrictive
_TIER_FILTERS: dict[str, tuple[str, ...]] = {
    "anonymous": ("sensitive_indigenous", "community_only"),
    "public_user": ("sensitive_indigenous", "community_only"),
    "community_member": ("sensitive_indigenous",),
    "curator": (),
}

_FILTER_LINE = '\n  FILTER NOT EXISTS {{ ?s <{hg}access_tier> "{tier}"^^<http://www.w3.org/2001/XMLSchema#string> }}'

# Match the first WHERE { of a SELECT/CONSTRUCT/DESCRIBE/ASK query
_WHERE_RE = re.compile(r"\bWHERE\s*\{", re.IGNORECASE)


def _inject_care_filters(query: str, hidden_tiers: tuple[str, ...]) -> str:
    if not hidden_tiers:
        return query
    filters = "".join(_FILTER_LINE.format(hg=HG, tier=tier) for tier in hidden_tiers)

    def _inject(m: re.Match) -> str:
        return m.group(0) + filters

    injected, n = _WHERE_RE.subn(_inject, query, count=1)
    if n == 0:
        logger.debug("CARE proxy: WHERE clause not found — filters not injected")
    return injected


def _resolve_user_tier(request) -> str:
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return "anonymous"
    if user.is_staff or user.groups.filter(name__in=["Curators", "Reviewers"]).exists():
        return "curator"
    if user.groups.filter(name="Community").exists():
        return "community_member"
    return "public_user"


def _oxigraph_query_endpoint() -> str:
    raw = (
        str(getattr(settings, "RDF_QUERY_URL", "") or "").strip()
        or str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    )
    if not raw:
        return ""
    base = raw.replace("/update", "").replace("/sparql", "").rstrip("/")
    return f"{base}/query"


# ── Rate limiting ─────────────────────────────────────────────────────────────
# This is a plain Django View, so DRF's DEFAULT_THROTTLE_CLASSES do not apply to
# it. SPARQL is the most expensive public surface -- every request can scan the
# store -- and it is AllowAny, so it needs its own limiter.


def _client_ip(request) -> str:
    """Caller IP, honouring the proxy header Traefik sets."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def _sparql_rate_limited(request) -> bool:
    """Fixed-window counter per IP. True when the caller is over the limit.

    Fails open: if the cache backend is unavailable the endpoint keeps serving
    rather than locking every reader out of a public research resource.
    """
    from django.core.cache import cache

    rate = str(getattr(settings, "SPARQL_THROTTLE_RATE", "20/min"))
    try:
        count, _, period = rate.partition("/")
        limit = int(count)
    except (TypeError, ValueError):
        return False
    window = {"sec": 1, "min": 60, "hour": 3600, "day": 86400}.get(period, 60)

    key = f"sparql-throttle:{window}:{_client_ip(request)}"
    try:
        current = cache.get_or_set(key, 0, window)
        current = cache.incr(key)
    except Exception:
        return False
    return current > limit


class CARESparqlProxyView(View):
    """
    Proxy at /sparql (and /api/v1/sparql) that filters CARE-sensitive triples
    before forwarding to Oxigraph :7878/query.

    GET  /sparql?query=SELECT+...
    POST /sparql  (body: query=SELECT+...)
    """

    def get(self, request, *args, **kwargs):
        return self._handle(request)

    def post(self, request, *args, **kwargs):
        return self._handle(request)

    def _handle(self, request):
        if _sparql_rate_limited(request):
            return JsonResponse(
                {"error": "Rate limit exceeded for the public SPARQL endpoint."},
                status=429,
            )

        accept = request.META.get("HTTP_ACCEPT") or "application/sparql-results+json"

        if request.method == "POST":
            query = request.POST.get("query") or request.body.decode(
                "utf-8", errors="replace"
            )
        else:
            query = request.GET.get("query", "")

        if not query or not query.strip():
            return JsonResponse({"error": "query parameter is required"}, status=400)

        tier = _resolve_user_tier(request)
        hidden_tiers = _TIER_FILTERS.get(
            tier, ("sensitive_indigenous", "community_only")
        )
        filtered_query = _inject_care_filters(query, hidden_tiers)

        endpoint = _oxigraph_query_endpoint()
        if not endpoint:
            return JsonResponse(
                {
                    "error": "SPARQL endpoint not configured (RDF_QUERY_URL / RDF_ENDPOINT_URL)"
                },
                status=503,
            )

        try:
            resp = requests.get(
                endpoint,
                params={"query": filtered_query},
                headers={"Accept": accept},
                timeout=30,
            )
            response = HttpResponse(
                resp.content,
                status=resp.status_code,
                content_type=resp.headers.get(
                    "Content-Type", "application/sparql-results+json"
                ),
            )
            response["X-CARE-Filtered"] = str(len(hidden_tiers))
            if hidden_tiers:
                response["X-CARE-Tiers-Hidden"] = ",".join(hidden_tiers)
            return response
        except requests.Timeout:
            return JsonResponse({"error": "SPARQL endpoint timeout"}, status=504)
        except Exception as exc:
            logger.exception("CARESparqlProxyView error: %s", exc)
            return JsonResponse(
                {"error": "Proxy error contacting SPARQL endpoint"}, status=502
            )
