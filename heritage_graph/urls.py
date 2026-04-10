from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path, re_path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.health_check import (
    deployment_index,
    health_check,
    health_check_detailed,
    liveness_check,
    readiness_check,
)
from apps.heritage_data.views import CurrentUserView, RegisterView

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
    path(
        "cidoc/", include("apps.cidoc_data.urls")
    ),  # Heritage Data App
    # Versioned API (recommended for new clients)
    path("api/v1/data/", include("apps.heritage_data.urls")),
    path("api/v1/cidoc/", include("apps.cidoc_data.urls")),

    # Authentication
    path("auth/", include("djoser.urls")),  # Djoser URLs
    path("auth/", include("djoser.urls.jwt")),  # Djoser JWT URLs
    path("auth/logout/", LogoutView.as_view(), name="logout"),  # Logout
    # JWT Token
    path(
        "api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"
    ),  # Obtain JWT Token
    path(
        "api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"
    ),  # Refresh JWT Token
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/user/info", CurrentUserView.as_view(), name="current-user"),
    path("user/", include("apps.users.urls")),
]
