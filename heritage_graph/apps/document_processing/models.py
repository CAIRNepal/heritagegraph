"""
Document Processing Models

Models for OCR pipeline and document processing:
- UploadedDocument: Main document with overall OCR status
- DocumentPage: Individual pages extracted from documents
- OCRResult: Engine-specific OCR results for audit trail
- ExtractedField: NER-extracted structured fields for form pre-population
"""

import uuid

from django.conf import settings
from django.db import models

from apps.heritage_data.models import CulturalEntity, Media, Submission


class UploadedDocument(models.Model):
    """
    Main document record for OCR processing.
    Tracks overall status, document type classification, and processing lifecycle.
    """

    DOCUMENT_TYPE_CHOICES = [
        ('pdf_digital', 'PDF (digital-born)'),
        ('pdf_scanned', 'PDF (scanned)'),
        ('image_print', 'Image (printed page)'),
        ('image_handwritten', 'Image (handwritten)'),
        ('image_inscription', 'Image (stone/inscription)'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending OCR'),
        ('processing', 'OCR in progress'),
        ('completed', 'OCR completed'),
        ('failed', 'OCR failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    media = models.OneToOneField(Media, on_delete=models.CASCADE, related_name='ocr_document')
    
    # Document classification
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        help_text="Type of document (affects engine selection)"
    )
    classification_confidence = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=1.0,
        help_text="Confidence score of document type classification (0.0-1.0)"
    )

    # Processing status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current OCR processing status"
    )
    
    # OCR output
    raw_text = models.TextField(
        blank=True,
        help_text="Complete extracted text from all pages"
    )

    provenance = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured provenance from uploader (source institution, collection, languages, etc.)",
    )

    ingestion_review_state = models.JSONField(
        default=dict,
        blank=True,
        help_text="Contributor OCR/semantic review draft: field_decisions, block_corrections, ontology_handoff_key",
    )

    processing_progress = models.JSONField(
        default=dict,
        blank=True,
        help_text="Latest pipeline progress for SSE/UI: status, page, engine, message, percent",
    )

    # Processing metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processing_started = models.DateTimeField(null=True, blank=True)
    processing_finished = models.DateTimeField(null=True, blank=True)
    
    # Error tracking
    user_safe_error = models.TextField(
        blank=True,
        help_text="User-safe error message (no stack traces, minimal PII)"
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error details if processing failed"
    )

    claude_vision_invocations = models.PositiveIntegerField(
        default=0,
        help_text="Count of Claude Vision (or other vision-rescue) invocations for cost control/audit"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Agent pipeline metadata (heritage_doc_type, detected_language, chunk_count, etc.)"
    )
    
    # Link to contributions
    submission = models.ForeignKey(
        Submission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ocr_documents',
        help_text="Legacy: associated Submission (if any)"
    )
    cultural_entity = models.ForeignKey(
        CulturalEntity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ocr_documents',
        help_text="New workflow: associated CulturalEntity (if any)"
    )

    class Meta:
        ordering = ["-created_at"]
        db_table = "document_processing_uploaded_document"
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['document_type']),
        ]

    def __str__(self):
        return f"UploadedDocument({self.id}) - {self.document_type} ({self.status})"


