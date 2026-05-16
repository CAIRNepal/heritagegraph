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
from .tasks import classify_and_route_document, run_kg_pipeline


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
        if not user.is_staff:
            qs = qs.filter(
                Q(submission__contributor=user) | Q(cultural_entity__contributor=user)
            )
        status = self.request.query_params.get("status", "").strip()
        if status:
            qs = qs.filter(status=status)
        return qs

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

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated, IsStaffOrDocumentOwner],
        url_path="run-pipeline",
    )
    def run_pipeline(self, request, pk=None):
        doc = self.get_object()
        if doc.status != "completed":
            return Response(
                {"detail": "OCR must complete before running the KG pipeline."},
                status=400,
            )
        pipeline_status = (doc.metadata or {}).get("pipeline_status")
        if pipeline_status == "running":
            return Response({"detail": "Pipeline is already running."}, status=409)
        run_kg_pipeline.delay(str(doc.id))
        return Response({"status": "queued"}, status=202)

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, pk=None):
        doc = self.get_object()
        ontology_class = (request.query_params.get("ontology_class") or "").strip() or None
        return Response(
            suggestions_for_document(document=doc, ontology_class_key=ontology_class)
        )

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated, IsStaffOrDocumentOwner],
        url_path="graph-export",
    )
    def graph_export(self, request, pk=None):
        """
        Return pipeline assertions as Cytoscape-compatible {nodes, edges}.

        Only assertions with route in the requested set are included.
        Defaults to all non-rejected routes; pass ?routes=auto_accept to restrict.
        """
        doc = self.get_object()
        meta = doc.metadata or {}
        assertions = meta.get("assertions", [])

        requested_routes = set(
            r.strip()
            for r in (request.query_params.get("routes") or "").split(",")
            if r.strip()
        )
        REJECTED = {"reject"}
        if not requested_routes:
            requested_routes = {
                "auto_accept", "community_review", "expert_review",
                "expert_curator", "conflict",
            }

        nodes: dict[str, dict] = {}
        edges: list[dict] = []
        edge_id = 0

        for a in assertions:
            if a.get("route") in REJECTED:
                continue
            if a.get("route") not in requested_routes:
                continue

            sub_uri = a.get("subject_uri") or a.get("subject", "")
            obj_uri = a.get("object_uri") or a.get("object", "")
            sub_label = a.get("subject", sub_uri)
            obj_label = a.get("object", obj_uri)

            if sub_uri and sub_uri not in nodes:
                nodes[sub_uri] = {
                    "data": {
                        "id": sub_uri,
                        "label": sub_label,
                        "cidoc_type": a.get("subject_type", ""),
                        "nodeType": "subject",
                    }
                }
            if obj_uri and obj_uri not in nodes:
                nodes[obj_uri] = {
                    "data": {
                        "id": obj_uri,
                        "label": obj_label,
                        "cidoc_type": a.get("object_type", ""),
                        "nodeType": "object",
                    }
                }
            if sub_uri and obj_uri:
                edges.append({
                    "data": {
                        "id": f"e_{edge_id}",
                        "source": sub_uri,
                        "target": obj_uri,
                        "label": a.get("predicate", ""),
                        "confidence_score": a.get("confidence_score", 0),
                        "route": a.get("route", ""),
                        "kumari_flagged": a.get("kumari_flagged", False),
                    }
                })
                edge_id += 1

        return Response({
            "document_id": str(doc.id),
            "pipeline_status": meta.get("pipeline_status"),
            "elements": list(nodes.values()) + edges,
            "node_count": len(nodes),
            "edge_count": len(edges),
        })

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
