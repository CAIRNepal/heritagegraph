# Generated manually for project asset versioning + merge snapshots.

import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("heritage_data", "0023_project_ocr_deferred"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectasset",
            name="version_label",
            field=models.CharField(
                blank=True,
                default="",
                max_length=120,
                help_text="Contributor label for this revision (v2, revised-2026, …).",
            ),
        ),
        migrations.AddField(
            model_name="projectasset",
            name="entity_suggestions",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Suggested ontology links from OCR / NER (populated asynchronously).",
            ),
        ),
        migrations.CreateModel(
            name="ProjectSnapshot",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "snapshot",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text=(
                            "Serialized pointers (entity ids, title, slug) at merge time."
                        ),
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "merged_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="project_snapshots_recorded",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="snapshots",
                        to="heritage_data.project",
                    ),
                ),
            ],
            options={
                "db_table": "project_snapshots",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="projectsnapshot",
            index=models.Index(
                fields=["project", "created_at"],
                name="project_snap_project_8947d9_idx",
            ),
        ),
    ]
