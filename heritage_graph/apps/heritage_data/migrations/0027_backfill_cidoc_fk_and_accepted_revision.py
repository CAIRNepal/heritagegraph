"""Backfill the new pipeline pointers from legacy state.

1. ``cidoc_content_type``/``cidoc_object_id`` from the newest revision's
   ``_cidoc_model``/``_cidoc_id`` JSON back-link (Phase 3a: real FK replaces
   the string-keyed link).
2. ``accepted_revision`` for already-accepted entities: the revision the
   reviewer accepted is the one ``current_revision`` pointed at (or, failing
   that, the newest revision) — Phase 0: head of the accepted lineage.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    CulturalEntity = apps.get_model("heritage_data", "CulturalEntity")
    ContentType = apps.get_model("contenttypes", "ContentType")

    ct_cache = {}

    def content_type_for(model_name):
        key = model_name.lower()
        if key not in ct_cache:
            ct_cache[key] = ContentType.objects.filter(
                app_label="cidoc_data", model=key
            ).first()
        return ct_cache[key]

    for entity in CulturalEntity.objects.all().iterator():
        update_fields = []

        if entity.cidoc_content_type_id is None or entity.cidoc_object_id is None:
            rev = (
                entity.revisions.order_by("-revision_number")
                .only("data")
                .first()
            )
            data = rev.data if rev is not None and isinstance(rev.data, dict) else {}
            model_name = (data.get("_cidoc_model") or "").strip()
            cidoc_id = data.get("_cidoc_id")
            if model_name and cidoc_id is not None:
                ct = content_type_for(model_name)
                if ct is not None:
                    entity.cidoc_content_type = ct
                    entity.cidoc_object_id = cidoc_id
                    update_fields += ["cidoc_content_type", "cidoc_object_id"]

        if entity.accepted_revision_id is None and entity.status == "accepted":
            target = entity.current_revision_id or (
                entity.revisions.order_by("-revision_number")
                .values_list("pk", flat=True)
                .first()
            )
            if target is not None:
                entity.accepted_revision_id = target
                update_fields.append("accepted_revision")

        if update_fields:
            entity.save(update_fields=update_fields)


class Migration(migrations.Migration):
    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        ("heritage_data", "0026_culturalentity_accepted_revision_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
