import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="RDFSyncOutbox",
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
                ("subject_uri", models.CharField(blank=True, db_index=True, max_length=512)),
                (
                    "operation",
                    models.CharField(
                        choices=[
                            ("replace_slot", "Replace managed slot projection"),
                            ("delete_subject", "Delete subject from graph"),
                            ("insert_nt", "Insert N-Triples block"),
                        ],
                        max_length=32,
                    ),
                ),
                ("graph_uri", models.CharField(blank=True, max_length=512)),
                ("payload", models.JSONField(default=dict)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("last_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "graph_rdf_sync_outbox",
                "ordering": ["created_at"],
                "indexes": [
                    models.Index(
                        fields=["processed_at", "created_at"],
                        name="graph_rdf_s_process_0a1b2c_idx",
                    ),
                ],
            },
        ),
    ]
