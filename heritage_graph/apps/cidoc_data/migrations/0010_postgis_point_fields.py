"""
Migration: add `point` to Location, ArchitecturalStructure, Monument.

Schema changes:
  - Rename coordinates to coordinates_legacy (preserves data).
  - Add point as CharField (matches GIS_AVAILABLE=False; no GDAL import).

Later, a follow-up migration may alter columns to geography PointField on
PostgreSQL + PostGIS when GIS is enabled.

Data migration:
  - Parse coordinates_legacy as lat/lng; store point as "lat, lng" text.
  - Unparseable values are skipped (point stays empty).
"""

from django.db import migrations, models

_POINT_HELP = (
    "Geographic point (longitude, latitude). "
    "Requires GDAL for spatial queries."
)


def _parse_lat_lng(raw: str):
    """Parse legacy coordinate string; return (longitude, latitude) or None."""
    if not raw or not raw.strip():
        return None
    s = raw.strip().replace(",", " ")
    parts = s.split()
    if len(parts) != 2:
        return None
    try:
        lat, lng = float(parts[0]), float(parts[1])
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return None
        return lng, lat
    except (ValueError, TypeError):
        return None


def _populate_points(apps, schema_editor):
    db_alias = schema_editor.connection.alias

    for model_name in ("location", "architecturalstructure", "monument"):
        Model = apps.get_model("cidoc_data", model_name)
        to_update = []
        qs = Model.objects.using(db_alias).exclude(coordinates_legacy="")
        for obj in qs.iterator():
            result = _parse_lat_lng(obj.coordinates_legacy)
            if result is None:
                continue
            lng, lat = result
            obj.point = f"{lat}, {lng}"
            to_update.append(obj)
        if to_update:
            Model.objects.using(db_alias).bulk_update(to_update, ["point"])


def _clear_points(apps, schema_editor):
    """Reverse migration: clear all point values."""
    for model_name in ("location", "architecturalstructure", "monument"):
        Model = apps.get_model("cidoc_data", model_name)
        Model.objects.all().update(point="")


class Migration(migrations.Migration):

    dependencies = [
        ("cidoc_data", "0009_perf_indexes"),
    ]

    operations = [
        migrations.RenameField(
            model_name="location",
            old_name="coordinates",
            new_name="coordinates_legacy",
        ),
        migrations.RenameField(
            model_name="architecturalstructure",
            old_name="coordinates",
            new_name="coordinates_legacy",
        ),
        migrations.RenameField(
            model_name="monument",
            old_name="coordinates",
            new_name="coordinates_legacy",
        ),
        migrations.AddField(
            model_name="location",
            name="point",
            field=models.CharField(
                max_length=50,
                blank=True,
                default="",
                help_text=_POINT_HELP,
            ),
        ),
        migrations.AddField(
            model_name="architecturalstructure",
            name="point",
            field=models.CharField(
                max_length=50,
                blank=True,
                default="",
                help_text=_POINT_HELP,
            ),
        ),
        migrations.AddField(
            model_name="monument",
            name="point",
            field=models.CharField(
                max_length=50,
                blank=True,
                default="",
                help_text=_POINT_HELP,
            ),
        ),
        migrations.RunPython(_populate_points, _clear_points),
    ]
