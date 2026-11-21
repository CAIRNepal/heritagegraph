from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cidoc_data", "0008_rename_entity_clust_type_sc_idx_entity_clus_type_sc_22d3e8_idx_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="location",
            index=models.Index(fields=["name"], name="cidoc_location_name_idx"),
        ),
        migrations.AddIndex(
            model_name="location",
            index=models.Index(fields=["type"], name="cidoc_location_type_idx"),
        ),
        migrations.AddIndex(
            model_name="person",
            index=models.Index(fields=["name"], name="cidoc_person_name_idx"),
        ),
        migrations.AddIndex(
            model_name="deity",
            index=models.Index(fields=["name"], name="cidoc_deity_name_idx"),
        ),
        migrations.AddIndex(
            model_name="architecturalstructure",
            index=models.Index(fields=["name"], name="cidoc_structure_name_idx"),
        ),
        migrations.AddIndex(
            model_name="architecturalstructure",
            index=models.Index(fields=["structure_type"], name="cidoc_structure_type_idx"),
        ),
        migrations.AddIndex(
            model_name="heritageassertion",
            index=models.Index(fields=["contributed_by"], name="cidoc_assertion_contrib_idx"),
        ),
        migrations.AddIndex(
            model_name="entitycluster",
            index=models.Index(fields=["canonical_label"], name="cidoc_cluster_label_idx"),
        ),
    ]
