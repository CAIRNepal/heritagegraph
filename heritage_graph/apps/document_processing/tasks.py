"""
Celery task definitions for OCR and document processing.

These tasks run asynchronously to process documents through the OCR pipeline:
- classify_and_route_document: Determines document type and routes to appropriate engine
- extract_text_*: Engine-specific OCR extraction tasks
- extract_structured_fields: NER extraction from raw OCR text
- map_fields_to_form: Maps NER fields to contribution form structure
"""

import logging
from datetime import datetime
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Import models
from .models import UploadedDocument, DocumentPage, OCRResult, ExtractedField


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
        doc = UploadedDocument.objects.get(id=document_id)
        doc.status = 'processing'
        doc.processing_started = timezone.now()
        doc.save()
        
        logger.info(f"Starting document processing for {document_id}")
        
        # TODO: Implement classifier logic
        # 1. Read file from media.file
        # 2. Determine document type and confidence
        # 3. Queue the appropriate engine task
        # Routes:
        # - binary_is_pdf_with_embedded_text → extract_text_pdfplumber
        # - otherwise_pdf → extract_text_tesseract (with fallback to extract_text_easyocr)
        # - image_with_devanagari → extract_text_tesseract (primary) + extract_text_easyocr (fallback)
        # - image_handwritten → extract_text_trocr
        # - image_low_contrast → prepare for vision_rescue_task
        
        logger.info(f"Document {document_id} classified and routed")
        
    except UploadedDocument.DoesNotExist:
        logger.error(f"UploadedDocument {document_id} not found")
        raise
    except Exception as exc:
        logger.error(f"Error in classify_and_route_document: {exc}")
        doc.status = 'failed'
        doc.error_message = str(exc)
        doc.save()
        raise


