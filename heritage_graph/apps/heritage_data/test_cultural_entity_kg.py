"""E2E: Cultural Entity contribution form -> review acceptance -> public RDF graph
-> museum kg/graph projection.

Verifies the gap fixed in 2026-06: a standalone CulturalEntity (the generic
/contribute/entity form) now reaches the live Heritage Museum KG on acceptance,
with a museum-renderable rdf:type derived from its category.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.heritage_data.test_cultural_entity_kg -v2
"""

import tempfile

from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.uris import cultural_entity_uri
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_ce_e2e_oxigraph_")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",  # force the embedded pyoxigraph path
    RDF_QUERY_URL="",
)
class CulturalEntityToKgTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ce_contrib", email="ce@example.com", password="pw"
        )
        self.editor = User.objects.create_user(
            username="ce_editor", email="ed@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def test_cultural_entity_form_to_graph(self):
        from apps.heritage_data.models import CulturalEntity

        # ── STAGE 1: FORM SUBMISSION (HTTP POST, like /contribute/entity) ─────────
        resp = self.client.post(
            "/data/api/cultural-entities/",
            {
                "name": "Indra Jatra (e2e)",
                "description": "Street festival of Kathmandu (e2e test).",
                "category": "festival",
                "form_data": {
                    "name": "Indra Jatra (e2e)",
                    "category": "festival",
                    "description": "Street festival of Kathmandu (e2e test).",
                },
            },
            format="json",
        )
        self.assertIn(resp.status_code, (200, 201), resp.content)

        entity = CulturalEntity.objects.get(name="Indra Jatra (e2e)")
        uri = cultural_entity_uri(entity.entity_id)
        engine = get_kg_engine()

        # ── STAGE 2: not in the public graph while still pending review ───────────
        before = engine.query(f"SELECT ?p WHERE {{ GRAPH ?g {{ <{uri}> ?p ?o }} }}")
        self.assertEqual(len(before), 0, "must not be projected before acceptance")

        # ── STAGE 3: acceptance triggers projection (transaction.on_commit) ──────
        with self.captureOnCommitCallbacks(execute=True):
            entity.accept_contribution(self.editor, "looks good")

        rows = engine.query(f"SELECT ?p ?o WHERE {{ GRAPH ?g {{ <{uri}> ?p ?o }} }}")
        self.assertGreater(len(rows), 0, "entity should be projected after acceptance")

        # ── STAGE 4: museum graph endpoint shows it with a renderable type ───────
        gresp = self.client.get("/api/v1/cidoc/kg/graph/?scope=all")
        self.assertEqual(gresp.status_code, 200, gresp.content)
        payload = gresp.json()
        node = next((n for n in payload["nodes"] if n["id"] == uri), None)
        self.assertIsNotNone(node, "entity node must appear in kg/graph nodes")
        # category 'festival' -> heritageGraph:Festival (a mapped museum NodeType)
        self.assertTrue(
            any(t.endswith("Festival") for t in node["types"]),
            f"expected a Festival type, got {node['types']}",
        )

        # ── STAGE 5: rejection removes it again (KG stays honest) ────────────────
        with self.captureOnCommitCallbacks(execute=True):
            entity.reject_contribution(self.editor, "retracting for e2e")

        # The embedded dev store caches a read-only snapshot separate from the
        # read-write handle, so a delete issued via the RW handle isn't visible to
        # readonly queries in-process (production uses a single remote Oxigraph, so
        # this does not apply). Drop the cached snapshot to observe the delete.
        from apps.graph.kg_engine import store as _store_mod

        _store_mod._LOCAL_READONLY_CACHE.clear()
        after = engine.query(f"SELECT ?p WHERE {{ GRAPH ?g {{ <{uri}> ?p ?o }} }}")
        self.assertEqual(len(after), 0, "entity should be removed after rejection")
