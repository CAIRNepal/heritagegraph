"""Backfill NULL MetaData.status to published (curated reviewed corpus)."""

from __future__ import annotations

from django.db import migrations


def backfill_pending_review(apps, schema_editor):
    app_config = apps.get_app_config("cidoc_data")
    for model in app_config.get_models():
        if model._meta.abstract:
            continue
        field_names = {f.name for f in model._meta.get_fields()}
        if "status" not in field_names:
            continue
        model.objects.filter(status__isnull=True).update(status="published")
        model.objects.filter(status="").update(status="published")


class Migration(migrations.Migration):
    dependencies = [
        ("cidoc_data", "0015_phase1_phase2_lod_provenance"),
    ]

    operations = [
        migrations.RunPython(backfill_pending_review, migrations.RunPython.noop),
    ]
