"""
Signal handlers for document processing.

Automatically triggers OCR when documents are uploaded.
"""

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from apps.heritage_data.models import Media
from .models import ExtractedField, UploadedDocument

logger = logging.getLogger(__name__)


def is_document_type(file_field):
    """
    Determine if a file should be processed by OCR.
    
    Args:
        file_field: Django FileField instance
    
    Returns:
        bool: True if file is a document (PDF, image), False otherwise
    """
    if not file_field:
        return False
    
    filename = file_field.name.lower()
    document_extensions = (
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".tiff",
        ".tif",
        ".webp",
        ".bmp",
        ".gif",
        ".heic",
        ".heif",
        ".avif",
    )
    
    return any(filename.endswith(ext) for ext in document_extensions)


@receiver(post_save, sender=Media)
def on_media_upload(sender, instance, created, **kwargs):
    """
    Signal handler: Triggered when a Media file is uploaded.
    
    If the file is a document (PDF, image), create an UploadedDocument record
    and queue the OCR classification task.
    
    Args:
        sender: Media model class
        instance: The Media instance that was saved
        created: Boolean indicating if this is a new record
        **kwargs: Additional signal kwargs
    """
    # Only process newly created media files, not updates
    if not created:
        return

    if getattr(instance, "ocr_deferred", False):
        logger.debug(f"Media {instance.id} has ocr_deferred; skipping auto OCR")
        return

    # Skip if not a document-type file
    if not is_document_type(instance.file):
        logger.debug(f"Media {instance.id} is not a document type, skipping OCR")
        return
    
    logger.info(f"Document uploaded: {instance.file.name} ({instance.id})")
    
    try:
        # Import here to avoid circular imports at app startup
        from .tasks import classify_and_route_document
        
        # Avoid relying on reverse OneToOne descriptor quirks across Django versions.
        if UploadedDocument.objects.filter(media_id=instance.pk).exists():
            logger.debug("OCR already initiated for media %s", instance.id)
            return
        
        # Create an UploadedDocument record (status='pending')
        # Document type will be determined by the classifier task
        doc = UploadedDocument.objects.create(
            media=instance,
            document_type='image_print',  # Will be replaced by classifier
            status='pending',
            submission=instance.submission,
            cultural_entity=instance.cultural_entity,
        )
        
        logger.info(f"Created UploadedDocument {doc.id} for media {instance.id}")
        
        if not getattr(settings, "OCR_ENABLED", True):
            doc.status = "failed"
            doc.user_safe_error = "Document processing is disabled in this environment."
            doc.error_message = "OCR_ENABLED is false"
            doc.save(update_fields=["status", "user_safe_error", "error_message", "updated_at"])
            return

        # Queue the classification and routing task
        # In development (with CELERY_TASK_ALWAYS_EAGER=True), this runs synchronously
        # In production, this queues an async task to a Celery worker
        classify_and_route_document.delay(str(doc.id))
        
        logger.debug(f"Queued OCR processing task for document {doc.id}")
        
    except Exception as exc:
        logger.error(f"Error initiating OCR for media {instance.id}: {exc}")
        # Don't raise - we don't want to break the Media upload if OCR init fails


@receiver(post_save, sender=ExtractedField)
def create_assertion_for_extracted_field(sender, instance, created, **kwargs):
    """
    Record a HeritageAssertion + DataSource for OCR-extracted fields.

    CulturalEntity uses a UUID primary key; HeritageAssertion.object_id is an integer,
    so we store a standalone assertion (no generic FK) and embed entity/document ids
    in assertion_content for traceability.
    """
    if not created:
        return
    doc = instance.document
    entity = getattr(doc, "cultural_entity", None)
    try:
        from apps.cidoc_data.models import DataSource, HeritageAssertion

        ds = DataSource.objects.create(
            name=f"OCR document {doc.id}",
            source_type="field_survey",
            citation=f"Extracted from uploaded document {doc.id}",
            url="",
        )
        try:
            cnum = float(instance.confidence or 0.5)
        except (TypeError, ValueError):
            cnum = 0.5
        conf = "likely"
        if cnum < 0.35:
            conf = "uncertain"
        elif cnum >= 0.75:
            conf = "certain"
        ent_part = ""
        if entity is not None:
            ent_part = f" cultural_entity_id={getattr(entity, 'entity_id', entity.pk)}"
        HeritageAssertion.objects.create(
            content_type=None,
            object_id=None,
            asserted_property=instance.field_name,
            asserted_value=instance.field_value,
            assertion_content=(
                f"OCR/NER extraction (document={doc.id},{ent_part} "
                f"confidence={instance.confidence} type={instance.source_entity_type})"
            ),
            source=ds,
            source_citation=f"Document {doc.id}",
            contributed_by="ocr-pipeline",
            confidence=conf,
            reconciliation_status="pending",
        )
    except Exception as exc:
        logger.warning("Could not create HeritageAssertion for ExtractedField: %s", exc)
