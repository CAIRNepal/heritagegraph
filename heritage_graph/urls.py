from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from apps.health_check import (
    deployment_index,
    health_check,
    health_check_detailed,
    liveness_check,
    readiness_check,
)
from apps.heritage_data.auth_views import (
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
)
from apps.heritage_data.dev_auth import DevLoginView
from apps.heritage_data.views import CurrentUserView, LogoutView, RegisterView
from apps.graph.lod_views import LodResourceView, VoidDatasetView

urlpatterns = [
    # Root: deployment index (admin + docs links); must stay before prometheus '' include
    re_path(r"^$", deployment_index, name="deployment-index"),
    # Health check endpoints (used by Docker, Traefik, and monitoring)
    path("health/", health_check, name="health"),
    path("health/detailed/", health_check_detailed, name="health-detailed"),
    path("health/ready/", readiness_check, name="readiness"),
    path("health/live/", liveness_check, name="liveness"),
    # OpenAPI / Swagger / ReDoc — register before prometheus '' include; optional /docs slash
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    re_path(
        r"^docs/?$",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("", include("django_prometheus.urls")),
    # Admin
    path("admin/", admin.site.urls),
    # API Endpoints
    path(
        "data/", include("apps.heritage_data.urls")
    ),  # Heritage Data App
    path("data/", include("apps.document_processing.urls")),  # OCR / document processing
    path(
        "cidoc/", include("apps.cidoc_data.urls")
    ),  # Heritage Data App
    path("graph/", include("apps.graph.urls")),
    # Versioned API (recommended for new clients)
    path("api/v1/data/", include("apps.heritage_data.urls")),
    path("api/v1/data/", include("apps.document_processing.urls")),
    path("api/v1/cidoc/", include("apps.cidoc_data.urls")),
    path("api/v1/graph/", include("apps.graph.urls")),
    path("api/v1/assistant/", include("apps.assistant.urls")),

    # Authentication
    path("auth/", include("djoser.urls")),  # Djoser URLs
    path("auth/", include("djoser.urls.jwt")),  # Djoser JWT URLs
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    # JWT Token
    path(
        "api/token/",
        ThrottledTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/token/refresh/",
        ThrottledTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/dev/login/", DevLoginView.as_view(), name="dev_login"),
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/user/info", CurrentUserView.as_view(), name="current-user"),
    path("user/", include("apps.users.urls")),
    # Linked Open Data (Phase 1–2)
    path("lod/resource/<path:path>", LodResourceView.as_view(), name="lod-resource"),
    path("lod/dataset/", VoidDatasetView.as_view(), name="lod-dataset"),
    path("api/v1/lod/resource/<path:path>", LodResourceView.as_view()),
    path("api/v1/lod/dataset/", VoidDatasetView.as_view()),
]
