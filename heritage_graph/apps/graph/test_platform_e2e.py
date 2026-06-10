"""
Platform-wide end-to-end smoke tests — major flows through the public HTTP API.

Uses an isolated temp Oxigraph store per run (no pollution of dev data).
Complements ``apps.cidoc_data.test_e2e_pipeline`` (full RDF graph path).

Run all platform E2E (from repo root):
    make test-e2e
    ./tests/run_e2e.sh

Or a single module:
    cd heritage_graph && python manage.py test apps.graph.test_platform_e2e -v2

Docs: documentation/testing/TESTING.md
"""

from __future__ import annotations

import tempfile

from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.models import EntityCluster, HeritageAssertion, IdentityResolutionCandidate, Location
from apps.graph.kg_engine import get_kg_engine
from apps.heritage_data.models import CulturalEntity, ReviewerRole
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_platform_e2e_oxigraph_")

E2E_SETTINGS = dict(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",
    RDF_QUERY_URL="",
    CELERY_TASK_ALWAYS_EAGER=True,
)


@override_settings(**E2E_SETTINGS)
class PlatformHealthE2ETest(APITestCase):
    """Infrastructure endpoints (Docker / Traefik probes)."""

    def test_health_endpoints(self):
        for path in ("/health/", "/health/live/", "/health/ready/"):
            resp = self.client.get(path)
            self.assertEqual(resp.status_code, 200, path)
        detailed = self.client.get("/health/detailed/")
        self.assertIn(detailed.status_code, (200, 503))
        body = detailed.json()
        self.assertIn("database", body)
        self.assertTrue(body["database"].get("healthy"), "Database must be healthy in E2E")


@override_settings(**E2E_SETTINGS)
class PlatformPublicReadE2ETest(APITestCase):
    """Anonymous read paths used by landing, discovery, and museum."""

    def test_public_discovery_and_search(self):
        disc = self.client.get("/api/v1/cidoc/discovery/")
        self.assertEqual(disc.status_code, 200, disc.content)
        self.assertIn("counts", disc.json())

        search = self.client.get("/api/v1/cidoc/search/?q=temple")
        self.assertEqual(search.status_code, 200, search.content)

    def test_ontology_schema_registry(self):
        resp = self.client.get("/api/v1/cidoc/schema/registry/")
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertTrue(
            body.get("registry_jsonschema") or body.get("classes"),
            "Schema registry payload missing expected keys",
        )

    def test_kg_stats_and_graph(self):
        stats = self.client.get("/api/v1/cidoc/kg/stats/")
        self.assertEqual(stats.status_code, 200, stats.content)
        stats_body = stats.json()
        self.assertTrue(
            "public_graph_triples" in stats_body or "public_triples" in stats_body,
            stats_body,
        )

        graph = self.client.get("/api/v1/cidoc/kg/graph/?scope=reviewed&node_limit=50")
        self.assertEqual(graph.status_code, 200, graph.content)
        self.assertIn("nodes", graph.json())
        self.assertIn("edges", graph.json())


