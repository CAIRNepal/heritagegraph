# Manual migration: 004-yaml-driven-schema (Tenant, SchemaRegistry, DynamicOntologyEntity)

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cidoc_data", "0003_alter_kumariretirement_table_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Tenant",
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
                ("slug", models.SlugField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "cidoc_tenant",
                "verbose_name_plural": "Tenants",
            },
        ),
        migrations.CreateModel(
            name="SchemaRegistry",
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
                ("schema_version", models.CharField(db_index=True, max_length=64)),
                ("core_hash", models.CharField(blank=True, max_length=64)),
                ("extension_hash", models.CharField(blank=True, max_length=64, null=True)),
                ("registry_json", models.JSONField()),
                ("jsonschema_blob", models.JSONField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="schema_rows",
                        to="cidoc_data.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "cidoc_schema_registry",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="DynamicOntologyEntity",
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
                ("class_key", models.CharField(db_index=True, max_length=100)),
                ("class_uri", models.CharField(blank=True, max_length=500)),
                ("uri", models.CharField(max_length=500)),
                ("data", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dynamic_entities",
                        to="cidoc_data.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "cidoc_dynamic_ontology_entity",
            },
        ),
        migrations.AddConstraint(
            model_name="dynamicontologyentity",
            constraint=models.UniqueConstraint(
                fields=("tenant", "uri"),
                name="cidoc_dynamic_entity_tenant_uri_uniq",
            ),
        ),
    ]
