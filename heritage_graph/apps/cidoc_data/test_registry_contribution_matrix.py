"""Registry-driven contribution pipeline test: every contribute form, end to end.

``test_e2e_pipeline`` proves the pipeline works for two hand-written domains. This
module instead drives **every navigable class in the schema registry** — the same
snapshot the contribute forms render from — through the full path:

    form POST -> CulturalEntity wrapper -> withheld from browse
              -> reviewer accept -> visible in browse -> projected into the graph

The point is ontology drift: when a slot is renamed, loses ``required``, or stops
matching its Django column, exactly one domain breaks and nothing else notices.
Deriving the payloads from the registry means a schema change that forms cannot
satisfy fails here instead of in the browser.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.cidoc_data.test_registry_contribution_matrix -v2
"""

import json
import tempfile
from pathlib import Path

from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model
from apps.cidoc_data.urls import router
from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.uris import resource_uri_for_instance
from apps.heritage_data.models import CulturalEntity
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import models as dj_models
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_matrix_oxigraph_")

_REGISTRY_PATH = (
    Path(__file__).resolve().parents[3]
    / "heritage_graph_ui"
    / "src"
    / "lib"
    / "ontology"
    / "registry.generated.json"
)

# Registry keys whose rows are not contributor-authored heritage records, so they
# never travel the contribute -> review -> browse path this module asserts on.
_NOT_CONTRIBUTABLE = {
    "assertion",  # provenance edge, created alongside a claim rather than by a form
    "entity",  # the CulturalEntity wrapper itself
    "data_source",  # curator-managed lookup table
}


def _load_registry() -> dict:
    with _REGISTRY_PATH.open() as fh:
        return json.load(fh)


def _viewsets_by_endpoint() -> dict[str, type]:
    """Map the registry's ``apiEndpoint`` onto the router's registered viewsets."""
    out = {}
    for prefix, viewset, _ in router.registry:
        out[f"/cidoc/{prefix}/"] = viewset
        out[f"/{prefix}/"] = viewset
    return out


