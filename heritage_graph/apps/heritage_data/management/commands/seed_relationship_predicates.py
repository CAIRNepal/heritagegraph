"""Seed RelationshipPredicate vocabulary from the ontology's object properties.

Ontology-driven: every slot in ``ontology/HeritageGraph.yaml`` whose ``range`` is a
defined class is an entity→entity relationship, and becomes a selectable predicate
in the relationship-proposal form. Display labels come from ``tools/ui-vizmap.yaml``
``viz_predicates`` when present, otherwise a humanised slot name. Idempotent
(``update_or_create`` by ``code``); ``--prune`` deactivates predicates that are no
longer object properties in the ontology.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from apps.cidoc_data.models import RelationshipPredicate
from django.conf import settings
from django.core.management.base import BaseCommand


def _ontology_object_properties() -> list[tuple[str, str, str]]:
    """Return (code, label, description) for every entity-range slot in the schema."""
    root = Path(settings.BASE_DIR).parent
    schema = yaml.safe_load(
        (root / "ontology" / "HeritageGraph.yaml").read_text(encoding="utf-8")
    )
    classes = set(schema.get("classes", {}) or {})
    slots = schema.get("slots", {}) or {}

    viz_path = root / "tools" / "ui-vizmap.yaml"
    labels: dict[str, str] = {}
    if viz_path.is_file():
        viz = yaml.safe_load(viz_path.read_text(encoding="utf-8")) or {}
        for p in viz.get("viz_predicates", []) or []:
            if isinstance(p, dict) and p.get("slot") and p.get("label"):
                labels[p["slot"]] = p["label"]

    out: list[tuple[str, str, str]] = []
    for name, slot in slots.items():
        if not isinstance(slot, dict) or slot.get("range") not in classes:
            continue  # only object properties (range is a class) are relationships
        label = labels.get(name) or name.replace("_", " ").strip().title()
        desc = slot.get("description") or f"{label} (relationship to {slot['range']})."
        out.append((name, label, desc))
    return out


class Command(BaseCommand):
    help = "Seed the RelationshipPredicate vocabulary from the ontology object properties."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prune",
            action="store_true",
            help="Deactivate predicates whose code is no longer an ontology object property.",
        )

    def handle(self, *args, **options):
        predicates = _ontology_object_properties()
        if not predicates:
            self.stderr.write(
                self.style.ERROR("No object properties found in the ontology — aborting.")
            )
            return

        seen: set[str] = set()
        for order, (code, label, description) in enumerate(sorted(predicates), start=1):
            RelationshipPredicate.objects.update_or_create(
                code=code,
                defaults={
                    "label": label,
                    "description": description,
                    "sort_order": order * 10,
                    "active": True,
                },
            )
            seen.add(code)

        pruned = 0
        if options["prune"]:
            pruned = (
                RelationshipPredicate.objects.exclude(code__in=seen)
                .filter(active=True)
                .update(active=False)
            )

        msg = f"Seeded {len(seen)} relationship predicates from the ontology."
        if options["prune"]:
            msg += f" Deactivated {pruned} stale (non-ontology) predicate(s)."
        self.stdout.write(self.style.SUCCESS(msg))
