"""
End-to-end validation: frontend-style API ingest → Postgres → Oxigraph → graph/atlas visibility.

Usage:
    cd heritage_graph
    DJANGO_ENV=development python manage.py validate_contribution_pipeline
    DJANGO_ENV=development python manage.py validate_contribution_pipeline --json
"""

from __future__ import annotations

import json
import tempfile
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.test.utils import override_settings
from rest_framework.test import APIClient

from apps.cidoc_data.linkml_loader import get_effective_registry_payload
from apps.cidoc_data.models import ArchitecturalStructure, Location, Person
from apps.cidoc_data.rdf_entity_projection import (
    RDF_TYPE_URI,
    expand_curie,
    tripleset_for_metadata_instance,
)
from apps.cidoc_data.rdf_signals import _resource_uri, rdf_sync_enabled
from apps.heritage_data.models import CulturalEntity


@dataclass
class StepResult:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class PipelineReport:
    passed: bool = True
    steps: list[StepResult] = field(default_factory=list)
    markers: dict[str, str] = field(default_factory=dict)

    def add(self, name: str, ok: bool, detail: str = "") -> None:
        self.steps.append(StepResult(name=name, ok=ok, detail=detail))
        if not ok:
            self.passed = False


def _registry_field(class_key: str, field_key: str) -> dict:
    payload = get_effective_registry_payload()
    cls = (payload.get("classes") or {}).get(class_key) or {}
    for f in cls.get("fields") or []:
        if f.get("key") == field_key:
            return f
    raise KeyError(f"{class_key}.{field_key}")


def _simulate_instance_graph_nodes(api_lists: dict[str, list]) -> tuple[list[str], int]:
    """Mirror instance-graph.ts node id convention: {category}_{pk}."""
    node_ids: list[str] = []
    spatial = 0
    for category, rows in api_lists.items():
        for row in rows:
            pk = row.get("id")
            if pk is None:
                continue
            nid = f"{category}_{pk}"
            node_ids.append(nid)
            lat, lon = row.get("latitude"), row.get("longitude")
            if lat is not None and lon is not None:
                spatial += 1
    return node_ids, spatial


def _simulate_atlas_hydrate(api_lists: dict[str, list]) -> tuple[int, int]:
    """Mirror atlas-api-hydrate extractCoords + nodeToEntity."""
    entities = 0
    spatial = 0
    for rows in api_lists.values():
        for row in rows:
            entities += 1
            lat, lon = row.get("latitude"), row.get("longitude")
            if lat is not None and lon is not None:
                try:
                    if abs(float(lat)) <= 90 and abs(float(lon)) <= 180:
                        spatial += 1
                except (TypeError, ValueError):
                    pass
    return entities, spatial


