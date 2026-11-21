# Generated manually

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("heritage_data", "0014_media_cultural_entity_alter_media_submission"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReviewerApplication",
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
                    "message",
                    models.TextField(
                        blank=True,
                        help_text="Optional note from the applicant (background, interest, etc.)",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "admin_notes",
                    models.TextField(
                        blank=True, help_text="Internal notes (visible only in admin)"
                    ),
                ),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_reviewer_applications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviewer_applications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "reviewer_applications",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="reviewerapplication",
            index=models.Index(
                fields=["user", "created_at"], name="revapp_user_created_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="reviewerapplication",
            index=models.Index(
                fields=["status", "created_at"], name="revapp_status_created_idx"
            ),
        ),
    ]
