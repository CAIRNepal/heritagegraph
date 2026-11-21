# Generated manually for specs/005-identity-layer

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cidoc_data", "0005_entityref"),
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EntityCluster",
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
                ("canonical_label", models.CharField(max_length=500)),
                (
                    "type_scope",
                    models.CharField(
                        help_text="Django model name for subjects (e.g. person).",
                        max_length=100,
                    ),
                ),
                ("locked", models.BooleanField(default=False)),
                ("note", models.TextField(blank=True)),
                ("version", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "merged_into",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="merged_from_clusters",
                        to="cidoc_data.entitycluster",
                    ),
                ),
            ],
            options={
                "db_table": "entity_cluster",
            },
        ),
        migrations.AddIndex(
            model_name="entitycluster",
            index=models.Index(
                fields=["type_scope", "locked"], name="entity_clust_type_sc_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="entitycluster",
            index=models.Index(fields=["merged_into"], name="entity_clust_merged__idx"),
        ),
        migrations.CreateModel(
            name="ClusterAuditEvent",
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
                    "action",
                    models.CharField(
                        choices=[
                            ("merge", "Merge clusters"),
                            ("split", "Split cluster"),
                            ("lock", "Lock cluster"),
                            ("unlock", "Unlock cluster"),
                            ("lock_override_merge", "Merge with lock override"),
                        ],
                        max_length=40,
                    ),
                ),
                ("reason", models.TextField(blank=True)),
                ("before_state", models.JSONField(default=dict)),
                ("after_state", models.JSONField(default=dict)),
                ("affected_cluster_ids", models.JSONField(default=list)),
                ("affected_assertion_ids", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cluster_audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "cluster_audit_event",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="IdentityResolutionCandidate",
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
                ("left_object_id", models.PositiveIntegerField()),
                ("right_object_id", models.PositiveIntegerField()),
                ("signal_scores", models.JSONField(blank=True, default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("accepted", "Accepted"),
                            ("rejected", "Rejected"),
                            ("deferred", "Deferred"),
                        ],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "left_content_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="identity_candidates_left",
                        to="contenttypes.contenttype",
                    ),
                ),
                (
                    "resolved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="resolved_identity_candidates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "right_content_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="identity_candidates_right",
                        to="contenttypes.contenttype",
                    ),
                ),
            ],
            options={
                "db_table": "identity_resolution_candidate",
            },
        ),
        migrations.AddIndex(
            model_name="identityresolutioncandidate",
            index=models.Index(
                fields=["status", "created_at"], name="identity_res_status_idx"
            ),
        ),
        migrations.AddField(
            model_name="heritageassertion",
            name="entity_cluster",
            field=models.ForeignKey(
                blank=True,
                help_text="Set for identity.same_referent membership rows",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="membership_assertions",
                to="cidoc_data.entitycluster",
            ),
        ),
        migrations.AddIndex(
            model_name="heritageassertion",
            index=models.Index(
                fields=["asserted_property", "entity_cluster"],
                name="heritage_ass_asserte_idx",
            ),
        ),
    ]
