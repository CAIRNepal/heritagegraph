"""Links and values entered on a contribute form survive review into the graph.

Registry slots with no column on the record used to be dropped by the
serializer with a 201. These tests pin the path that replaced the drop:
submit → revision → accept → HeritageAssertion → public graph.
"""

import json
import tempfile

from apps.cidoc_data.models import DataSource, Deity, HeritageAssertion, Tradition
from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.uris import resource_uri_for_instance
from apps.heritage_data.models import CulturalEntity
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_form_links_oxigraph_")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",
    RDF_QUERY_URL="",
)
class FormLinksTest(APITestCase):
    def setUp(self):
        self.contributor = User.objects.create_user(
            username="linker", email="l@example.com", password="pw"
        )
        self.reviewer = User.objects.create_user(
            username="link-reviewer",
            email="lr@example.com",
            password="pw",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.contributor)
        self.engine = get_kg_engine()
        self.tradition = Tradition.objects.create(
            name="Vaishnavism", status="accepted", source_citation="Fixture."
        )

    def _wrapper_for(self, instance):
        ct = ContentType.objects.get_for_model(type(instance))
        return CulturalEntity.objects.get(
            cidoc_content_type=ct, cidoc_object_id=instance.pk
        )

    def _submit_deity(self, **extra):
        payload = {
            "name": "Vishnu",
            "has_religious_tradition": str(self.tradition.pk),
            "source_citation": "Slusser, Nepal Mandala (1982), p. 141.",
            "source_kind": "published",
            "confidence": "certain",
            **extra,
        }
        return self.client.post("/api/v1/cidoc/deities/", payload, format="json")

    def test_link_is_kept_for_review_then_published_on_accept(self):
        resp = self._submit_deity()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        deity = Deity.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(deity)

        # The reviewer sees the proposed link in the revision.
        links = wrapper.current_revision.data["_links"]
        self.assertEqual(
            links,
            [
                {
                    "slot": "has_religious_tradition",
                    "target": "cidoc_data.tradition",
                    "id": str(self.tradition.pk),
                }
            ],
        )
        # Nothing is asserted before review.
        self.assertFalse(HeritageAssertion.objects.filter(object_id=deity.pk).exists())

        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")

        edge = HeritageAssertion.objects.get(
            asserted_property="relationship.has_religious_tradition", object_id=deity.pk
        )
        self.assertEqual(edge.reconciliation_status, "accepted")
        self.assertEqual(edge.confidence, "certain")
        self.assertEqual(edge.contributed_by, "linker")
        # The typed citation became a registered source that the edge cites.
        deity.refresh_from_db()
        self.assertIsNotNone(deity.source)
        self.assertEqual(edge.source, deity.source)
        self.assertEqual(deity.source.source_type, "published")

        hood = json.dumps(self.engine.neighborhood(resource_uri_for_instance(deity)))
        self.assertIn(resource_uri_for_instance(self.tradition), hood)

    def test_reaccepting_does_not_duplicate_the_edge(self):
        resp = self._submit_deity()
        deity = Deity.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(deity)
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")
        from apps.cidoc_data.registry_slots import apply_revision_extras

        apply_revision_extras(
            deity,
            wrapper.current_revision.data,
            contributor=self.contributor,
            reviewer=self.reviewer,
        )
        self.assertEqual(
            HeritageAssertion.objects.filter(
                object_id=deity.pk, asserted_property__startswith="relationship."
            ).count(),
            1,
        )

    def test_a_link_to_a_missing_record_is_refused(self):
        resp = self._submit_deity(has_religious_tradition="999999")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)
        self.assertIn("has_religious_tradition", resp.json())
        self.assertFalse(Deity.objects.filter(name="Vishnu").exists())

    def test_an_unknown_key_is_refused(self):
        resp = self._submit_deity(favourite_colour="blue")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)
        self.assertIn("favourite_colour", resp.json())

    def test_a_record_with_no_source_cannot_be_accepted(self):
        resp = self.client.post(
            "/api/v1/cidoc/deities/", {"name": "Unsourced"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        wrapper = self._wrapper_for(Deity.objects.get(pk=resp.json()["id"]))
        self.client.force_authenticate(user=self.reviewer)
        decide = self.client.post(
            f"/api/v1/data/api/review-workspace/{wrapper.entity_id}/decide/",
            {
                "verdict": "accept",
                "conflict_handling": "not_applicable",
                "feedback": "ok",
            },
            format="json",
        )
        self.assertEqual(
            decide.status_code, status.HTTP_400_BAD_REQUEST, decide.content
        )
        self.assertIn("names no source", decide.json()["error"])
        wrapper.refresh_from_db()
        self.assertEqual(wrapper.status, "pending_review")

    def test_links_need_a_registered_source_not_just_text(self):
        resp = self._submit_deity(source_kind="")
        deity = Deity.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(deity)
        from apps.cidoc_data.registry_slots import MissingEvidence

        with self.assertRaises(MissingEvidence):
            wrapper.accept_contribution(self.reviewer, "ok")
        deity.refresh_from_db()
        self.assertNotEqual(deity.status, "accepted")

    def test_a_registered_source_is_cited_as_is(self):
        source = DataSource.objects.create(
            name="Nepal Mandala", source_type="published"
        )
        resp = self._submit_deity(
            source=str(source.pk), source_citation="", source_kind=""
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        deity = Deity.objects.get(pk=resp.json()["id"])
        with self.captureOnCommitCallbacks(execute=True):
            self._wrapper_for(deity).accept_contribution(self.reviewer, "ok")
        edge = HeritageAssertion.objects.get(
            object_id=deity.pk, asserted_property__startswith="relationship."
        )
        self.assertEqual(edge.source, source)
        self.assertEqual(DataSource.objects.count(), 1)

    def test_edge_to_a_record_in_review_appears_once_that_record_is_accepted(self):
        pending = Tradition.objects.create(
            name="Shaivism", status="pending_review", source_citation="Fixture."
        )
        CulturalEntity.objects.create(
            name="Shaivism",
            description="",
            category="tradition",
            status="pending_review",
            contributor=self.contributor,
            cidoc_content_type=ContentType.objects.get_for_model(Tradition),
            cidoc_object_id=pending.pk,
        )
        resp = self._submit_deity(has_religious_tradition=str(pending.pk))
        deity = Deity.objects.get(pk=resp.json()["id"])
        with self.captureOnCommitCallbacks(execute=True):
            self._wrapper_for(deity).accept_contribution(self.reviewer, "ok")
        deity_uri = resource_uri_for_instance(deity)
        target_uri = resource_uri_for_instance(pending)
        self.assertNotIn(target_uri, json.dumps(self.engine.neighborhood(deity_uri)))

        with self.captureOnCommitCallbacks(execute=True):
            self._wrapper_for(pending).accept_contribution(self.reviewer, "ok")
        self.assertIn(target_uri, json.dumps(self.engine.neighborhood(deity_uri)))


class AssertionReviewGateTest(APITestCase):
    """A contributor cannot publish a claim by declaring it accepted."""

    def setUp(self):
        self.contributor = User.objects.create_user(
            username="claimant", email="c2@example.com", password="pw"
        )
        self.deity = Deity.objects.create(name="Bhairava", status="accepted")
        self.source = DataSource.objects.create(name="Field notes", source_type="field_survey")
        self.client.force_authenticate(user=self.contributor)

    def _post(self, **extra):
        return self.client.post(
            "/api/v1/cidoc/assertions/",
            {
                "content_type": ContentType.objects.get_for_model(Deity).pk,
                "object_id": self.deity.pk,
                "asserted_property": "note",
                "asserted_value": "Worshipped at night.",
                **extra,
            },
            format="json",
        )

    def test_a_contributor_assertion_is_always_pending(self):
        resp = self._post(reconciliation_status="accepted", source=str(self.source.pk))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        self.assertEqual(HeritageAssertion.objects.get(pk=resp.json()["id"]).reconciliation_status, "pending")

    def test_the_registry_evidence_slot_sets_the_source(self):
        resp = self._post(was_derived_from_source=str(self.source.pk))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        self.assertEqual(HeritageAssertion.objects.get(pk=resp.json()["id"]).source, self.source)

    def test_slots_with_no_column_are_refused(self):
        resp = self._post(supersedes_assertion="Older claim")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)
        self.assertIn("supersedes_assertion", resp.json())
