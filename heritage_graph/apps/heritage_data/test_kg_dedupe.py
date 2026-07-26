"""Regression tests for public-graph hygiene (2026-07 pipeline audit).

1. A CIDOC contribution approved through its CulturalEntity wrapper must appear
   in the public graph ONCE — as the canonical ``resource/<segment>/<pk>`` node.
   The wrapper must NOT project a second ``resource/entity/<uuid>`` node with
   the same label (this duplicated every approved contribution in the
   museum/atlas).

2. Deleting a CulturalEntity must remove its projected node from the store —
   no ghost nodes without a backing Postgres row.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test apps.heritage_data.test_kg_dedupe -v2
"""

import tempfile

from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.uris import cultural_entity_uri, resource_uri_for_instance
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_dedupe_oxigraph_")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",  # force the embedded pyoxigraph path
    RDF_QUERY_URL="",
)
class KgDedupeAndGhostCleanupTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dedupe_contrib", email="dc@example.com", password="pw"
        )
        self.editor = User.objects.create_user(
            username="dedupe_editor", email="de@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def _clear_readonly_cache(self):
        from apps.graph.kg_engine import store as _store_mod

        _store_mod._LOCAL_READONLY_CACHE.clear()

    def test_cidoc_contribution_projects_one_node_not_two(self):
        from apps.cidoc_data.models import Monument
        from apps.heritage_data.models import CulturalEntity

        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/v1/cidoc/monuments/",
                {
                    "name": "Dedupe Test Stupa",
                    "latitude": "27.7215",
                    "longitude": "85.3620",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 201, resp.content)
        monument = Monument.objects.get(pk=resp.json()["id"])
        wrapper = CulturalEntity.objects.get(
            cidoc_object_id=monument.pk,
            cidoc_content_type__model="monument",
        )

        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.editor, "approve for dedupe test")

        engine = get_kg_engine()
        cidoc_uri = resource_uri_for_instance(monument)
        wrapper_uri = cultural_entity_uri(wrapper.entity_id)

        cidoc_rows = engine.query(
            f"SELECT ?p WHERE {{ GRAPH ?g {{ <{cidoc_uri}> ?p ?o }} }}"
        )
        self.assertGreater(
            len(cidoc_rows), 0, "canonical CIDOC node must be projected"
        )

        wrapper_rows = engine.query(
            f"SELECT ?p WHERE {{ GRAPH ?g {{ <{wrapper_uri}> ?p ?o }} }}"
        )
        self.assertEqual(
            len(wrapper_rows),
            0,
            "FK-linked wrapper must not project a duplicate entity/<uuid> node",
        )

    def test_deleting_cultural_entity_removes_projected_node(self):
        from apps.heritage_data.models import CulturalEntity

        # Standalone entity (no CIDOC link) — projects at entity/<uuid>.
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/data/api/cultural-entities/",
                {
                    "name": "Ghost Cleanup Festival",
                    "description": "Standalone entity for ghost-node cleanup test.",
                    "category": "festival",
                    "form_data": {"name": "Ghost Cleanup Festival"},
                },
                format="json",
            )
        self.assertIn(resp.status_code, (200, 201), resp.content)
        entity = CulturalEntity.objects.get(name="Ghost Cleanup Festival")
        uri = cultural_entity_uri(entity.entity_id)

        with self.captureOnCommitCallbacks(execute=True):
            entity.accept_contribution(self.editor, "approve standalone")

        engine = get_kg_engine()
        rows = engine.query(f"SELECT ?p WHERE {{ GRAPH ?g {{ <{uri}> ?p ?o }} }}")
        self.assertGreater(len(rows), 0, "standalone entity should be projected")

        with self.captureOnCommitCallbacks(execute=True):
            entity.delete()

        # The embedded dev store caches a read-only snapshot; drop it so the
        # delete issued via the read-write handle is observable in-process.
        self._clear_readonly_cache()
        after = engine.query(f"SELECT ?p WHERE {{ GRAPH ?g {{ <{uri}> ?p ?o }} }}")
        self.assertEqual(len(after), 0, "deleted entity must leave no ghost node")
