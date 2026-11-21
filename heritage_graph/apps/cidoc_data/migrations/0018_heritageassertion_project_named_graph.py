import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cidoc_data", "0017_alter_architecturalstructure_existence_status_and_more"),
        ("heritage_data", "0028_project_pid_and_prov_activity_uri"),
    ]

    operations = [
        migrations.AddField(
            model_name="heritageassertion",
            name="project",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Authoring project scope. When set, triples write to the project named "
                    "graph (hg:project/{uuid}/graph) rather than the main PUBLIC graph."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assertions",
                to="heritage_data.project",
            ),
        ),
        migrations.AddField(
            model_name="heritageassertion",
            name="named_graph",
            field=models.URLField(
                blank=True,
                max_length=300,
                help_text=(
                    "Override named graph IRI. Auto-derived from project FK if blank; "
                    "set explicitly for assertions that belong to a specific sub-graph."
                ),
            ),
        ),
    ]
