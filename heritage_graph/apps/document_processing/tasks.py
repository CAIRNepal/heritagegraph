"""
Celery task definitions for OCR and document processing.

The production pipeline is orchestrated in `apps.document_processing.services.pipeline`.
Kept task entrypoints are stable for admin actions and existing `.delay()` call sites.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import UploadedDocument
from .services.pipeline import process_uploaded_document

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE TASK
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def classify_and_route_document(self, document_id: str):
    """
    Main entry point: Classifies document type and routes to appropriate OCR engine.
    
    This task:
    1. Loads the UploadedDocument
    2. Runs classifier to determine document type
    3. Delegates to engine-specific task (tesseract, easyocr, trocr, etc.)
    4. Updates document status
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        logger.info("Starting document processing for %s", document_id)
        process_uploaded_document(document_id=document_id)
    except UploadedDocument.DoesNotExist:
        logger.error("UploadedDocument %s not found", document_id)
        raise
    except Exception as exc:
        logger.error("Error in classify_and_route_document: %s", exc, exc_info=True)
        raise


# ──────────────────────────────────────────────────────────────────────────────
# ENGINE-SPECIFIC TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=0)
def extract_text_pdfplumber(self, document_id: str):
    # Legacy entrypoint: route through unified pipeline
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def extract_text_tesseract(self, document_id: str):
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def extract_text_easyocr_fallback(self, document_id: str):
    """
    Fallback OCR engine: runs when Tesseract confidence is too low.
    EasyOCR handles mixed scripts better than Tesseract.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def extract_text_trocr(self, document_id: str):
    """
    Extract handwritten text using Microsoft TrOCR (transformer-based HTR).
    Best for handwritten notes, donor records, field documentation.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def vision_rescue_task(self, document_id: str, page_number: int = None):
    """
    Claude Vision rescue: Send difficult inscriptions/low-confidence pages to Claude.
    Per-document cap: max 1 Vision call per document (cost control).
    
    Args:
        document_id: UUID of UploadedDocument
        page_number: Specific page to rescue (None = full document rescue)
    """
    process_uploaded_document(document_id=document_id)


# ──────────────────────────────────────────────────────────────────────────────
# POST-PROCESSING TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=0)
def extract_structured_fields(self, document_id: str):
    """
    NER extraction: Parse raw OCR text and extract named entities.
    Uses Instructor + Claude to structure entities into form-ready fields.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    # NER is executed inside the unified pipeline today.
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def map_fields_to_form(self, document_id: str, submission_type: str = 'cultural_entity'):
    """
    Map NER-extracted fields to contribution form structure.
    Enables form pre-population with confidence badges.
    
    Args:
        document_id: UUID of UploadedDocument
        submission_type: 'submission' (legacy) or 'cultural_entity' (new)
    """
    process_uploaded_document(document_id=document_id)


# ──────────────────────────────────────────────────────────────────────────────
# UTILITY TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task
def cleanup_failed_documents(days_old: int = 30):
    """
    Periodic cleanup: Delete old failed document processing records.
    Can be scheduled with Celery Beat.
    
    Args:
        days_old: Delete records older than this many days
    """
    cutoff = timezone.now() - timedelta(days=days_old)
    deleted_count, _ = UploadedDocument.objects.filter(
        status='failed',
        created_at__lt=cutoff
    ).delete()
    
    logger.info(f"Deleted {deleted_count} old failed documents")
    return deleted_count
