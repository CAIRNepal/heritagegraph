# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("document_processing", "0002_uploadeddocument_claude_vision_invocations_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="uploadeddocument",
            name="provenance",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Structured provenance from uploader (source institution, collection, languages, etc.)",
            ),
        ),
    ]
