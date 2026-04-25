"""
Migration: add PostGIS PointField to Location, ArchitecturalStructure, Monument.

Schema changes:
  - Rename 'coordinates' → 'coordinates_legacy' on all three models (preserves data)
  - Add 'point' PointField (geography=True, srid=4326, null=True) to all three models

Data migration (forward only):
  - Parse 'coordinates_legacy' values in "lat, lng" or "lat lng" format and populate 'point'.
  - Values that cannot be parsed are silently skipped (point stays NULL).

Prerequisites:
  - PostgreSQL with PostGIS extension: CREATE EXTENSION IF NOT EXISTS postgis;
  - GDAL and GEOS system libraries installed on the server.
"""

from django.contrib.gis.geos import Point
from django.db import migrations


def _parse_lat_lng(raw: str):
    """Return (longitude, latitude) floats from 'lat, lng' or 'lat lng' string, or None."""
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
    db_vendor = schema_editor.connection.vendor
    if db_vendor != "postgresql":
        return

    for model_name in ("location", "architecturalstructure", "monument"):
        Model = apps.get_model("cidoc_data", model_name)
        to_update = []
        for obj in Model.objects.using(db_alias).exclude(coordinates_legacy="").iterator():
            result = _parse_lat_lng(obj.coordinates_legacy)
            if result is None:
                continue
            obj.point = Point(*result, srid=4326)
            to_update.append(obj)
        if to_update:
            Model.objects.using(db_alias).bulk_update(to_update, ["point"])


def _clear_points(apps, schema_editor):
    """Reverse migration: clear all point values."""
    for model_name in ("location", "architecturalstructure", "monument"):
        Model = apps.get_model("cidoc_data", model_name)
        Model.objects.all().update(point=None)


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
            field=__import__("django.contrib.gis.db", fromlist=["models"]).models.PointField(
                geography=True,
                srid=4326,
                null=True,
                blank=True,
                help_text="Geographic point (longitude, latitude) — WGS84",
            ),
        ),
        migrations.AddField(
            model_name="architecturalstructure",
            name="point",
            field=__import__("django.contrib.gis.db", fromlist=["models"]).models.PointField(
                geography=True,
                srid=4326,
                null=True,
                blank=True,
                help_text="Geographic point (longitude, latitude) — WGS84",
            ),
        ),
        migrations.AddField(
            model_name="monument",
            name="point",
            field=__import__("django.contrib.gis.db", fromlist=["models"]).models.PointField(
                geography=True,
                srid=4326,
                null=True,
                blank=True,
                help_text="Geographic point (longitude, latitude) — WGS84",
            ),
        ),
        migrations.RunPython(_populate_points, _clear_points),
    ]