# ──────────────────────────────────────────────────────────────────────────────
# ENGINE-SPECIFIC TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2)
def extract_text_pdfplumber(self, document_id: str):
    """
    Extract text from digital-born PDFs using pdfplumber.
    No OCR needed — direct text extraction with high fidelity.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Extracting PDF text with pdfplumber for {document_id}")
        
        # TODO: Implement pdfplumber extraction
        # 1. Load PDF from doc.media.file
        # 2. For each page: extract text, create DocumentPage, create OCRResult
        # 3. Concatenate full text
        # 4. Set doc.raw_text = full_text
        # 5. Queue extract_structured_fields task
        
        logger.info(f"PDF extraction complete for {document_id}")
        
    except Exception as exc:
        logger.error(f"Error in extract_text_pdfplumber: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=2)
def extract_text_tesseract(self, document_id: str):
    """
    Extract text from printed documents (Devanagari/mixed script) using Tesseract 5.
    Primary engine for printed manuscripts, signage, and scanned PDFs.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Extracting text with Tesseract for {document_id}")
        
        # TODO: Implement Tesseract extraction
        # 1. Load image(s) from doc.media.file (or convert PDF to images)
        # 2. Config: --oem 1 --psm 3 -l deva+eng
        # 3. For each page:
        #    - Run Tesseract
        #    - Get confidence score
        #    - Create DocumentPage, OCRResult
        # 4. If confidence < threshold: queue extract_text_easyocr_fallback
        # 5. Set doc.raw_text
        # 6. Queue extract_structured_fields if successful
        
        logger.info(f"Tesseract extraction complete for {document_id}")
        
    except Exception as exc:
        logger.error(f"Error in extract_text_tesseract: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=2)
def extract_text_easyocr_fallback(self, document_id: str):
    """
    Fallback OCR engine: runs when Tesseract confidence is too low.
    EasyOCR handles mixed scripts better than Tesseract.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Extracting text with EasyOCR (fallback) for {document_id}")
        
        # TODO: Implement EasyOCR extraction
        # 1. Load image(s)
        # 2. Run EasyOCR with lang=['en', 'ne']
        # 3. For each page:
        #    - Get text and confidence
        #    - Create DocumentPage, OCRResult
        # 4. If still low confidence: mark for vision_rescue
        # 5. Queue extract_structured_fields
        
        logger.info(f"EasyOCR extraction complete for {document_id}")
        
    except Exception as exc:
        logger.error(f"Error in extract_text_easyocr_fallback: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=2)
def extract_text_trocr(self, document_id: str):
    """
    Extract handwritten text using Microsoft TrOCR (transformer-based HTR).
    Best for handwritten notes, donor records, field documentation.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Extracting handwritten text with TrOCR for {document_id}")
        
        # TODO: Implement TrOCR extraction
        # 1. Load model: microsoft/trocr-large-handwritten
        # 2. Load image(s)
        # 3. For each page:
        #    - Run TrOCR
        #    - Get confidence
        #    - Create DocumentPage, OCRResult
        # 4. Queue extract_structured_fields
        
        logger.info(f"TrOCR extraction complete for {document_id}")
        
    except Exception as exc:
        logger.error(f"Error in extract_text_trocr: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=2)
def vision_rescue_task(self, document_id: str, page_number: int = None):
    """
    Claude Vision rescue: Send difficult inscriptions/low-confidence pages to Claude.
    Per-document cap: max 1 Vision call per document (cost control).
    
    Args:
        document_id: UUID of UploadedDocument
        page_number: Specific page to rescue (None = full document rescue)
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Running Claude Vision rescue for {document_id} (page {page_number})")
        
        # TODO: Implement Claude Vision extraction
        # 1. Check Claude Vision call count for this document (enforce per-doc cap)
        # 2. Select page(s) to rescue (low confidence or specified page)
        # 3. Call Claude API with vision prompt
        # 4. Parse response
        # 5. Create OCRResult with engine='claude_vision'
        # 6. Queue extract_structured_fields
        
        logger.info(f"Claude Vision rescue complete for {document_id}")
        
    except Exception as exc:
        logger.error(f"Error in vision_rescue_task: {exc}")
        self.retry(exc=exc, countdown=120)  # Longer cooldown for API delays


# ──────────────────────────────────────────────────────────────────────────────
# POST-PROCESSING TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2)
def extract_structured_fields(self, document_id: str):
    """
    NER extraction: Parse raw OCR text and extract named entities.
    Uses Instructor + Claude to structure entities into form-ready fields.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Extracting structured fields from {document_id}")
        
        # TODO: Implement NER extraction
        # 1. Load raw_text from document
        # 2. Call Instructor + Claude to extract:
        #    - PERSON: name, dates, roles
        #    - LOCATION: name, coordinates (if present)
        #    - DATE: ranges, events
        #    - ARTIFACT: type, material, description
        #    - EVENT: name, date, participants
        #    - TRADITION: name, description
        # 3. For each extracted entity:
        #    - Create ExtractedField record
        #    - Set field_name (mapped to form fields)
        #    - Score confidence + vocabulary_match_score
        # 4. Queue map_fields_to_form task
        # 5. Update doc.status = 'completed' when all fields extracted
        
        logger.info(f"Structured extraction complete for {document_id}")
        doc.status = 'completed'
        doc.processing_finished = timezone.now()
        doc.save()
        
    except Exception as exc:
        logger.error(f"Error in extract_structured_fields: {exc}")
        self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=1)
def map_fields_to_form(self, document_id: str, submission_type: str = 'cultural_entity'):
    """
    Map NER-extracted fields to contribution form structure.
    Enables form pre-population with confidence badges.
    
    Args:
        document_id: UUID of UploadedDocument
        submission_type: 'submission' (legacy) or 'cultural_entity' (new)
    """
    try:
        doc = UploadedDocument.objects.get(id=document_id)
        logger.info(f"Mapping extracted fields to {submission_type} form for {document_id}")
        
        # TODO: Implement field mapping
        # 1. Load registry.ts form field definitions for submission_type
        # 2. Load all ExtractedField records for this document
        # 3. Map each extracted entity to form fields:
        #    - PERSON → person_name, person_birth_date, person_death_date, person_role
        #    - LOCATION → location_name, location_coordinates
        #    - DATE → date_range, historical_period
        #    - etc.
        # 4. Return dict: { form_field_name: { value, confidence, source } }
        # 5. This dict is used by API endpoint to pre-fill forms
        
        logger.info(f"Field mapping complete for {document_id}")
        
    except Exception as exc:
        logger.error(f"Error in map_fields_to_form: {exc}")
        self.retry(exc=exc, countdown=60)


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
    from django.utils import timezone
    from datetime import timedelta
    
    cutoff = timezone.now() - timedelta(days=days_old)
    deleted_count, _ = UploadedDocument.objects.filter(
        status='failed',
        created_at__lt=cutoff
    ).delete()
    
    logger.info(f"Deleted {deleted_count} old failed documents")
    return deleted_count
