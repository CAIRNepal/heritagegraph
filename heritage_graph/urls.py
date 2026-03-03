from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework import permissions
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.health_check import (
    health_check,
    health_check_detailed,
    liveness_check,
    readiness_check,
)
from apps.heritage_data.views import CurrentUserView, RegisterView

# DefaultRouter for API endpoints
router = DefaultRouter()


urlpatterns = [
    # Health check endpoints (used by Docker, Traefik, and monitoring)
    path("health/", health_check, name="health"),
    path("health/detailed/", health_check_detailed, name="health-detailed"),
    path("health/ready/", readiness_check, name="readiness"),
    path("health/live/", liveness_check, name="liveness"),
    # API Documentation
    path('', include('django_prometheus.urls')),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),  # OpenAPI schema
    path(
        "docs", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"
    ),  # Swagger UI
    path(
        "redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"
    ),  # ReDoc
    # Admin
    path("admin/", admin.site.urls),
    # API Endpoints
    path("", include(router.urls)),  # DefaultRouter URLs
    path(
        "data/", include("apps.heritage_data.urls")
    ),  # Heritage Data App
    path(
        "cidoc/", include("apps.cidoc_data.urls")
    ),  # Heritage Data App

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
]
