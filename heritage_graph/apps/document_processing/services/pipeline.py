from __future__ import annotations

import logging

import pytesseract
from django.utils import timezone

from ..models import ExtractedField, UploadedDocument
from .agents.doc_intelligence import run_doc_intelligence
from .classifier import classify_media_file
from .htr import extract_handwritten
from .ner import extract_structured_fields
from .ocr_settings import get_ocr_settings
from .pdf import extract_pdf_digital
from .raster_ocr import extract_raster_ocr
from .vision_rescue import run_vision_rescue

logger = logging.getLogger(__name__)


def _reset_processing_state(document: UploadedDocument) -> None:
    document.error_message = ""
    document.user_safe_error = ""
    document.raw_text = ""
    document.processing_started = timezone.now()
    document.processing_finished = None
    document.save(
        update_fields=[
            "error_message",
            "user_safe_error",
            "raw_text",
            "processing_started",
            "processing_finished",
            "updated_at",
        ]
    )
    # Clear old outputs (v1: keep it simple; later: version runs)
    document.extracted_fields.all().delete()
    for page in document.pages.all():
        page.ocr_results.all().delete()
    document.pages.all().delete()


def process_uploaded_document(*, document_id: str) -> None:
    doc = UploadedDocument.objects.get(id=document_id)
    s = get_ocr_settings()
    if not s.enabled:
        doc.status = "failed"
        doc.user_safe_error = "Document processing is disabled in this environment."
        doc.error_message = "OCR_ENABLED is false"
        doc.processing_finished = timezone.now()
        doc.save(
            update_fields=["status", "user_safe_error", "error_message", "processing_finished", "updated_at"]
        )
        return

    _reset_processing_state(doc)
    doc.status = "processing"
    doc.save(update_fields=["status", "updated_at"])

    f = doc.media.file
    try:
        f.open("rb")
        size = 0
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            if not chunk:
                break
            size += len(chunk)
        if size > s.max_file_bytes:
            raise ValueError("File is too large to process (server limit).")
    finally:
        try:
            f.close()
        except Exception:
            pass

    cls = classify_media_file(django_file=doc.media.file)
    doc.document_type = cls.document_type
    doc.classification_confidence = cls.confidence
    doc.save(update_fields=["document_type", "classification_confidence", "updated_at"])

    # Route
    try:
        if doc.document_type == "pdf_digital":
            raw = extract_pdf_digital(document=doc, django_file=doc.media.file)
        elif doc.document_type in ("pdf_scanned", "image_print"):
            raw = extract_raster_ocr(
                document=doc, django_file=doc.media.file, source_label="raster_ocr"
            )
        elif doc.document_type == "image_handwritten":
            raw = extract_handwritten(document=doc, django_file=doc.media.file)
        elif doc.document_type == "image_inscription":
            try:
                raw = run_vision_rescue(document=doc, django_file=doc.media.file)
            except Exception:
                # If vision isn't configured, fall back to Tesseract as a best-effort path.
                raw = extract_raster_ocr(
                    document=doc, django_file=doc.media.file, source_label="inscription_fallback"
                )
        else:
            raw = extract_raster_ocr(
                document=doc, django_file=doc.media.file, source_label="default"
            )

        if not (raw or "").strip():
            # If Tesseract is missing, fail with a clear user-safe error.
            # (We only know if raster path raised TesseractNotFound in inner calls.)
            # As a best-effort, attempt vision rescue for images if configured; otherwise mark failed.
            if doc.document_type in ("image_inscription", "image_print", "image_handwritten"):
                try:
                    raw = run_vision_rescue(document=doc, django_file=doc.media.file)
                except Exception:
                    raw = ""

        if not (raw or "").strip():
            raise RuntimeError("No text could be extracted from this document.")

        doc.raw_text = raw

        # Agent 1: Document Intelligence
        di_result = run_doc_intelligence(text=raw, use_ollama=True)
        doc.metadata = getattr(doc, "metadata", {}) or {}
        doc.metadata.update({
            "heritage_doc_type": di_result.heritage_doc_type.value,
            "heritage_doc_type_confidence": di_result.heritage_doc_type_confidence,
            "detected_language": di_result.detected_language,
            "chunk_count": len(di_result.chunks),
            "ontology_class_keys": list(di_result.ontology_snippet.keys()),
        })

        # Carry forward the first matched ontology key into the NER step
        ontology_key = (list(di_result.ontology_snippet.keys()) or [None])[0]
        if ontology_key is None and getattr(doc, "cultural_entity_id", None):
            try:
                ce = doc.cultural_entity
                cat = getattr(ce, "category", None) or ""
                ontology_key = {
                    "monument": "structure",
                    "artifact": "iconography",
                    "ritual": "ritual",
                    "festival": "festival",
                    "tradition": "tradition",
                    "document": "source",
                }.get(str(cat))
            except Exception:
                ontology_key = None

        items = extract_structured_fields(text=raw, ontology_class_key=ontology_key)
        for it in items:
            ExtractedField.objects.create(
                document=doc,
                field_name=it.field_name,
                field_value=it.field_value,
                source_entity_type=it.source_entity_type,
                confidence=it.confidence,
            )

        doc.status = "completed"
        doc.processing_finished = timezone.now()
        doc.save(
            update_fields=["raw_text", "metadata", "status", "processing_finished", "updated_at"]
        )
    except pytesseract.TesseractNotFoundError as exc:
        logger.exception("Tesseract is not available on this runtime")
        doc.status = "failed"
        doc.user_safe_error = "OCR is not available on the server (missing Tesseract). Ask an admin to install/configure it."
        doc.error_message = str(exc)
        doc.processing_finished = timezone.now()
        doc.save(
            update_fields=["status", "user_safe_error", "error_message", "processing_finished", "updated_at"]
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Document processing failed: %s", document_id)
        doc.status = "failed"
        doc.user_safe_error = "We could not read this document. If this keeps happening, try a clearer scan or a smaller file."
        doc.error_message = repr(exc)
        doc.processing_finished = timezone.now()
        doc.save(
            update_fields=["status", "user_safe_error", "error_message", "processing_finished", "updated_at"]
        )
