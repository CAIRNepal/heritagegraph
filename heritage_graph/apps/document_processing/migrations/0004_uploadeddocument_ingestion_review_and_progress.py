# Generated manually for supervised ingestion plan

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("document_processing", "0003_uploadeddocument_provenance"),
    ]

    operations = [
        migrations.AddField(
            model_name="uploadeddocument",
            name="ingestion_review_state",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Contributor OCR/semantic review draft: field_decisions, block_corrections, ontology_handoff_key",
            ),
        ),
        migrations.AddField(
            model_name="uploadeddocument",
            name="processing_progress",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Latest pipeline progress for SSE/UI: status, page, engine, message, percent",
            ),
        ),
    ]
