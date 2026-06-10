# apps/document_processing/serializers.py
from __future__ import annotations

import copy
from typing import Any

from apps.heritage_data.models import CulturalEntity, Media, Submission
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import ChunkedMediaUpload, DocumentPage, TabularImportJob, UploadedDocument
from .services.review_state import (
    pages_with_block_corrections,
)

ENGINE_BLOCK_PRIORITY = (
    "tesseract",
    "pdfplumber",
    "claude_vision",
    "easyocr",
    "trocr",
)


class OcrDocumentStatusSerializer(serializers.ModelSerializer):
    """Response shape is OpenAPI-friendly; `raw_text` is optional for clients."""

    class Meta:
        model = UploadedDocument
        fields = [
            "id",
            "status",
            "document_type",
            "classification_confidence",
            "processing_started",
            "processing_finished",
            "user_safe_error",
            "raw_text",
            "metadata",
            "provenance",
            "processing_progress",
        ]
        read_only_fields = fields


def suggestions_for_document(
    *, document: UploadedDocument, ontology_class_key: str | None = None
) -> dict[str, dict]:
    """
    Map field key -> { value, confidence, entityType, fieldName, source }.

    When ``ontology_class_key`` is set, only keys present on that registry class are returned.
    """
    out: dict[str, dict] = {}
    for row in document.extracted_fields.all().only(
        "field_name",
        "field_value",
        "confidence",
        "source_entity_type",
    ):
        out[row.field_name] = {
            "value": row.field_value,
            "confidence": float(row.confidence),
            "entityType": row.source_entity_type,
            "fieldName": row.field_name,
            "source": "ner_v1",
        }
    if ontology_class_key:
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        registry = get_effective_registry_payload()
        cls = (registry.get("classes") or {}).get(ontology_class_key) or {}
        allowed = {f.get("key") for f in (cls.get("fields") or []) if f.get("key")}
        if allowed:
            out = {k: v for k, v in out.items() if k in allowed}
    return out


def _raise_validation_from_model(exc: DjangoValidationError) -> None:
    """Convert Django model ValidationError into DRF-friendly errors (avoid opaque 500s)."""
    if hasattr(exc, "error_dict"):
        out: dict[str, list[str]] = {}
        for field, errs in exc.error_dict.items():
            messages: list[str] = []
            for item in errs:
                if isinstance(item, DjangoValidationError):
                    msg = item.message
                    if item.params:
                        msg %= item.params
                    messages.append(str(msg))
                else:
                    messages.append(str(item))
            out[field] = messages
        raise serializers.ValidationError(out)
    msgs = list(exc.messages)
    raise serializers.ValidationError({"detail": msgs})


def _merge_upload_provenance(validated_data: dict) -> dict[str, Any]:
    base = dict(validated_data.get("provenance") or {})
    pairs = [
        ("source_institution", validated_data.get("source_institution")),
        ("collection_name", validated_data.get("collection_name")),
        ("language", validated_data.get("language")),
        ("ocr_language", validated_data.get("ocr_language")),
        ("copyright_note", validated_data.get("copyright_note")),
    ]
    for key, val in pairs:
        if val is None:
            continue
        s = str(val).strip()
        if s:
            base[key] = s
    return base


def ocr_blocks_for_page(page: DocumentPage) -> tuple[list[dict], float | None, float | None]:
    """Pick best OCR result that carries geometry blocks (engine-agnostic)."""
    results = list(page.ocr_results.all())
    results.sort(
        key=lambda r: ENGINE_BLOCK_PRIORITY.index(r.engine)
        if r.engine in ENGINE_BLOCK_PRIORITY
        else 99
    )
    for r in results:
        meta = r.metadata or {}
        blocks = meta.get("blocks")
        if isinstance(blocks, list) and len(blocks) > 0:
            return blocks, meta.get("image_width"), meta.get("image_height")
    return [], None, None


