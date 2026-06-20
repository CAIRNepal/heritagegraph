"""Management command: regenerate ontology/lod/void-dataset.ttl with live Oxigraph counts."""

from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Regenerate ontology/lod/void-dataset.ttl with live triple counts from Oxigraph. "
        "Acceptance: void:triples matches actual Oxigraph count; dcat:version increments."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default="",
            help="Override output path (default: <repo-root>/ontology/lod/void-dataset.ttl)",
        )

    def handle(self, *args, **options):
        from django.conf import settings

        from apps.graph.kg_engine.void_generator import generate_void_dcat

        self.stdout.write("Querying Oxigraph for live triple counts…")
        ttl = generate_void_dcat()

        output_arg = options.get("output", "").strip()
        if output_arg:
            output_path = Path(output_arg)
        else:
            output_path = Path(settings.BASE_DIR).parent / "ontology" / "lod" / "void-dataset.ttl"

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(ttl, encoding="utf-8")

        for line in ttl.splitlines():
            if "void:triples" in line or "dcterms:issued" in line:
                self.stdout.write(f"  {line.strip()}")

        self.stdout.write(self.style.SUCCESS(f"VoID dataset written → {output_path}"))
