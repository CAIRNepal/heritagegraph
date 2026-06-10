# apps/document_processing/views.py
from __future__ import annotations

import json
import mimetypes
import os
import time
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db.models import Prefetch, Q
from django.http import FileResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import ChunkedMediaUpload, DocumentPage, TabularImportJob, UploadedDocument
from .permissions import (
    CanRequeueOcrDocument,
    IsContributorOrStaffObject,
    IsStaffOrDocumentOwner,
)
from .serializers import (
    ChunkedUploadInitSerializer,
    ChunkedUploadSerializer,
    IngestionReviewStatePatchSerializer,
    OcrDocumentStatusSerializer,
    OcrDocumentUploadSerializer,
    TabularImportCreateSerializer,
    TabularImportJobPatchSerializer,
    TabularImportJobSerializer,
    _merge_upload_provenance,
    build_review_payload,
    save_standalone_ingestion_media,
    suggestions_for_document,
)
from .services.ingestion_compile import (
    build_ingestion_compile_preview,
    tabular_compile_preview,
)
from .services.review_state import merge_ingestion_review_state as merge_review_fn
from .services.tabular_parse import parse_tabular_file
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
                Q(submission__contributor=user)
                | Q(cultural_entity__contributor=user)
                | Q(media__ingestion_contributor=user)
            )
        status = self.request.query_params.get("status", "").strip()
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=True, methods=["get"], url_path="review")
    def review(self, request, pk=None):
        doc = UploadedDocument.objects.prefetch_related(
            Prefetch(
                "pages",
                queryset=DocumentPage.objects.order_by("page_number").prefetch_related(
                    "ocr_results",
                ),
            ),
            "extracted_fields",
        ).get(pk=self.get_object().pk)
        return Response(build_review_payload(document=doc))

    @action(detail=True, methods=["get", "patch"], url_path="review-state")
    def review_state(self, request, pk=None):
        doc = self.get_object()
        if request.method == "GET":
            return Response(doc.ingestion_review_state or {})
        ser = IngestionReviewStatePatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        merged = merge_review_fn(doc.ingestion_review_state or {}, dict(ser.validated_data))
        doc.ingestion_review_state = merged
        doc.save(update_fields=["ingestion_review_state", "updated_at"])
        return Response(merged)

    @action(detail=True, methods=["post"], url_path="finalize-review")
    def finalize_review(self, request, pk=None):
        doc = self.get_object()
        merged = merge_review_fn(
            doc.ingestion_review_state or {},
            {"finalized_at": timezone.now().isoformat()},
        )
        doc.ingestion_review_state = merged
        doc.save(update_fields=["ingestion_review_state", "updated_at"])
        return Response(
            {"detail": "Review marked complete.", "ingestion_review_state": merged},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="compile-preview")
    def compile_preview(self, request, pk=None):
        doc = UploadedDocument.objects.prefetch_related("extracted_fields").get(pk=self.get_object().pk)
        return Response(build_ingestion_compile_preview(document=doc))

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        doc = self.get_object()

        def gen():
            last_sent = None
            while True:
                doc.refresh_from_db(
                    fields=["status", "processing_progress", "user_safe_error", "updated_at"],
                )
                payload = {
                    "status": doc.status,
                    "processing_progress": doc.processing_progress or {},
                    "user_safe_error": doc.user_safe_error or "",
                }
                dumped = json.dumps(payload)
                if dumped != last_sent:
                    last_sent = dumped
                    yield f"data: {dumped}\n\n"
                if doc.status in ("completed", "failed"):
                    yield "event: end\ndata: {}\n\n"
                    break
                time.sleep(0.45)

        resp = StreamingHttpResponse(gen(), content_type="text/event-stream")
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"
        return resp

    @action(detail=True, methods=["get"], url_path="asset")
    def asset(self, request, pk=None):
        doc = self.get_object()
        media_file = doc.media.file
        name = (media_file.name or "document").rsplit("/", 1)[-1]
        content_type, _ = mimetypes.guess_type(name)
        if not content_type:
            content_type = "application/octet-stream"
        media_file.open("rb")
        resp = FileResponse(media_file, content_type=content_type)
        resp["Content-Disposition"] = f'inline; filename="{name}"'
        return resp

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
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


class ChunkedUploadViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [permissions.IsAuthenticated, IsContributorOrStaffObject]
    serializer_class = ChunkedUploadSerializer

    def get_queryset(self):
        qs = ChunkedMediaUpload.objects.all()
        if self.request.user.is_staff:
            return qs
        return qs.filter(contributor=self.request.user)

    def create(self, request, *args, **kwargs):
        ser = ChunkedUploadInitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        uid = uuid.uuid4()
        safe_name = os.path.basename(ser.validated_data["filename"])
        rel = os.path.join("chunk_uploads", str(uid), safe_name)
        root = Path(settings.MEDIA_ROOT)
        abs_path = root / rel
        try:
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            abs_path.write_bytes(b"")
        except OSError:
            return Response(
                {
                    "detail": (
                        "Could not allocate temporary upload storage on the server "
                        "(check MEDIA_ROOT permissions or disk space)."
                    ),
                    "code": "chunk_upload_storage_error",
                },
                status=status.HTTP_507_INSUFFICIENT_STORAGE,
            )

        prov_payload = _merge_upload_provenance(
            {
                "provenance": ser.validated_data.get("provenance"),
                "source_institution": ser.validated_data.get("source_institution"),
                "collection_name": ser.validated_data.get("collection_name"),
                "language": ser.validated_data.get("language"),
                "ocr_language": ser.validated_data.get("ocr_language"),
                "copyright_note": ser.validated_data.get("copyright_note"),
            },
        )

        session = ChunkedMediaUpload.objects.create(
            contributor=request.user,
            original_filename=safe_name,
            expected_bytes=int(ser.validated_data["byte_size"]),
            relative_temp_path=rel.replace("\\", "/"),
            provenance=prov_payload,
            media_type=ser.validated_data.get("media_type") or "image",
            description=ser.validated_data.get("description") or "",
            standalone_ingestion=True,
        )
        out = ChunkedUploadSerializer(session, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        url_path="append",
        parser_classes=[MultiPartParser, FormParser],
    )
    def append_chunk(self, request, pk=None):
        session = self.get_object()
        chunk = request.FILES.get("chunk") or request.FILES.get("file")
        if not chunk:
            return Response({"detail": "Missing chunk file."}, status=status.HTTP_400_BAD_REQUEST)
        root = Path(settings.MEDIA_ROOT)
        abs_path = root / session.relative_temp_path
        data = chunk.read()
        with abs_path.open("ab") as fh:
            fh.write(data)
        session.bytes_written = int(session.bytes_written) + len(data)
        session.save(update_fields=["bytes_written"])
        return Response(
            ChunkedUploadSerializer(session, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.bytes_written != session.expected_bytes:
            return Response(
                {
                    "detail": "Incomplete upload.",
                    "bytes_written": session.bytes_written,
                    "expected_bytes": session.expected_bytes,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        root = Path(settings.MEDIA_ROOT)
        abs_path = root / session.relative_temp_path
        max_bytes = int(getattr(settings, "OCR_MAX_FILE_BYTES", 25 * 1024 * 1024))
        if abs_path.stat().st_size > max_bytes:
            abs_path.unlink(missing_ok=True)
            session.delete()
            return Response(
                {"detail": "Assembled file exceeds server OCR limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with abs_path.open("rb") as fh:
            django_file = File(fh, name=session.original_filename)
            media = save_standalone_ingestion_media(
                user=session.contributor,
                django_file=django_file,
                provenance=session.provenance,
                media_type=session.media_type,
                description=session.description,
            )

        doc = get_object_or_404(UploadedDocument, media=media)
        abs_path.unlink(missing_ok=True)
        session.delete()

        return Response(
            {
                "media_id": media.id,
                "uploaded_document_id": str(doc.id),
                "status": doc.status,
            },
            status=status.HTTP_201_CREATED,
        )


class TabularImportJobViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [permissions.IsAuthenticated, IsContributorOrStaffObject]
    serializer_class = TabularImportJobSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = TabularImportJob.objects.all()
        if self.request.user.is_staff:
            return qs
        return qs.filter(contributor=self.request.user)

    def get_serializer_class(self):
        if self.action == "partial_update":
            return TabularImportJobPatchSerializer
        return TabularImportJobSerializer

    def create(self, request, *args, **kwargs):
        ser = TabularImportCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        uploaded = ser.validated_data["file"]
        content = uploaded.read()
        rows, parse_msgs = parse_tabular_file(
            content=content,
            filename=getattr(uploaded, "name", "") or "upload.csv",
        )
        prov = _merge_upload_provenance(
            {
                "provenance": ser.validated_data.get("provenance"),
                "source_institution": ser.validated_data.get("source_institution"),
                "collection_name": ser.validated_data.get("collection_name"),
                "language": ser.validated_data.get("language"),
                "ocr_language": "",
                "copyright_note": "",
            },
        )

        job = TabularImportJob.objects.create(
            contributor=request.user,
            status=TabularImportJob.STATUS_READY if rows else TabularImportJob.STATUS_FAILED,
            source_filename=getattr(uploaded, "name", "") or "",
            provenance=prov,
            staged_rows=rows,
            validation_errors=parse_msgs,
            user_safe_error="" if rows else "Could not parse tabular file.",
        )

        return Response(
            TabularImportJobSerializer(job, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        job = self.get_object()
        ser = TabularImportJobPatchSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        patch = ser.validated_data
        if "column_mapping" in patch:
            cur = dict(job.column_mapping or {})
            cur.update(patch["column_mapping"] or {})
            job.column_mapping = cur
        if "row_review_state" in patch:
            cur_rs = dict(job.row_review_state or {})
            for rk, rv in (patch["row_review_state"] or {}).items():
                if rv is None:
                    cur_rs.pop(str(rk), None)
                elif isinstance(rv, dict):
                    prev = dict(cur_rs.get(str(rk)) or {})
                    prev.update(rv)
                    cur_rs[str(rk)] = prev
            job.row_review_state = cur_rs
        if "provenance" in patch and isinstance(patch["provenance"], dict):
            curp = dict(job.provenance or {})
            curp.update(patch["provenance"])
            job.provenance = curp
        job.save()
        return Response(TabularImportJobSerializer(job, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="compile-preview")
    def compile_preview(self, request, pk=None):
        job = self.get_object()
        return Response(tabular_compile_preview(job=job))
