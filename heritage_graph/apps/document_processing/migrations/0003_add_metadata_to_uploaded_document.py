from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("document_processing", "0002_uploadeddocument_claude_vision_invocations_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="uploadeddocument",
            name="metadata",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Agent pipeline metadata (heritage_doc_type, detected_language, chunk_count, etc.)",
            ),
        ),
    ]
