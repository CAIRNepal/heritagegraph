from django.db import migrations, models


class Migration(migrations.Migration):
    """Add multi-calendar TimeSpan fields to HeritageAssertion (Phase 3)."""

    dependencies = [
        ("cidoc_data", "0019_datasource_datacite_care_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="heritageassertion",
            name="calendar_system",
            field=models.CharField(
                blank=True,
                choices=[
                    ("gregorian", "Gregorian"),
                    ("bikram_sambat", "Bikram Sambat"),
                    ("nepal_sambat", "Nepal Sambat"),
                ],
                default="gregorian",
                help_text="Calendar system for date-type assertions (Gregorian, BS, NS)",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="heritageassertion",
            name="date_precision",
            field=models.CharField(
                blank=True,
                choices=[
                    ("exact_year", "Exact Year"),
                    ("circa", "Circa"),
                    ("decade", "Decade"),
                    ("century", "Century"),
                ],
                default="exact_year",
                help_text="Temporal precision for date-type assertions",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="heritageassertion",
            index=models.Index(
                fields=["calendar_system"],
                name="assertion_calendar_idx",
            ),
        ),
    ]
