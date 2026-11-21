import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("heritage_data", "0029_mergerequest"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReconciledLink",
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
                ("entity_uri", models.URLField(db_index=True, max_length=1024)),
                (
                    "match_type",
                    models.CharField(
                        choices=[
                            ("exact", "skos:exactMatch"),
                            ("close", "skos:closeMatch"),
                            ("broad", "skos:broadMatch"),
                        ],
                        default="exact",
                        max_length=10,
                    ),
                ),
                ("target_uri", models.URLField(max_length=1024)),
                ("target_label", models.CharField(blank=True, max_length=512)),
                (
                    "authority",
                    models.CharField(
                        blank=True,
                        help_text="e.g. aat, wd, tgn, lcsh",
                        max_length=64,
                    ),
                ),
                ("is_stale", models.BooleanField(db_index=True, default=False)),
                ("last_verified", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "reconciled_link",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="reconciledlink",
            constraint=models.UniqueConstraint(
                fields=["entity_uri", "target_uri", "match_type"],
                name="unique_entity_target_match",
            ),
        ),
        migrations.AddIndex(
            model_name="reconciledlink",
            index=models.Index(
                fields=["entity_uri"],
                name="reconciled_link_entity_uri_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="reconciledlink",
            index=models.Index(
                fields=["is_stale"],
                name="reconciled_link_is_stale_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="reconciledlink",
            index=models.Index(
                fields=["authority"],
                name="reconciled_link_authority_idx",
            ),
        ),
        migrations.CreateModel(
            name="CuratorAlert",
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
                    "issue_type",
                    models.CharField(
                        choices=[
                            ("stale_link", "Stale Link (404 / merged)"),
                            ("label_drift", "Label Drift"),
                            ("supersession", "Assertion Superseded"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("resolved", "Resolved"),
                            ("ignored", "Ignored"),
                        ],
                        default="open",
                        max_length=12,
                    ),
                ),
                (
                    "detail",
                    models.TextField(
                        blank=True,
                        help_text="Human-readable description of the issue",
                    ),
                ),
                ("detected_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("suggested_replacement_uri", models.URLField(blank=True, max_length=1024)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "reconciled_link",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alerts",
                        to="heritage_data.reconciledlink",
                    ),
                ),
                (
                    "resolved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="resolved_curator_alerts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "curator_alert",
                "ordering": ["-detected_at"],
            },
        ),
        migrations.AddIndex(
            model_name="curatoralert",
            index=models.Index(
                fields=["status"],
                name="curator_alert_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="curatoralert",
            index=models.Index(
                fields=["issue_type"],
                name="curator_alert_issue_type_idx",
            ),
        ),
    ]
