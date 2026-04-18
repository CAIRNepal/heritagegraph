# apps/document_processing/serializers.py
from __future__ import annotations

from apps.heritage_data.models import CulturalEntity, Media, Submission
from django.conf import settings
from rest_framework import serializers

from .models import UploadedDocument


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
        ]
        read_only_fields = fields


def suggestions_for_document(*, document: UploadedDocument) -> dict[str, dict]:
    """
    Map field key -> { value, confidence, entityType, fieldName, source }.
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
    return out


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
        if bool(ce) == bool(sid):
            raise serializers.ValidationError(
                "Provide exactly one of cultural_entity_id or submission_id."
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        description = validated_data.get("description") or ""
        media_type = validated_data.get("media_type") or "image"
        f = validated_data["file"]

        ce_id = validated_data.get("cultural_entity_id")
        sid = (validated_data.get("submission_id") or "").strip() or None

        if ce_id:
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

        media.full_clean()
        media.save()
        return media
