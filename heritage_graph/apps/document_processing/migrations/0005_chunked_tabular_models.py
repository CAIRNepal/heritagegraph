# Generated manually — ChunkedMediaUpload + TabularImportJob

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("document_processing", "0004_uploadeddocument_ingestion_review_and_progress"),
    ]

    operations = [
        migrations.CreateModel(
            name="ChunkedMediaUpload",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("original_filename", models.CharField(max_length=512)),
                ("expected_bytes", models.PositiveBigIntegerField()),
                ("bytes_written", models.PositiveBigIntegerField(default=0)),
                ("relative_temp_path", models.CharField(blank=True, max_length=1024)),
                ("provenance", models.JSONField(blank=True, default=dict)),
                ("media_type", models.CharField(default="image", max_length=32)),
                ("description", models.CharField(blank=True, max_length=2048)),
                ("standalone_ingestion", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "contributor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chunked_media_uploads",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "document_processing_chunked_media_upload",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="TabularImportJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("ready_review", "Ready for review"), ("failed", "Failed")], default="pending", max_length=32)),
                ("source_filename", models.CharField(blank=True, max_length=512)),
                ("provenance", models.JSONField(blank=True, default=dict)),
                ("column_mapping", models.JSONField(blank=True, default=dict, help_text="Maps source column header -> registry field key or role label")),
                ("staged_rows", models.JSONField(blank=True, default=list)),
                ("row_review_state", models.JSONField(blank=True, default=dict, help_text="Per-row reconciliation: row_index -> { decisions... }")),
                ("validation_errors", models.JSONField(blank=True, default=list)),
                ("user_safe_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "contributor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tabular_import_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "document_processing_tabular_import_job",
                "ordering": ["-created_at"],
            },
        ),
    ]