class DocumentPage(models.Model):
    """
    Represents a single page extracted from a document.
    Stores per-page OCR text and aggregated confidence score.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        UploadedDocument,
        on_delete=models.CASCADE,
        related_name='pages',
        help_text="Parent document"
    )
    
    page_number = models.PositiveIntegerField(
        help_text="Page number (1-indexed)"
    )
    
    # OCR output for this page
    raw_text = models.TextField(
        help_text="Raw OCR-extracted text for this page"
    )
    
    # Confidence score (aggregated from all engines that processed this page)
    confidence = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.0,
        help_text="Average confidence score across engines (0.0-1.0)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document', 'page_number']
        db_table = "document_processing_document_page"
        unique_together = ['document', 'page_number']
        indexes = [
            models.Index(fields=['document', 'page_number']),
        ]

    def __str__(self):
        return f"DocumentPage({self.document.id}, page {self.page_number})"


class OCRResult(models.Model):
    """
    Stores engine-specific OCR results.
    Provides audit trail of which engines processed which pages and their outputs/confidence scores.
    """

    ENGINE_CHOICES = [
        ('pdfplumber', 'pdfplumber'),
        ('tesseract', 'Tesseract 5'),
        ('easyocr', 'EasyOCR'),
        ('trocr', 'TrOCR (Handwritten)'),
        ('claude_vision', 'Claude Vision (Rescue)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    page = models.ForeignKey(
        DocumentPage,
        on_delete=models.CASCADE,
        related_name='ocr_results',
        help_text="Page this result came from"
    )
    
    engine = models.CharField(
        max_length=50,
        choices=ENGINE_CHOICES,
        help_text="Which OCR engine produced this result"
    )
    
    # OCR output
    text = models.TextField(
        help_text="Raw text extracted by this engine"
    )
    
    # Confidence score from this engine
    confidence = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.0,
        help_text="Confidence score from this engine (0.0-1.0)"
    )
    
    # Engine-specific metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Engine-specific metadata (e.g., script detected by EasyOCR, model used by TrOCR)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        db_table = "document_processing_ocr_result"
        indexes = [
            models.Index(fields=['page', 'engine']),
            models.Index(fields=['engine']),
        ]

    def __str__(self):
        return f"OCRResult({self.page.document.id}, page {self.page.page_number}, {self.engine})"


class ExtractedField(models.Model):
    """
    Named Entity Recognition (NER) extracted fields from OCR text.
    Used to pre-populate contribution forms with structured data.
    """

    ENTITY_TYPE_CHOICES = [
        ('PERSON', 'Person'),
        ('LOCATION', 'Location'),
        ('DATE', 'Date'),
        ('ARTIFACT', 'Artifact'),
        ('EVENT', 'Event'),
        ('TRADITION', 'Tradition'),
        ('ORGANIZATION', 'Organization'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        UploadedDocument,
        on_delete=models.CASCADE,
        related_name='extracted_fields',
        help_text="Document this field was extracted from"
    )
    
    # Form field mapping
    field_name = models.CharField(
        max_length=255,
        help_text="Target form field name (e.g., 'person_name', 'location')"
    )
    
    field_value = models.TextField(
        help_text="Extracted value for this field"
    )
    
    # Confidence & entity metadata
    confidence = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.0,
        help_text="Overall confidence of this extraction (0.0-1.0)"
    )
    
    source_entity_type = models.CharField(
        max_length=50,
        choices=ENTITY_TYPE_CHOICES,
        help_text="NER entity type that produced this field"
    )
    
    # Vocabulary matching score
    vocabulary_match_score = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.0,
        null=True,
        blank=True,
        help_text="Score from cross-checking value against Wikidata/AAT (0.0-1.0)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document', '-confidence']
        db_table = "document_processing_extracted_field"
        indexes = [
            models.Index(fields=['document', 'field_name']),
            models.Index(fields=['source_entity_type']),
        ]

    def __str__(self):
        return f"ExtractedField({self.document.id}, {self.field_name}={self.field_value[:50]})"


class ChunkedMediaUpload(models.Model):
    """
    Server-assembled large uploads before Media / OCR pipeline creation.
    Chunks are written to MEDIA_ROOT-relative path stored on this row.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contributor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chunked_media_uploads",
    )
    original_filename = models.CharField(max_length=512)
    expected_bytes = models.PositiveBigIntegerField()
    bytes_written = models.PositiveBigIntegerField(default=0)
    relative_temp_path = models.CharField(max_length=1024, blank=True)
    provenance = models.JSONField(default=dict, blank=True)
    media_type = models.CharField(max_length=32, default="image")
    description = models.CharField(max_length=2048, blank=True)
    standalone_ingestion = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "document_processing_chunked_media_upload"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ChunkedMediaUpload({self.id}, {self.bytes_written}/{self.expected_bytes})"


class TabularImportJob(models.Model):
    """CSV/Excel staged import with column mapping and per-row review state."""

    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready_review"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready for review"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contributor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tabular_import_jobs",
    )
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING)
    source_filename = models.CharField(max_length=512, blank=True)
    provenance = models.JSONField(default=dict, blank=True)
    column_mapping = models.JSONField(
        default=dict,
        blank=True,
        help_text="Maps source column header -> registry field key or role label",
    )
    staged_rows = models.JSONField(default=list, blank=True)
    row_review_state = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-row reconciliation: row_index -> { decisions... }",
    )
    validation_errors = models.JSONField(default=list, blank=True)
    user_safe_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "document_processing_tabular_import_job"
        ordering = ["-created_at"]

    def __str__(self):
        return f"TabularImportJob({self.id}, {self.status})"

