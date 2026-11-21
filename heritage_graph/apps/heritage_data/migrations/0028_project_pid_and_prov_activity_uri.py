from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("heritage_data", "0027_backfill_cidoc_fk_and_accepted_revision"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="license",
            field=models.CharField(
                choices=[
                    ("CC-BY-4.0", "CC BY 4.0"),
                    ("CC-BY-SA-4.0", "CC BY-SA 4.0"),
                    ("CC-BY-NC-4.0", "CC BY-NC 4.0"),
                    ("CC0-1.0", "CC0 1.0 Public Domain"),
                    ("ODbL-1.0", "Open Database License 1.0"),
                ],
                default="CC-BY-4.0",
                help_text="Data license; propagates to DCAT metadata on merge.",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="pid",
            field=models.URLField(
                blank=True,
                max_length=300,
                help_text="Persistent identifier minted at creation: {RDF_RESOURCE_BASE_URI}/project/{uuid}",
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="prov_activity_uri",
            field=models.URLField(
                blank=True,
                max_length=300,
                help_text="PROV-O activity IRI for the project creation event",
            ),
        ),
    ]