def build_review_payload(*, document: UploadedDocument) -> dict[str, Any]:
    pages_raw: list[dict[str, Any]] = []
    for page in document.pages.all().order_by("page_number"):
        blocks, img_w, img_h = ocr_blocks_for_page(page)
        pages_raw.append(
            {
                "page_number": page.page_number,
                "raw_text": page.raw_text,
                "confidence": float(page.confidence),
                "blocks": blocks,
                "image_width": float(img_w) if img_w is not None else None,
                "image_height": float(img_h) if img_h is not None else None,
            }
        )

    review_state = document.ingestion_review_state or {}
    pages_out = pages_with_block_corrections(pages_raw, review_state)

    extracted: list[dict[str, Any]] = []
    for row in document.extracted_fields.all().order_by("-confidence"):
        extracted.append(
            {
                "id": str(row.id),
                "field_name": row.field_name,
                "field_value": row.field_value,
                "confidence": float(row.confidence),
                "entity_type": row.source_entity_type,
                "vocabulary_match_score": float(row.vocabulary_match_score)
                if row.vocabulary_match_score is not None
                else None,
            }
        )

    media = document.media
    file_name = ""
    try:
        file_name = media.file.name.rsplit("/", 1)[-1] if media.file else ""
    except Exception:
        file_name = ""

    return {
        "document_id": str(document.id),
        "status": document.status,
        "document_type": document.document_type,
        "classification_confidence": float(document.classification_confidence),
        "processing_started": document.processing_started,
        "processing_finished": document.processing_finished,
        "user_safe_error": document.user_safe_error or None,
        "raw_text": document.raw_text or "",
        "provenance": document.provenance or {},
        "file_name": file_name,
        "pages": pages_out,
        "extracted_fields": extracted,
        "saved_review_state": copy.deepcopy(review_state),
    }


class OcrDocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    media_type = serializers.ChoiceField(
        choices=Media.MEDIA_TYPE_CHOICES,
        default="image",
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")

    cultural_entity_id = serializers.UUIDField(required=False, allow_null=True)
    submission_id = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
    )
    standalone_ingestion = serializers.BooleanField(required=False, default=False)

    provenance = serializers.JSONField(required=False, default=dict)
    source_institution = serializers.CharField(required=False, allow_blank=True, default="")
    collection_name = serializers.CharField(required=False, allow_blank=True, default="")
    language = serializers.CharField(required=False, allow_blank=True, default="")
    ocr_language = serializers.CharField(required=False, allow_blank=True, default="")
    copyright_note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_file(self, value):
        max_bytes = int(getattr(settings, "OCR_MAX_FILE_BYTES", 25 * 1024 * 1024))
        if hasattr(value, "size") and value.size and value.size > max_bytes:
            raise serializers.ValidationError(
                "File is too large to process (server limit).",
            )
        return value

    def validate(self, attrs):
        ce = attrs.get("cultural_entity_id")
        sid = (attrs.get("submission_id") or "").strip() or None
        standalone = bool(attrs.get("standalone_ingestion"))

        if standalone and (ce or sid):
            raise serializers.ValidationError(
                {
                    "standalone_ingestion": (
                        "Cannot combine standalone_ingestion with cultural_entity_id or submission_id."
                    )
                }
            )
        if standalone:
            return attrs
        if ce and sid:
            raise serializers.ValidationError(
                "Provide only one of cultural_entity_id or submission_id.",
            )
        if not ce and not sid:
            raise serializers.ValidationError(
                "Provide cultural_entity_id, submission_id, or standalone_ingestion=true.",
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        description = validated_data.get("description") or ""
        media_type = validated_data.get("media_type") or "image"
        f = validated_data["file"]
        standalone = bool(validated_data.get("standalone_ingestion"))

        ce_id = validated_data.get("cultural_entity_id")
        sid = (validated_data.get("submission_id") or "").strip() or None

        if standalone:
            media = Media(
                ingestion_contributor=user,
                media_type=media_type,
                file=f,
                description=description,
            )
        elif ce_id:
            entity = CulturalEntity.objects.get(entity_id=ce_id)
            if not user.is_staff and entity.contributor_id != user.id:
                raise serializers.ValidationError(
                    {"cultural_entity_id": "You do not have access to this entity."}
                )
            media = Media(
                cultural_entity=entity,
                media_type=media_type,
                file=f,
                description=description,
            )
        else:
            submission = Submission.objects.get(submission_id=sid)
            if not user.is_staff and submission.contributor_id != user.id:
                raise serializers.ValidationError(
                    {"submission_id": "You do not have access to this submission."}
                )
            media = Media(
                submission=submission,
                media_type=media_type,
                file=f,
                description=description,
            )

        try:
            media.full_clean()
        except DjangoValidationError as exc:
            _raise_validation_from_model(exc)
        media.save()

        prov = _merge_upload_provenance(validated_data)
        doc = UploadedDocument.objects.filter(media=media).first()
        if doc:
            doc.provenance = prov
            doc.save(update_fields=["provenance", "updated_at"])

        return media


def save_standalone_ingestion_media(
    *,
    user,
    django_file,
    provenance: dict[str, Any] | None,
    media_type: str,
    description: str,
) -> Media:
    """Standalone ingestion helper shared by multipart upload and chunked completion."""
    media = Media(
        ingestion_contributor=user,
        media_type=media_type or "image",
        file=django_file,
        description=description or "",
    )
    try:
        media.full_clean()
    except DjangoValidationError as exc:
        _raise_validation_from_model(exc)
    media.save()
    doc = UploadedDocument.objects.filter(media=media).first()
    if doc:
        doc.provenance = provenance or {}
        doc.save(update_fields=["provenance", "updated_at"])
    return media


class IngestionReviewStatePatchSerializer(serializers.Serializer):
    field_decisions = serializers.DictField(required=False)
    block_corrections = serializers.DictField(required=False)
    ontology_handoff_key = serializers.CharField(required=False, allow_blank=True)
    finalized_at = serializers.CharField(required=False, allow_blank=True)

    def validate_field_decisions(self, val):
        if not val:
            return {}
        for _fid, decision in val.items():
            if not isinstance(decision, dict):
                raise serializers.ValidationError("Each field_decisions entry must be an object.")
            lk = decision.get("linked")
            if lk in (False, True):
                raise serializers.ValidationError("linked cannot be boolean.")
            if lk not in (None, {}) and isinstance(lk, dict):
                if not str(lk.get("resource_key") or "").strip():
                    raise serializers.ValidationError("linked.resource_key is required.")
                try:
                    int(lk.get("id"))
                except (TypeError, ValueError) as exc:
                    raise serializers.ValidationError(
                        "linked.id must be an integer."
                    ) from exc
        return val

    def validate_block_corrections(self, val):
        if not val:
            return {}
        for _k, corr in val.items():
            if not isinstance(corr, dict):
                raise serializers.ValidationError("Each block correction must be an object.")
        return val


class TabularImportCreateSerializer(serializers.Serializer):
    file = serializers.FileField()
    provenance = serializers.JSONField(required=False, default=dict)
    source_institution = serializers.CharField(required=False, allow_blank=True, default="")
    collection_name = serializers.CharField(required=False, allow_blank=True, default="")
    language = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_file(self, value):
        max_bytes = int(getattr(settings, "TABULAR_IMPORT_MAX_BYTES", 15 * 1024 * 1024))
        if hasattr(value, "size") and value.size and value.size > max_bytes:
            raise serializers.ValidationError("Tabular file is too large for this server.")
        return value


class TabularImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = TabularImportJob
        fields = [
            "id",
            "status",
            "source_filename",
            "provenance",
            "column_mapping",
            "staged_rows",
            "row_review_state",
            "validation_errors",
            "user_safe_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "source_filename",
            "staged_rows",
            "validation_errors",
            "user_safe_error",
            "created_at",
            "updated_at",
        ]


class TabularImportJobPatchSerializer(serializers.Serializer):
    column_mapping = serializers.DictField(required=False)
    row_review_state = serializers.DictField(required=False)
    provenance = serializers.JSONField(required=False)


class ChunkedUploadInitSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=512)
    byte_size = serializers.IntegerField(min_value=1)
    media_type = serializers.ChoiceField(
        choices=Media.MEDIA_TYPE_CHOICES,
        default="image",
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    provenance = serializers.JSONField(required=False, default=dict)
    source_institution = serializers.CharField(required=False, allow_blank=True, default="")
    collection_name = serializers.CharField(required=False, allow_blank=True, default="")
    language = serializers.CharField(required=False, allow_blank=True, default="")
    ocr_language = serializers.CharField(required=False, allow_blank=True, default="")
    copyright_note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_byte_size(self, value):
        max_bytes = int(getattr(settings, "OCR_MAX_FILE_BYTES", 25 * 1024 * 1024))
        if value > max_bytes * 4:
            raise serializers.ValidationError(
                "Declared size exceeds maximum allowed upload for this server.",
            )
        return value


class ChunkedUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChunkedMediaUpload
        fields = [
            "id",
            "original_filename",
            "expected_bytes",
            "bytes_written",
            "media_type",
            "description",
            "standalone_ingestion",
            "created_at",
        ]
        read_only_fields = fields