class RegistryContributionMatrixTest(APITestCase):
    """Every registry-declared contribute form must survive the whole pipeline."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.registry = _load_registry()
        cls.viewsets = _viewsets_by_endpoint()

    def setUp(self):
        self.contributor = User.objects.create_user(
            username="matrix-contributor", email="c@example.com", password="pw"
        )
        self.reviewer = User.objects.create_user(
            username="matrix-reviewer",
            email="r@example.com",
            password="pw",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.contributor)
        self.engine = get_kg_engine()

    # ── payload construction ─────────────────────────────────────────────────

    def _make_dependency(self, model) -> object:
        """Create a minimal related row so FK-backed required fields resolve."""
        values = {}
        for field in model._meta.get_fields():
            if not isinstance(field, dj_models.Field) or field.auto_created:
                continue
            if field.blank or field.null or field.has_default():
                continue
            if isinstance(field, dj_models.CharField):
                values[field.name] = (
                    field.choices[0][0] if field.choices else f"dep-{field.name}"[:20]
                )
            elif isinstance(field, dj_models.TextField):
                values[field.name] = "dep"
        return model.objects.create(**values)

    def _serializer_value(self, field):
        """A value the DRF serializer field will accept, or ``None`` to skip."""
        from rest_framework import serializers as drf

        if isinstance(field, drf.PrimaryKeyRelatedField):
            queryset = field.queryset
            if queryset is None:
                return None
            return self._make_dependency(queryset.model).pk
        if isinstance(field, drf.ChoiceField):
            choices = [c for c in field.choices if c not in ("", None)]
            return choices[0] if choices else None
        if isinstance(field, drf.BooleanField):
            return False
        if isinstance(field, (drf.IntegerField, drf.FloatField, drf.DecimalField)):
            return 1
        if isinstance(field, (drf.ListField, drf.ManyRelatedField)):
            return []
        if isinstance(field, drf.JSONField):
            return {}
        if isinstance(field, drf.CharField):
            if "date" in field.field_name:
                return "1900"[: field.max_length or 4]
            return "E2E value"
        return None

    def _build_payload(self, key: str, entry: dict, viewset: type) -> dict:
        serializer = viewset.serializer_class()
        fields = serializer.fields
        payload: dict = {}

        # 1. Whatever the serializer itself insists on.
        for name, field in fields.items():
            if field.read_only or not field.required:
                continue
            value = self._serializer_value(field)
            if value is not None:
                payload[name] = value

        # 2. Whatever the registry marks required, so the form's contract is the
        #    thing under test rather than the serializer's laxer view of it.
        for spec in entry.get("fields", []):
            if not spec.get("required") or spec["key"] in payload:
                continue
            name = spec["key"]
            field = fields.get(name)
            if field is not None and not field.read_only:
                value = self._serializer_value(field)
                payload[name] = value if value is not None else f"E2E {key}"
            else:
                # Registry-only slot (no Django column): the JSON Schema gate still
                # demands it, and its declared type accepts a plain string.
                payload[name] = f"E2E {key} {name}"

        payload.setdefault("name", f"E2E {key}")
        return payload

    # ── the pipeline ─────────────────────────────────────────────────────────

    def _wrapper_for(self, instance):
        ct = ContentType.objects.get_for_model(type(instance))
        return CulturalEntity.objects.get(
            cidoc_content_type=ct, cidoc_object_id=instance.pk
        )

    def _ids_in_public_list(self, endpoint: str) -> set[str]:
        resp = self.client.get(f"/api/v1{endpoint}")
        self.assertEqual(resp.status_code, 200, f"{endpoint}: {resp.content}")
        body = resp.json()
        rows = body.get("results", body) if isinstance(body, dict) else body
        return {str(row["id"]) for row in rows}

    def _run_domain(self, key: str, entry: dict):
        endpoint = entry["apiEndpoint"]
        viewset = self.viewsets.get(endpoint)
        self.assertIsNotNone(
            viewset, f"{key}: registry apiEndpoint {endpoint} has no registered viewset"
        )
        model = viewset.queryset.model

        # The registry key the backend derives must match the one the form uses,
        # or the review queue and RDF projection look the record up under a name
        # that does not exist.
        self.assertEqual(
            registry_class_key_for_model(model),
            key,
            f"{key}: backend registry key disagrees with the registry snapshot",
        )

        # ── STAGE 1: form submission ─────────────────────────────────────────
        payload = self._build_payload(key, entry, viewset)
        resp = self.client.post(f"/api/v1{endpoint}", payload, format="json")

        self.assertEqual(
            resp.status_code,
            status.HTTP_201_CREATED,
            f"{key}: POST {endpoint} with registry-derived payload "
            f"{payload} failed -> {resp.content}",
        )
        pk = resp.json()["id"]
        instance = model.objects.get(pk=pk)

        # ── STAGE 2: staged for review, withheld from the public list ────────
        wrapper = self._wrapper_for(instance)
        self.assertEqual(
            wrapper.status, "pending_review", f"{key}: wrapper not queued for review"
        )
        self.assertNotIn(
            str(pk),
            self._ids_in_public_list(endpoint),
            f"{key}: unreviewed record leaked into the public browse list",
        )

        # ── STAGE 3: reviewer accepts ────────────────────────────────────────
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "matrix accept")
        instance.refresh_from_db()
        self.assertEqual(
            instance.status, "accepted", f"{key}: accept did not publish the row"
        )

        # ── STAGE 4: visible in browse, present in the graph ─────────────────
        self.assertIn(
            str(pk),
            self._ids_in_public_list(endpoint),
            f"{key}: accepted record missing from the public browse list",
        )
        uri = resource_uri_for_instance(instance)
        self.assertGreater(
            len(self.engine.neighborhood(uri)),
            0,
            f"{key}: accepted record was not projected into the knowledge graph",
        )

    @override_settings(
        OXIGRAPH_STORE_PATH=_TMP_STORE,
        RDF_SYNC_ENABLED=True,
        RDF_ENDPOINT_URL="",  # embedded pyoxigraph
        RDF_QUERY_URL="",
    )
    def test_every_registry_domain_survives_the_pipeline(self):
        classes = self.registry["classes"]
        self.assertGreater(len(classes), 20, "registry snapshot looks truncated")

        checked, skipped = [], []
        for key in sorted(classes):
            entry = classes[key]
            if key in _NOT_CONTRIBUTABLE or not entry.get("navigable"):
                skipped.append(key)
                continue
            with self.subTest(domain=key):
                self._run_domain(key, entry)
            checked.append(key)

        self.assertGreater(
            len(checked),
            15,
            f"too few domains exercised: {checked} (skipped {skipped})",
        )
