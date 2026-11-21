from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cidoc_data", "0011_knowledge_graph_proposals"),
    ]

    operations = [
        migrations.AddField(
            model_name="heritageassertion",
            name="confidence_score",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                help_text="Numeric confidence from dual-temperature extraction (0.000–1.000)",
                max_digits=4,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="heritageassertion",
            name="attributed_to_agent",
            field=models.CharField(
                blank=True,
                help_text="LLM agent identifier that produced this assertion (e.g. 'ollama/llama3.1:70b')",
                max_length=200,
            ),
        ),
    ]
