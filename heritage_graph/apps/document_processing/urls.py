# apps/document_processing/urls.py
from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(
    r"ocr-documents",
    views.UploadedDocumentViewSet,
    basename="ocr-document",
)

urlpatterns = [path("", include(router.urls))]
