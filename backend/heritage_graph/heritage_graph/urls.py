from django.contrib import admin
from django.urls import path, include
from django.contrib.auth.views import LogoutView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from heritage_data.views import RegisterView, CurrentUserView

# DefaultRouter for API endpoints
router = DefaultRouter()

# Define API Schema View
schema_view = get_schema_view(
    openapi.Info(
        title="My API Documentation",
        default_version="v1",  
        description="API documentation for the backend services",
        terms_of_service="https://www.example.com/terms/",
        contact=openapi.Contact(email="support@example.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # API Documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),  # OpenAPI schema
    path('', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),  # Swagger UI
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),  # ReDoc
    path("openapi.json", schema_view.without_ui(cache_timeout=0), name="schema-json"),  

    # Admin
    path('admin/', admin.site.urls),

    # API Endpoints
    path('', include(router.urls)),  # DefaultRouter URLs
    path('data/', include('heritage_data.urls')),  # Heritage Data App

    # Authentication
    path("auth/", include("djoser.urls")),  # Djoser URLs
    path("auth/", include("djoser.urls.jwt")),  # Djoser JWT URLs
    path("auth/logout/", LogoutView.as_view(), name='logout'),  # Logout

    # JWT Token
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),  # Obtain JWT Token
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),  # Refresh JWT Token
    path('api/register/', RegisterView.as_view(), name='register'),
     path('api/user/info', CurrentUserView.as_view(), name='current-user'),
]