"""
End-to-end pipeline test: form submission -> knowledge-graph storage -> graph visualization.

Exercises the real HTTP API the contribution form posts to, the RDF projection signals,
and the endpoints the graph views consume. Uses an isolated temp Oxigraph store and an
isolated test database, so it pollutes nothing.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test apps.cidoc_data.test_e2e_pipeline -v2
"""

import tempfile

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cidoc_data.models import HeritageAssertion, Location, Person
from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.uris import resource_uri_for_instance

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_e2e_oxigraph_")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",  # force the embedded pyoxigraph path
    RDF_QUERY_URL="",
)
class FormToKnowledgeGraphToVisualizationTest(APITestCase):
    """The full ingestion pipeline, end to end, through the public API."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="contributor", email="c@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)
        self.engine = get_kg_engine()

    def test_full_pipeline_form_to_graph(self):
        engine = self.engine

        # ── STAGE 1: FORM SUBMISSION (HTTP POST, like the contribution form) ──────
        loc_resp = self.client.post(
            "/api/v1/cidoc/locations/",
            {
                "name": "Kathmandu Durbar Square",
                "type": "archaeological_site",
                "current_status": "preserved",
                "description": "Historic royal square (e2e test).",
            },
            format="json",
        )
        self.assertEqual(loc_resp.status_code, status.HTTP_201_CREATED, loc_resp.content)
        location_id = loc_resp.json()["id"]

        person_resp = self.client.post(
            "/api/v1/cidoc/persons/",
            {"name": "King Pratap Malla", "description": "17th-century king (e2e test)."},
            format="json",
        )
        self.assertEqual(person_resp.status_code, status.HTTP_201_CREATED, person_resp.content)
        person_id = person_resp.json()["id"]

        # ── STAGE 2: RELATIONAL STORAGE (system of record) ────────────────────────
        self.assertTrue(Location.objects.filter(pk=location_id).exists())
        self.assertTrue(Person.objects.filter(pk=person_id).exists())
        person = Person.objects.get(pk=person_id)
        location = Location.objects.get(pk=location_id)

        # Curation gate: only published-status rows enter graph/public.
        with self.captureOnCommitCallbacks(execute=True):
            person.status = "accepted"
            person.save(update_fields=["status"])
            location.status = "accepted"
            location.save(update_fields=["status"])

        # GET them back through the API (read path the knowledge pages use)
        self.assertEqual(
            self.client.get(f"/api/v1/cidoc/persons/{person_id}/").status_code, 200
        )

        # ── STAGE 3: KNOWLEDGE-GRAPH STORAGE (RDF projection via signals) ──────────
        person_uri = resource_uri_for_instance(person)
        location_uri = resource_uri_for_instance(location)

        person_edges = engine.neighborhood(person_uri)
        preds = {e.get("predicate", "") for e in person_edges}
        self.assertTrue(
            any(p.endswith("type") for p in preds),
            f"Expected rdf:type in projected person triples, got {preds}",
        )
        self.assertTrue(
            any(p.endswith("label") for p in preds),
            f"Expected rdfs:label in projected person triples, got {preds}",
        )
        # The label round-trips into the graph store
        label_values = {e.get("value") for e in person_edges if e.get("predicate", "").endswith("label")}
        self.assertIn("King Pratap Malla", label_values)

        self.assertGreater(len(engine.neighborhood(location_uri)), 0, "Location not projected")

        # ── STAGE 4: RELATIONSHIP -> GRAPH EDGE (accepted assertion) ──────────────
        person_ct = ContentType.objects.get_for_model(Person)
        location_ct = ContentType.objects.get_for_model(Location)
        # Assertion (edge) projection is deferred via transaction.on_commit, so
        # capture+run the on-commit callbacks to mirror a real committed request.
        with self.captureOnCommitCallbacks(execute=True):
            assertion = HeritageAssertion.objects.create(
                content_type=person_ct,
                object_id=person.pk,
                asserted_property="relationship.P74_has_current_or_former_residence",
                object_content_type=location_ct,
                object_object_id=location.pk,
                reconciliation_status="accepted",
            )
        self.assertTrue(HeritageAssertion.objects.filter(pk=assertion.pk).exists())

        # ── STAGE 5: GRAPH-VISUALIZATION DATA PATH ────────────────────────────────
        # 5a. Global graph view sources nodes from the CIDOC list endpoints.
        persons_list = self.client.get("/api/v1/cidoc/persons/").json()
        person_ids = {row["id"] for row in persons_list.get("results", persons_list)} \
            if isinstance(persons_list, dict) else {row["id"] for row in persons_list}
        self.assertIn(person_id, person_ids, "New person missing from graph-view node source")

        # 5b. Global graph view sources EDGES from accepted assertions.
        edges_resp = self.client.get(
            "/api/v1/cidoc/assertions/?reconciliation_status=accepted"
        )
        self.assertEqual(edges_resp.status_code, 200)
        edges_body = edges_resp.json()
        edge_rows = edges_body.get("results", edges_body) if isinstance(edges_body, dict) else edges_body
        self.assertTrue(
            any(str(r.get("id")) == str(assertion.pk) for r in edge_rows),
            "Accepted relationship assertion missing from graph-view edge source",
        )

        # 5c. Entity neighborhood view (SPARQL-backed) reflects the graph.
        stats = engine.stats()
        self.assertGreater(stats.public_triples, 0)
        self.assertEqual(stats.source, "sparql")

        # 5d. Museum KG graph projection (typed nodes + real triple edges).
        kg_resp = self.client.get("/api/v1/cidoc/kg/graph/?scope=all&node_limit=500")
        self.assertEqual(kg_resp.status_code, 200, kg_resp.content)
        kg_body = kg_resp.json()
        node_iris = {n["id"] for n in kg_body.get("nodes", [])}
        self.assertIn(person_uri, node_iris, "Person missing from kg/graph nodes")
        edge_endpoints = {
            (e["source"], e["target"])
            for e in kg_body.get("edges", [])
            if e.get("source") and e.get("target")
        }
        self.assertTrue(
            any(person_uri in pair for pair in edge_endpoints),
            "Person has no entity-to-entity edge in kg/graph projection",
        )

        # ── STAGE 6: RETRACTION (delete propagates out of the graph) ──────────────
        before = engine.stats().public_triples
        self.client.delete(f"/api/v1/cidoc/persons/{person_id}/")
        self.assertFalse(Person.objects.filter(pk=person_id).exists())
        after = engine.stats().public_triples
        self.assertLess(after, before, "Person triples not retracted from the graph on delete")
