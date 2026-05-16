# Generated manually for standalone OCR ingestion uploads

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("heritage_data", "0019_knowledge_graph_proposals"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="ingestion_contributor",
            field=models.ForeignKey(
                blank=True,
                help_text="When set, this media file belongs to a standalone OCR ingestion upload (no CE/submission).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="ingestion_media_files",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
