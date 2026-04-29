"""
Seed the local on-disk Oxigraph store with schema triples from `final_schema.yaml`.

This is meant for local development and smoke-testing the `/cidoc/sparql/` endpoint
when RDF_ENDPOINT_URL is not configured (pyoxigraph local fallback).
"""

from __future__ import annotations

from pathlib import Path

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Seed local oxigraph_db with schema triples from final_schema.yaml"

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema-path",
            default="final_schema.yaml",
            help="Path to the LinkML-style schema yaml (default: final_schema.yaml)",
        )

    def handle(self, *args, **options):
        try:
            from pyoxigraph import Literal, NamedNode, Quad, Store
        except ImportError as exc:
            raise CommandError(
                "pyoxigraph is not installed. Add it to requirements and reinstall."
            ) from exc

        schema_path = Path(str(options["schema_path"]))
        if not schema_path.exists():
            raise CommandError(f"Schema file not found: {schema_path}")

        schema = yaml.safe_load(schema_path.read_text(encoding="utf-8")) or {}

        prefixes: dict[str, str] = schema.get("prefixes") or {}
        default_prefix = (schema.get("default_prefix") or "").strip()
        if not default_prefix or default_prefix not in prefixes:
            raise CommandError(
                "Schema missing default_prefix or its mapping in prefixes."
            )

        base = prefixes[default_prefix].rstrip("/") + "/"
        xsd = "http://www.w3.org/2001/XMLSchema#"
        rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        rdfs = "http://www.w3.org/2000/01/rdf-schema#"

        def uri(local: str) -> str:
            return f"{base}{local}"

        def range_uri(range_key: str) -> str:
            primitive = range_key.strip()
            if primitive in {"string", "integer", "float", "double", "boolean", "datetime", "date", "uri"}:
                mapped = {
                    "string": "string",
                    "integer": "integer",
                    "float": "float",
                    "double": "double",
                    "boolean": "boolean",
                    "datetime": "dateTime",
                    "date": "date",
                    "uri": "anyURI",
                }[primitive]
                return f"{xsd}{mapped}"
            return uri(primitive)

        store_path = getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db")
        store = Store(store_path)

        classes: dict[str, dict] = schema.get("classes") or {}
        slots: dict[str, dict] = schema.get("slots") or {}

        inserted = 0

        for class_name, class_data in classes.items():
            store.add(
                Quad(
                    NamedNode(uri(class_name)),
                    NamedNode(f"{rdf}type"),
                    NamedNode(f"{rdfs}Class"),
                    None,
                )
            )
            inserted += 1

            for slot_key in (class_data or {}).get("slots") or []:
                slot_key = str(slot_key)
                slot_def = slots.get(slot_key) or {}
                range_key = str(slot_def.get("range") or "").strip()
                if not range_key:
                    continue
                store.add(
                    Quad(
                        NamedNode(uri(class_name)),
                        NamedNode(uri(slot_key)),
                        NamedNode(range_uri(range_key)),
                        None,
                    )
                )
                inserted += 1

        # Minimal dataset metadata for debugging
        dataset_node = NamedNode(uri("dataset"))
        store.add(Quad(dataset_node, NamedNode(f"{rdf}type"), NamedNode(uri("Dataset")), None))
        store.add(
            Quad(
                dataset_node,
                NamedNode(uri("dataset_name")),
                Literal(str(schema.get("name") or schema.get("id") or "HeritageGraph")),
                None,
            )
        )
        inserted += 2

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded local Oxigraph store at {store_path!r} with ~{inserted} quads."
            )
        )

