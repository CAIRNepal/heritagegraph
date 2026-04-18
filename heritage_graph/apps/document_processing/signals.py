"""
Signal handlers for document processing.

Automatically triggers OCR when documents are uploaded.
"""

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.heritage_data.models import Media
from .models import UploadedDocument

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
    document_extensions = ('.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp')
    
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
    
    # Skip if not a document-type file
    if not is_document_type(instance.file):
        logger.debug(f"Media {instance.id} is not a document type, skipping OCR")
        return
    
    logger.info(f"Document uploaded: {instance.file.name} ({instance.id})")
    
    try:
        # Import here to avoid circular imports at app startup
        from .tasks import classify_and_route_document
        
        # Check if OCR is already initiated for this media
        if hasattr(instance, 'ocr_document'):
            logger.debug(f"OCR already initiated for media {instance.id}")
            return
        
        # Create an UploadedDocument record (status='pending')
        # Document type will be determined by the classifier task
        doc = UploadedDocument.objects.create(
            media=instance,
            document_type='image_print',  # Will be replaced by classifier
            status='pending'
        )
        
        logger.info(f"Created UploadedDocument {doc.id} for media {instance.id}")
        
        # Queue the classification and routing task
        # In development (with CELERY_TASK_ALWAYS_EAGER=True), this runs synchronously
        # In production, this queues an async task to a Celery worker
        classify_and_route_document.delay(str(doc.id))
        
        logger.debug(f"Queued OCR processing task for document {doc.id}")
        
    except Exception as exc:
        logger.error(f"Error initiating OCR for media {instance.id}: {exc}")
        # Don't raise - we don't want to break the Media upload if OCR init fails
