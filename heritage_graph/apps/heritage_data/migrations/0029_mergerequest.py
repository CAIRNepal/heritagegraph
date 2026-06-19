import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Add MergeRequest model (Phase 7 — merge request lifecycle)."""

    dependencies = [
        ("heritage_data", "0028_project_pid_and_prov_activity_uri"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MergeRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("changes_requested", "Changes Requested"),
                            ("approved", "Approved"),
                            ("merged", "Merged"),
                            ("rejected", "Rejected"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "scope",
                    models.CharField(
                        choices=[
                            ("whole", "Whole project graph"),
                            ("subset", "Selected entities only"),
                        ],
                        default="whole",
                        max_length=10,
                    ),
                ),
                ("summary", models.TextField(help_text="Human-readable description of what this contribution adds.")),
                ("justification", models.TextField(blank=True, help_text="Justification for any conflicts or overrides.")),
                ("reviewer_note", models.TextField(blank=True, help_text="Reviewer feedback.")),
                ("shacl_report", models.JSONField(blank=True, default=dict, help_text="Cached SHACL validation report.")),
                ("conflict_diff", models.JSONField(blank=True, default=dict, help_text="Computed diff summary.")),
                ("pid_collisions", models.JSONField(blank=True, default=list, help_text="PID IRIs colliding with main graph.")),
                ("merge_activity_uri", models.URLField(blank=True, max_length=300)),
                ("new_pids", models.JSONField(blank=True, default=list)),
                ("opened_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("merged_at", models.DateTimeField(blank=True, null=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="merge_requests",
                        to="heritage_data.project",
                    ),
                ),
                (
                    "opened_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="opened_merge_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_merge_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "merge_requests",
                "ordering": ["-opened_at"],
            },
        ),
        migrations.AddIndex(
            model_name="mergerequest",
            index=models.Index(fields=["project", "status"], name="mr_project_status_idx"),
        ),
        migrations.AddIndex(
            model_name="mergerequest",
            index=models.Index(fields=["opened_by"], name="mr_opened_by_idx"),
        ),
        migrations.AddIndex(
            model_name="mergerequest",
            index=models.Index(fields=["status"], name="mr_status_idx"),
        ),
    ]
