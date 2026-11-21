# Generated manually for HeritageGraph

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("heritage_data", "0004_add_public_contribution"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReviewerRoleRequest",
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
                    "requested_role",
                    models.CharField(
                        choices=[
                            ("community_reviewer", "Community Reviewer"),
                            ("domain_expert", "Domain Expert"),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    "message",
                    models.TextField(
                        blank=True,
                        help_text="Optional: relevant experience, languages, or domains of interest.",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                            ("withdrawn", "Withdrawn"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "admin_note",
                    models.TextField(
                        blank=True,
                        help_text="Internal notes (not shown to the requester).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_reviewer_role_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviewer_role_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Reviewer role request",
                "verbose_name_plural": "Reviewer role requests",
                "db_table": "reviewer_role_requests",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="reviewerrolerequest",
            constraint=models.UniqueConstraint(
                condition=models.Q(status="pending"),
                fields=("user",),
                name="reviewer_role_request_one_pending_per_user",
            ),
        ),
    ]
