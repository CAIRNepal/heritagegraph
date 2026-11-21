from django.apps import AppConfig


class DocumentProcessingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.document_processing"
    verbose_name = "Document Processing & OCR"

    def ready(self):
        """
        App initialization: Import signals to register OCR trigger.
        """
        import apps.document_processing.signals  # noqa