class Command(BaseCommand):
    help = "Validate frontend ingest → Postgres → Oxigraph → graph/atlas visibility."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json",
            action="store_true",
            help="Emit machine-readable JSON report on stdout",
        )
        parser.add_argument(
            "--keep-data",
            action="store_true",
            help="Do not delete seeded rows (for manual UI inspection)",
        )

    def handle(self, *args, **options):
        report = PipelineReport()
        marker = uuid.uuid4().hex[:8]
        report.markers["marker"] = marker

        allowed = list(getattr(settings, "ALLOWED_HOSTS", []))
        if "testserver" not in allowed:
            settings.ALLOWED_HOSTS = [*allowed, "testserver"]

        User = get_user_model()
        user = User.objects.create_user(
            username=f"e2e_{marker}",
            email=f"e2e_{marker}@heritagegraph.test",
            password="e2e-pass-123",
        )
        client = APIClient()
        client.force_authenticate(user=user)

        loc_payload = {
            "name": f"E2E Place {marker}",
            "type": "temple",
            "current_status": "preserved",
            "description": "Pipeline validation place",
            "latitude": 27.7172,
            "longitude": 85.324,
        }
        loc_res = client.post("/api/v1/cidoc/locations/", loc_payload, format="json")
        report.add(
            "api_post_location",
            loc_res.status_code == 201,
            f"status={loc_res.status_code} body={loc_res.content[:200]!r}",
        )
        if loc_res.status_code != 201:
            self._emit(report, options)
            return

        loc_id = loc_res.json()["id"]
        report.markers["location_id"] = str(loc_id)

        struct_payload = {
            "name": f"E2E Stupa {marker}",
            "structure_type": "Temple",
            "description": "Pipeline validation structure",
            "has_current_location": loc_id,
            "latitude": 27.7172,
            "longitude": 85.324,
        }
        struct_res = client.post(
            "/api/v1/cidoc/structures/", struct_payload, format="json"
        )
        report.add(
            "api_post_structure",
            struct_res.status_code == 201,
            f"status={struct_res.status_code}",
        )
        struct_id = struct_res.json().get("id") if struct_res.status_code == 201 else None
        if struct_id:
            report.markers["structure_id"] = str(struct_id)

        person_payload = {
            "name": f"E2E Person {marker}",
            "title": "E2E",
            "description": "Pipeline validation person",
        }
        person_res = client.post("/api/v1/cidoc/persons/", person_payload, format="json")
        report.add(
            "api_post_person",
            person_res.status_code == 201,
            f"status={person_res.status_code}",
        )
        person_id = person_res.json().get("id") if person_res.status_code == 201 else None
        if person_id:
            report.markers["person_id"] = str(person_id)

        # ── Postgres ─────────────────────────────────────────────────────
        loc = Location.objects.filter(pk=loc_id).first()
        report.add(
            "postgres_location",
            loc is not None and loc.name == loc_payload["name"],
            f"found={loc is not None}",
        )

        if struct_id:
            st = ArchitecturalStructure.objects.filter(pk=struct_id).first()
            report.add(
                "postgres_structure",
                st is not None
                and st.has_current_location_id == loc_id
                and bool(st.point),
                f"has_current_location={getattr(st, 'has_current_location_id', None)} point={getattr(st, 'point', None)}",
            )

        if person_id:
            person = Person.objects.filter(pk=person_id).first()
            ce = CulturalEntity.objects.filter(name=person_payload["name"]).first()
            report.add(
                "postgres_person",
                person is not None,
                f"contributor={getattr(person, 'contributor', None)}",
            )
            report.add(
                "postgres_cultural_entity",
                ce is not None,
                f"status={getattr(ce, 'status', None)}",
            )

        # ── RDF / Oxigraph (local store) ───────────────────────────────────
        if person_id:
            person = Person.objects.get(pk=person_id)
            person_cls = (get_effective_registry_payload().get("classes") or {}).get(
                "person"
            )
            name_slot = expand_curie(str(_registry_field("person", "name")["slot_uri"]))
            class_type = expand_curie(str(person_cls["classUri"]))
            triples, _ = tripleset_for_metadata_instance(
                person,
                resource_uri_fn=_resource_uri,
                label_fn=lambda o: getattr(o, "name", "") or str(o.pk),
            )
            preds = {t.pred for t in triples}
            report.add(
                "rdf_projection_registry",
                RDF_TYPE_URI in preds and name_slot in preds,
                f"class_type={class_type}",
            )

            try:
                import pyoxigraph  # noqa: F401
            except ImportError:
                report.add("oxigraph_store", False, "pyoxigraph not installed")
            else:
                with tempfile.TemporaryDirectory() as tmp:
                    store_path = str(Path(tmp) / "oxigraph_e2e")
                    with override_settings(
                        RDF_SYNC_ENABLED=True,
                        RDF_ENDPOINT_URL="",
                        RDF_RESOURCE_BASE_URI=getattr(
                            settings,
                            "RDF_RESOURCE_BASE_URI",
                            "https://w3id.org/heritagegraph/resource/",
                        ).rstrip("/"),
                        OXIGRAPH_STORE_PATH=store_path,
                    ):
                        if not rdf_sync_enabled():
                            report.add("oxigraph_store", False, "RDF_SYNC_ENABLED off")
                        else:
                            # Re-save to trigger signals into temp store
                            person.description = person.description + " "
                            person.save()
                            from pyoxigraph import NamedNode, Store

                            subj = NamedNode(_resource_uri(person))
                            quads = list(
                                Store(store_path).quads_for_pattern(
                                    subj, None, None, None
                                )
                            )
                            report.add(
                                "oxigraph_store",
                                len(quads) > 0,
                                f"quad_count={len(quads)} subject={_resource_uri(person)}",
                            )

        # ── Read APIs (what graphview / atlas fetch) ─────────────────────
        api_lists: dict[str, list] = {}
        for path, key in [
            ("/api/v1/cidoc/locations/", "location"),
            ("/api/v1/cidoc/structures/", "structure"),
            ("/api/v1/cidoc/persons/", "person"),
        ]:
            list_res = client.get(path)
            ok = list_res.status_code == 200
            rows = []
            if ok:
                body = list_res.json()
                rows = body.get("results") if isinstance(body, dict) else body
                rows = rows if isinstance(rows, list) else []
            api_lists[key] = rows
            report.add(
                f"api_list_{key}",
                ok and any(str(r.get("id")) == report.markers.get(f"{key}_id") for r in rows if f"{key}_id" in report.markers),
                f"count={len(rows)}",
            )

        # Find our rows in list payloads
        seeded: dict[str, dict] = {}
        for key, rows in api_lists.items():
            rid = report.markers.get(f"{key}_id")
            if not rid:
                continue
            for row in rows:
                if str(row.get("id")) == rid:
                    seeded[key] = row
                    break

        node_ids, graph_spatial = _simulate_instance_graph_nodes(
            {k: [v] for k, v in seeded.items() if v}
        )
        report.add(
            "graphview_nodes",
            f"location_{loc_id}" in node_ids
            and (not struct_id or f"structure_{struct_id}" in node_ids)
            and (not person_id or f"person_{person_id}" in node_ids),
            f"node_ids={node_ids}",
        )

        atlas_entities, atlas_spatial = _simulate_atlas_hydrate(
            {k: [v] for k, v in seeded.items() if v}
        )
        report.add(
            "atlas_hydrate_entities",
            atlas_entities >= 3,
            f"entities={atlas_entities}",
        )
        report.add(
            "atlas_globe_spatial",
            atlas_spatial >= 2,
            f"spatial_entities={atlas_spatial} (location+structure need lat/lon in API)",
        )

        loc_row = seeded.get("location") or {}
        report.add(
            "atlas_location_coords",
            loc_row.get("latitude") is not None and loc_row.get("longitude") is not None,
            f"lat={loc_row.get('latitude')} lon={loc_row.get('longitude')}",
        )

        if not options["keep_data"]:
            if person_id:
                Person.objects.filter(pk=person_id).delete()
            if struct_id:
                ArchitecturalStructure.objects.filter(pk=struct_id).delete()
            Location.objects.filter(pk=loc_id).delete()
            CulturalEntity.objects.filter(name__icontains=marker).delete()
            user.delete()

        self._emit(report, options)

    def _emit(self, report: PipelineReport, options) -> None:
        if options["json"]:
            payload = {
                "passed": report.passed,
                "markers": report.markers,
                "steps": [asdict(s) for s in report.steps],
            }
            self.stdout.write(json.dumps(payload, indent=2))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("Contribution → Viz pipeline"))
        for step in report.steps:
            style = self.style.SUCCESS if step.ok else self.style.ERROR
            mark = "PASS" if step.ok else "FAIL"
            self.stdout.write(style(f"  [{mark}] {step.name}: {step.detail}"))
        self.stdout.write("")
        if report.passed:
            self.stdout.write(self.style.SUCCESS("Overall: PASSED"))
        else:
            self.stdout.write(self.style.ERROR("Overall: FAILED"))
            raise SystemExit(1)
