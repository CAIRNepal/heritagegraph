"""
Batch Wikidata / GeoNames link suggestions for curated CIDOC entities.

Outputs JSON (stdout or --output) for human review. Does NOT auto-write
``skos:exactMatch`` — reviewers accept matches via EntityCluster.external_identifiers
or the identity workspace API.

Usage:
  python manage.py kg_suggest_external_links --limit 50
  python manage.py kg_suggest_external_links --output suggestions.json
"""

from __future__ import annotations

import json

from django.apps import apps as django_apps
from django.core.management.base import BaseCommand

from apps.cidoc_data.models import MetaData
from apps.graph.kg_engine.uris import resource_uri_for_instance
from apps.graph.reconciliation.service import suggest_for_cluster


def _label_for(obj) -> str:
    for attr in ("name", "title"):
        val = getattr(obj, attr, None)
        if val and str(val).strip():
            return str(val).strip()
    return ""


def _type_scope_for(model) -> str:
    name = model.__name__.lower()
    if name in {"location", "architecturalstructure", "monument"}:
        return "location"
    if name in {"person", "deity"}:
        return "person"
    return name


class Command(BaseCommand):
    help = "Suggest Wikidata/GeoNames alignments for curated entities (review-only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Max entities to process (default 100).",
        )
        parser.add_argument(
            "--output",
            default="",
            help="Write JSON array to this path (default: stdout).",
        )
        parser.add_argument(
            "--status",
            default="",
            help="Optional MetaData.status filter (e.g. accepted, pending_review).",
        )

    def handle(self, *args, **options):
        limit = max(1, int(options["limit"]))
        status_filter = (options.get("status") or "").strip()
        results: list[dict] = []

        cfg = django_apps.get_app_config("cidoc_data")
        for model in cfg.get_models():
            if not issubclass(model, MetaData) or model is MetaData or model._meta.abstract:
                continue
            qs = model.objects.all().order_by("id")
            if status_filter:
                qs = qs.filter(status=status_filter)
            for obj in qs.iterator():
                if len(results) >= limit:
                    break
                label = _label_for(obj)
                if not label:
                    continue
                suggestions = suggest_for_cluster(
                    canonical_label=label,
                    type_scope=_type_scope_for(model),
                    limit=5,
                )
                if not suggestions:
                    continue
                results.append(
                    {
                        "resource_uri": resource_uri_for_instance(obj),
                        "model": model.__name__,
                        "pk": obj.pk,
                        "label": label,
                        "status": getattr(obj, "status", None),
                        "top_suggestion": suggestions[0],
                        "suggestions": suggestions,
                    }
                )
            if len(results) >= limit:
                break

        payload = {
            "count": len(results),
            "entities": results,
        }
        text = json.dumps(payload, indent=2)
        out_path = (options.get("output") or "").strip()
        if out_path:
            with open(out_path, "w", encoding="utf-8") as fh:
                fh.write(text)
            self.stdout.write(self.style.SUCCESS(f"Wrote {len(results)} suggestions to {out_path}"))
        else:
            self.stdout.write(text)
