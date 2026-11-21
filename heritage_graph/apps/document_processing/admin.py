import logging

from django.contrib import admin, messages

from .models import DocumentPage, ExtractedField, OCRResult, UploadedDocument

logger = logging.getLogger(__name__)


@admin.register(UploadedDocument)
class UploadedDocumentAdmin(admin.ModelAdmin):
    """Admin interface for UploadedDocument."""
    
    list_display = (
        "id",
        "document_type_display",
        "status_display",
        "classification_confidence",
        "claude_vision_invocations",
        "created_at",
        "pages_count",
    )
    list_filter = ('status', 'document_type', 'created_at')
    search_fields = (
        "id",
        "raw_text",
        "user_safe_error",
        "error_message",
        "submission__submission_id",
        "cultural_entity__name",
    )
    readonly_fields = (
        "id",
        "claude_vision_invocations",
        "created_at",
        "updated_at",
        "processing_started",
        "processing_finished",
        "raw_text",
        "user_safe_error",
        "error_message",
    )
    
    fieldsets = (
        ('Document Identity', {
            'fields': ('id', 'media', 'submission', 'cultural_entity')
        }),
        ('Classification', {
            'fields': ('document_type', 'classification_confidence', 'status')
        }),
        ('Processing', {
            'fields': (
                'created_at',
                'updated_at',
                'processing_started',
                'processing_finished',
            )
        }),
        ('OCR Output', {
            'fields': ('raw_text',),
            'classes': ('collapse',)
        }),
        ('Error Information', {
            'fields': ("user_safe_error", 'error_message',),
            'classes': ('collapse',)
        }),
    )
    
    def document_type_display(self, obj):
        return obj.get_document_type_display()
    document_type_display.short_description = 'Document Type'
    
    def status_display(self, obj):
        return obj.get_status_display()
    status_display.short_description = 'Status'
    
    def pages_count(self, obj):
        """Show count of pages in this document."""
        return obj.pages.count()
    pages_count.short_description = 'Pages'
    
    actions = ['retry_failed_documents', 'delete_results']
    
    def retry_failed_documents(self, request, queryset):
        """Admin action: Retry OCR processing for failed documents."""
        from .tasks import classify_and_route_document

        failed = queryset.filter(status="failed")
        if failed.count() > 50:
            self.message_user(
                request,
                (
                    "Too many selected failed documents (max 50). "
                    "Narrow your selection and try again."
                ),
                level=messages.ERROR,
            )
            return

        count = 0
        for doc in failed:
            doc.user_safe_error = ""
            doc.error_message = ""
            doc.claude_vision_invocations = 0
            doc.status = "pending"
            doc.save(
                update_fields=[
                    "user_safe_error",
                    "error_message",
                    "claude_vision_invocations",
                    "status",
                    "updated_at",
                ]
            )
            classify_and_route_document.delay(str(doc.id))
            count += 1
            logger.info(
                "admin_ocr_requeue",
                extra={
                    "uploaded_document_id": str(doc.id),
                    "actor_id": getattr(request.user, "id", None),
                },
            )
        
        self.message_user(request, f"Queued {count} failed documents for reprocessing")
    retry_failed_documents.short_description = (
        "Retry OCR processing for failed documents"
    )
    
    def delete_results(self, request, queryset):
        """Admin action: Delete OCR results but keep the document record."""
        total_results = 0
        for doc in queryset:
            for page in doc.pages.all():
                total_results += page.ocr_results.count()
                page.ocr_results.all().delete()
        
        self.message_user(request, f"Deleted {total_results} OCR results")
    delete_results.short_description = "Delete OCR results (keep documents)"


@admin.register(DocumentPage)
class DocumentPageAdmin(admin.ModelAdmin):
    """Admin interface for DocumentPage."""
    
    list_display = (
        "short_id",
        "document_short_id",
        "page_number",
        "confidence",
        "created_at",
    )
    list_filter = ('document', 'created_at')
    search_fields = ('document__id', 'raw_text')
    readonly_fields = ('id', 'document', 'page_number', 'created_at', 'raw_text')
    
    def short_id(self, obj):
        return str(obj.id)[:8] + '...'
    short_id.short_description = 'ID'
    
    def document_short_id(self, obj):
        return str(obj.document.id)[:8] + '...'
    document_short_id.short_description = 'Document'


@admin.register(OCRResult)
class OCRResultAdmin(admin.ModelAdmin):
    """Admin interface for OCRResult."""
    
    list_display = ('short_id', 'page_info', 'engine', 'confidence', 'created_at')
    list_filter = ('engine', 'created_at', 'page__document')
    search_fields = ('page__document__id', 'text')
    readonly_fields = (
        "id",
        "page",
        "engine",
        "confidence",
        "text",
        "metadata",
        "created_at",
    )
    
    fieldsets = (
        ('Identity', {
            'fields': ('id', 'page', 'engine')
        }),
        ('Results', {
            'fields': ('text', 'confidence'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def short_id(self, obj):
        return str(obj.id)[:8] + '...'
    short_id.short_description = 'ID'
    
    def page_info(self, obj):
        return f"Doc {str(obj.page.document.id)[:8]}..., Page {obj.page.page_number}"
    page_info.short_description = 'Page'


@admin.register(ExtractedField)
class ExtractedFieldAdmin(admin.ModelAdmin):
    """Admin interface for ExtractedField."""
    
    list_display = (
        "field_name",
        "source_entity_type",
        "confidence",
        "vocabulary_score",
        "document_short_id",
        "created_at",
    )
    list_filter = ('source_entity_type', 'created_at', 'confidence')
    search_fields = ('document__id', 'field_name', 'field_value')
    readonly_fields = (
        "id",
        "document",
        "field_name",
        "field_value",
        "confidence",
        "vocabulary_match_score",
        "created_at",
    )
    
    fieldsets = (
        ('Identity', {
            'fields': ('id', 'document')
        }),
        ('Field', {
            'fields': ('field_name', 'field_value', 'source_entity_type')
        }),
        ('Confidence', {
            'fields': ('confidence', 'vocabulary_match_score')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def vocabulary_score(self, obj):
        """Display vocabulary match score."""
        if obj.vocabulary_match_score is None:
            return '—'
        return f"{obj.vocabulary_match_score:.2f}"
    vocabulary_score.short_description = 'Vocab Match'
    
    def document_short_id(self, obj):
        return str(obj.document.id)[:8] + '...'
    document_short_id.short_description = 'Document'
