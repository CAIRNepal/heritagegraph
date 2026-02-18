# ================================================================
# Health Check Views
# ================================================================
# Provides health check endpoints for load balancers and monitoring

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.db import connection


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
    }

    # Determine overall status
    if not checks["database"]["healthy"]:
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
