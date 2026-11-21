# ================================================================
# Health Check Views
# ================================================================
# Provides health check endpoints for load balancers and monitoring

from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods


def _api_base_url(request) -> str:
    return request.build_absolute_uri("/").rstrip("/")


@require_http_methods(["GET", "HEAD"])
def deployment_index(request):
    """
    Human-friendly entry point at GET / for deployed API hosts.

    Lists Django admin, OpenAPI docs, and health checks so operators see
    them without hunting URL paths. Use ?format=json for machine-readable links.
    """
    base = _api_base_url(request)
    links = {
        "service": "HeritageGraph Django API",
        "admin": f"{base}/admin/",
        "api_docs_swagger": f"{base}/docs",
        "api_docs_redoc": f"{base}/redoc/",
        "openapi_schema": f"{base}/schema/",
        "health": f"{base}/health/",
        "health_detailed": f"{base}/health/detailed/",
        "api_data_prefix": f"{base}/data/",
        "api_cidoc_prefix": f"{base}/cidoc/",
    }
    if request.GET.get("format") == "json":
        return JsonResponse(links)

    if request.method == "HEAD":
        return HttpResponse(status=200, headers={"Content-Type": "text/html; charset=utf-8"})

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>HeritageGraph API</title>
  <style>
    body {{ font-family: system-ui, sans-serif; line-height: 1.5; max-width: 40rem;
      margin: 2rem auto; padding: 0 1rem; color: #0f172a; }}
    h1 {{ font-size: 1.35rem; margin-bottom: 0.25rem; }}
    p.muted {{ color: #64748b; font-size: 0.9rem; margin-top: 0; }}
    ul {{ list-style: none; padding: 0; margin: 1.25rem 0; }}
    li {{ margin: 0.5rem 0; }}
    a {{ color: #1d4ed8; font-weight: 500; }}
    a:hover {{ text-decoration: underline; }}
    code {{ font-size: 0.85em; background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>HeritageGraph API</h1>
  <p class="muted">Backend is running. Open the admin or API documentation below.</p>
  <ul>
    <li><a href="{links["admin"]}">Django admin</a> <code>/admin/</code></li>
    <li><a href="{links["api_docs_swagger"]}">API docs (Swagger UI)</a> <code>/docs</code></li>
    <li><a href="{links["api_docs_redoc"]}">API reference (ReDoc)</a> <code>/redoc/</code></li>
    <li><a href="{links["openapi_schema"]}">OpenAPI schema (JSON)</a> <code>/schema/</code></li>
    <li><a href="{links["health"]}">Health check</a> <code>/health/</code></li>
  </ul>
  <p class="muted">JSON index: <a href="?format=json"><code>?format=json</code></a></p>
</body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8")


@require_http_methods(["GET", "HEAD"])
def health_check(request):
    """
    Basic health check endpoint.
    Returns 200 if service is running.
    """
    return JsonResponse(
        {
            "status": "healthy",
            "service": "heritage-backend",
            "version": "1.0.0",
        },
        status=200,
    )


@require_http_methods(["GET"])
def health_check_detailed(request):
    """
    Detailed health check including database connectivity.
    Used by orchestrators and monitoring systems.
    """
    checks = {
        "status": "healthy",
        "service": "heritage-backend",
        "version": "1.0.0",
        "database": check_database(),
        "oxigraph": check_oxigraph(),
    }

    # Determine overall status
    if not checks["database"]["healthy"] or not checks["oxigraph"]["healthy"]:
        checks["status"] = "degraded"

    status_code = 200 if checks["status"] == "healthy" else 503

    return JsonResponse(checks, status=status_code)


def check_database():
    """
    Check database connectivity.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return {"healthy": True, "message": "Database connected"}
    except Exception as e:
        return {
            "healthy": False,
            "message": f"Database connection failed: {str(e)}",
        }


def check_oxigraph():
    try:
        from apps.graph.client import graph_client

        ok = graph_client.health()
        return {"healthy": ok, "message": "Oxigraph reachable" if ok else "Oxigraph unreachable"}
    except Exception as e:
        return {"healthy": False, "message": f"Oxigraph health check failed: {str(e)}"}


@require_http_methods(["GET"])
def readiness_check(request):
    """
    Readiness check endpoint.
    Returns 200 only when service is ready to accept traffic.
    """
    checks = {
        "database": check_database(),
    }

    ready = all(check["healthy"] for check in checks.values())

    return JsonResponse(
        {
            "ready": ready,
            "checks": checks,
        },
        status=200 if ready else 503,
    )


@require_http_methods(["GET"])
def liveness_check(request):
    """
    Liveness check endpoint.
    Returns 200 if service is alive (not stuck/hanging).
    """
    return JsonResponse(
        {
            "alive": True,
            "service": "heritage-backend",
        },
        status=200,
    )
