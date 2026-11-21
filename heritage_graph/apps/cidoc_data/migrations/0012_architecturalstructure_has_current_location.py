"""Add has_current_location FK on ArchitecturalStructure (nested form pilot)."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cidoc_data", "0011_knowledge_graph_proposals"),
    ]

    operations = [
        migrations.AddField(
            model_name="architecturalstructure",
            name="has_current_location",
            field=models.ForeignKey(
                blank=True,
                help_text="Current place / location (registry: has_current_location / crm:P55)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="structures_here",
                to="cidoc_data.location",
            ),
        ),
    ]
