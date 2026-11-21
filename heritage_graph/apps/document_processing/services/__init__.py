"""
OCR and document processing service layer.

This package is imported by `apps.document_processing.tasks` to keep heavy OCR
code out of the Celery task module itself.
"""
