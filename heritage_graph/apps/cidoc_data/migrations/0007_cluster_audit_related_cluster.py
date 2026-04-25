import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cidoc_data", "0006_identity_layer"),
    ]

    operations = [
        migrations.AddField(
            model_name="clusterauditevent",
            name="related_cluster",
            field=models.ForeignKey(
                blank=True,
                help_text="Primary cluster this audit row is anchored to (for list filtering).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="audit_events",
                to="cidoc_data.entitycluster",
            ),
        ),
    ]