@override_settings(**E2E_SETTINGS)
class PlatformContributionE2ETest(APITestCase):
    """Contribute → identity → cultural-entity wrapper → queue."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="e2e_contributor",
            email="e2e-contrib@example.com",
            password="pw",
        )
        self.client.force_authenticate(user=self.user)

    def test_location_create_triggers_cultural_entity_and_identity(self):
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/v1/cidoc/locations/",
                {
                    "name": "E2E Platform Stupa Alpha",
                    "description": "Platform E2E unique label.",
                    "type": "archaeological_site",
                    "current_status": "preserved",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        loc_id = resp.json()["id"]

        self.assertTrue(
            CulturalEntity.objects.filter(name="E2E Platform Stupa Alpha").exists(),
            "ContributionFlowMixin should create CulturalEntity wrapper",
        )
        ct = ContentType.objects.get_for_model(Location)
        self.assertTrue(
            HeritageAssertion.objects.filter(
                content_type=ct,
                object_id=loc_id,
                asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            ).exists(),
            "Identity membership should exist after on_commit resolution",
        )

    def test_duplicate_label_links_cluster_and_queues_review(self):
        ct = ContentType.objects.get_for_model(Location)
        existing = Location.objects.create(
            name="E2E Platform Temple Dup",
            contributor="first",
            status="accepted",
        )
        cluster = EntityCluster.objects.create(
            canonical_label="E2E Platform Temple Dup",
            type_scope="location",
        )
        ha = HeritageAssertion(
            content_type=ct,
            object_id=existing.pk,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            entity_cluster=cluster,
            reconciliation_status="accepted",
            confidence="certain",
            contributed_by="bootstrap",
        )
        ha.full_clean()
        ha.save()

        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/v1/cidoc/locations/",
                {
                    "name": "E2E Platform Temple Dup",
                    "description": "Richer duplicate submission.",
                    "type": "temple",
                    "current_status": "preserved",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        new_id = resp.json()["id"]

        mem = HeritageAssertion.objects.filter(
            content_type=ct,
            object_id=new_id,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            reconciliation_status="accepted",
        ).first()
        self.assertIsNotNone(mem)
        self.assertEqual(mem.entity_cluster_id, cluster.id)
        self.assertTrue(
            IdentityResolutionCandidate.objects.filter(
                status="open",
                signal_scores__rule="duplicate_contribution_same_cluster",
            ).exists()
        )

    def test_suggest_duplicates_api_ranks_members(self):
        resp = self.client.get(
            "/api/v1/cidoc/entity-clusters/suggest-duplicates/"
            "?q=E2E Platform Temple&registry_key=location&include_members=true"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertIn("results", body)
        self.assertIn("recommendation", body)


@override_settings(**E2E_SETTINGS)
class PlatformReviewE2ETest(APITestCase):
    """Curation queue and reviewer-gated endpoints."""

    def setUp(self):
        self.contributor = User.objects.create_user(
            username="e2e_rev_contrib",
            email="e2e-rev-c@example.com",
            password="pw",
        )
        self.reviewer = User.objects.create_user(
            username="e2e_reviewer",
            email="e2e-rev@example.com",
            password="pw",
            is_staff=True,
        )
        ReviewerRole.objects.create(
            user=self.reviewer,
            role="expert_curator",
            is_active=True,
        )
        self.entity = CulturalEntity.objects.create(
            name="E2E Review Entity",
            description="Pending",
            category="monument",
            status="pending_review",
            contributor=self.contributor,
        )

    def test_contribution_queue_counts_and_list(self):
        counts = self.client.get("/api/v1/data/contribution-queue/queue-counts/")
        self.assertEqual(counts.status_code, 200)
        for key in ("all", "new_claims", "conflicts", "flagged", "expiring"):
            self.assertIn(key, counts.json())

        tab = self.client.get(
            "/api/v1/data/contribution-queue/",
            {"queue_tab": "new_claims", "limit": 20},
        )
        self.assertEqual(tab.status_code, 200)
        ids = {r["entity_id"] for r in tab.json().get("results", [])}
        self.assertIn(str(self.entity.entity_id), ids)

    def test_review_queue_requires_reviewer(self):
        anon = self.client.get("/api/v1/data/review-queue/")
        self.assertIn(anon.status_code, (401, 403))

        self.client.force_authenticate(user=self.reviewer)
        rq = self.client.get("/api/v1/data/review-queue/")
        self.assertEqual(rq.status_code, 200, rq.content)
        policy = self.client.get("/api/v1/data/review-queue/triage-policy/")
        self.assertEqual(policy.status_code, 200)


@override_settings(**E2E_SETTINGS)
class PlatformRdfPublishE2ETest(APITestCase):
    """Accepted record → RDF projection → KG engine readable."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="e2e_rdf_user",
            email="e2e-rdf@example.com",
            password="pw",
        )
        self.client.force_authenticate(user=self.user)
        self.engine = get_kg_engine()

    def test_accepted_location_projects_to_graph(self):
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/v1/cidoc/locations/",
                {
                    "name": "E2E RDF Publish Site",
                    "description": "Should project when accepted.",
                    "type": "archaeological_site",
                    "current_status": "preserved",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 201, resp.content)
        loc = Location.objects.get(pk=resp.json()["id"])
        with self.captureOnCommitCallbacks(execute=True):
            loc.status = "accepted"
            loc.save(update_fields=["status"])

        stats = self.engine.stats()
        self.assertGreater(stats.public_triples, 0)

        kg = self.client.get("/api/v1/cidoc/kg/graph/?scope=all&node_limit=200")
        self.assertEqual(kg.status_code, 200)
        labels = {n.get("label") for n in kg.json().get("nodes", [])}
        self.assertIn("E2E RDF Publish Site", labels)
