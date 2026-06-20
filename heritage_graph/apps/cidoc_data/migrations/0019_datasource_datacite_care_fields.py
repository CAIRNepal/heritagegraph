import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cidoc_data", "0018_heritageassertion_project_named_graph"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Extend source_type choices (field label updates only — no DB change)
        migrations.AlterField(
            model_name="datasource",
            name="source_type",
            field=models.CharField(
                choices=[
                    ("archival", "Archival Record"),
                    ("field_survey", "Field Survey Dataset"),
                    ("oral_history", "Oral History Recording"),
                    ("image", "Image Dataset"),
                    ("pdf", "PDF Document"),
                    ("published", "Published Source"),
                    ("inscription", "Inscription"),
                    ("web", "Web Resource"),
                ],
                help_text="Category of this source",
                max_length=30,
            ),
        ),
        # File upload
        migrations.AddField(
            model_name="datasource",
            name="uploaded_file",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="sources/%Y/%m/",
                help_text="Uploaded file (image, PDF, audio, CSV, etc.)",
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="ingest_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("processing", "Processing"),
                    ("ready", "Ready"),
                    ("failed", "Failed"),
                ],
                default="pending",
                help_text="Processing status of the uploaded file",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="contributed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="contributed_data_sources",
                to=settings.AUTH_USER_MODEL,
                help_text="User who uploaded this source",
            ),
        ),
        # IIIF manifest (inline JSON)
        migrations.AddField(
            model_name="datasource",
            name="iiif_manifest",
            field=models.JSONField(
                blank=True,
                null=True,
                help_text="Inline IIIF Presentation v3 manifest",
            ),
        ),
        # DataCite fields
        migrations.AddField(
            model_name="datasource",
            name="datacite_identifier",
            field=models.CharField(
                blank=True,
                max_length=300,
                help_text="DataCite DOI or persistent identifier",
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="datacite_creator",
            field=models.CharField(
                blank=True,
                max_length=300,
                help_text="DataCite creator / author name",
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="datacite_publisher",
            field=models.CharField(
                blank=True,
                default="CAIR-Nepal",
                max_length=200,
                help_text="DataCite publisher organization",
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="datacite_publication_year",
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                help_text="DataCite publication year",
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="datacite_resource_type",
            field=models.CharField(
                choices=[
                    ("Dataset", "Dataset"),
                    ("Image", "Image"),
                    ("Sound", "Sound"),
                    ("Text", "Text"),
                    ("PhysicalObject", "Physical Object"),
                    ("Collection", "Collection"),
                    ("Software", "Software"),
                ],
                default="Dataset",
                max_length=30,
                help_text="DataCite resource type",
            ),
        ),
        # CARE / TK labels
        migrations.AddField(
            model_name="datasource",
            name="access_tier",
            field=models.CharField(
                choices=[
                    ("public", "Public — no restrictions"),
                    ("org_only", "Organization only"),
                    ("community_only", "Community only"),
                    ("sensitive_indigenous", "Sensitive / indigenous knowledge"),
                ],
                default="public",
                max_length=30,
                help_text="Access control tier",
            ),
        ),
        migrations.AddField(
            model_name="datasource",
            name="care_labels",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="TK Label URIs (https://localcontexts.org/labels/…)",
            ),
        ),
        # PID
        migrations.AddField(
            model_name="datasource",
            name="pid",
            field=models.URLField(
                blank=True,
                max_length=300,
                help_text="HeritageGraph PID for this source",
            ),
        ),
        # updated_at
        migrations.AddField(
            model_name="datasource",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        # Indexes
        migrations.AddIndex(
            model_name="datasource",
            index=models.Index(fields=["source_type"], name="datasource_type_idx"),
        ),
        migrations.AddIndex(
            model_name="datasource",
            index=models.Index(fields=["access_tier"], name="datasource_tier_idx"),
        ),
        migrations.AddIndex(
            model_name="datasource",
            index=models.Index(
                fields=["ingest_status"], name="datasource_ingest_idx"
            ),
        ),
    ]
