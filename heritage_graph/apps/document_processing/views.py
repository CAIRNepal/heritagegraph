# apps/document_processing/views.py
from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import UploadedDocument
from .permissions import CanRequeueOcrDocument, IsStaffOrDocumentOwner
from .serializers import (
    OcrDocumentStatusSerializer,
    OcrDocumentUploadSerializer,
    suggestions_for_document,
)
from .tasks import classify_and_route_document


class UploadedDocumentViewSet(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    OCR status + suggestions + staff retry + contributor upload.

    Router basename `ocr-document` => `/ocr-documents/...` under includes.
    """

    permission_classes = [permissions.IsAuthenticated, IsStaffOrDocumentOwner]
    serializer_class = OcrDocumentStatusSerializer
    http_method_names = ["get", "head", "options", "post"]
    lookup_field = "pk"

    def get_queryset(self):
        qs = UploadedDocument.objects.all().select_related(
            "submission",
            "cultural_entity",
            "media",
        )
        user = self.request.user
        if not user.is_authenticated:
            return UploadedDocument.objects.none()
        if user.is_staff:
            return qs
        return qs.filter(
            Q(submission__contributor=user) | Q(cultural_entity__contributor=user)
        )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="upload",
    )
    def upload(self, request):
        ser = OcrDocumentUploadSerializer(
            data=request.data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        media = ser.save()
        doc = get_object_or_404(UploadedDocument, media=media)
        return Response(
            {
                "media_id": media.id,
                "uploaded_document_id": str(doc.id),
                "status": doc.status,
            },
            status=201,
        )

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, pk=None):
        doc = self.get_object()
        ontology_class = (request.query_params.get("ontology_class") or "").strip() or None
        return Response(
            suggestions_for_document(document=doc, ontology_class_key=ontology_class)
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated, CanRequeueOcrDocument],
        url_path="retry",
    )
    def retry(self, request, pk=None):
        doc = self.get_object()
        doc.status = "pending"
        doc.save(update_fields=["status", "updated_at"])
        classify_and_route_document.delay(str(doc.id))
        doc.refresh_from_db()
        return Response(
            OcrDocumentStatusSerializer(doc, context={"request": request}).data,
            status=202,
        )
