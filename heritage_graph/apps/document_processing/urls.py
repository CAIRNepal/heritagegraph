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
router.register(
    r"ocr-chunk-uploads",
    views.ChunkedUploadViewSet,
    basename="ocr-chunk-upload",
)
router.register(
    r"tabular-import-jobs",
    views.TabularImportJobViewSet,
    basename="tabular-import-job",
)

urlpatterns = [path("", include(router.urls))]
