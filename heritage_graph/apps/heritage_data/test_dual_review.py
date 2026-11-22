"""Culturally sensitive records need two independent reviewers."""

import tempfile

from apps.cidoc_data.models import CasteGroup, Deity
from apps.heritage_data.models import CulturalEntity, ReviewerRole
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()
_TMP = tempfile.mkdtemp(prefix="hg_dual_review_")


@override_settings(OXIGRAPH_STORE_PATH=_TMP, RDF_SYNC_ENABLED=False)
class DualReviewTest(APITestCase):
    def setUp(self):
        self.contributor = User.objects.create_user(
            username="author", email="a@example.com", password="pw"
        )
        self.r1 = User.objects.create_user(
            username="first", email="1@example.com", password="pw"
        )
        self.r2 = User.objects.create_user(
            username="second", email="2@example.com", password="pw"
        )
        for u in (self.r1, self.r2):
            ReviewerRole.objects.create(user=u, role="expert_curator")

    def _submit(self, endpoint, **extra):
        self.client.force_authenticate(user=self.contributor)
        resp = self.client.post(
            f"/api/v1/cidoc/{endpoint}/",
            {"name": "Record", "source_citation": "Field notes, 2026.", **extra},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        return CulturalEntity.objects.get(entity_id=resp.json()["cultural_entity_id"])

    def _accept(self, entity, reviewer):
        self.client.force_authenticate(user=reviewer)
        return self.client.post(
            f"/api/v1/data/api/review-workspace/{entity.entity_id}/decide/",
            {
                "verdict": "accept",
                "conflict_handling": "not_applicable",
                "feedback": "ok",
            },
            format="json",
        )

    def test_a_caste_record_needs_a_second_reviewer(self):
        entity = self._submit("caste_groups")
        first = self._accept(entity, self.r1)
        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED, first.content)
        self.assertEqual(first.json()["approvals"], ["first"])
        entity.refresh_from_db()
        self.assertEqual(entity.status, "pending_review")
        self.assertNotEqual(
            CasteGroup.objects.get(pk=entity.cidoc_object_id).status, "accepted"
        )

        ws = self.client.get(
            f"/api/v1/data/api/review-workspace/{entity.entity_id}/"
        ).json()
        self.assertTrue(ws["dual_review"]["required"])
        self.assertEqual(ws["dual_review"]["approvals"], ["first"])

        second = self._accept(entity, self.r2)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.content)
        entity.refresh_from_db()
        self.assertEqual(entity.status, "accepted")

    def test_the_same_reviewer_twice_is_still_one_approval(self):
        entity = self._submit("caste_groups")
        self._accept(entity, self.r1)
        again = self._accept(entity, self.r1)
        self.assertEqual(again.status_code, status.HTTP_202_ACCEPTED, again.content)
        entity.refresh_from_db()
        self.assertEqual(entity.status, "pending_review")

    def test_a_restricted_tier_needs_two_reviewers(self):
        entity = self._submit("deities", access_tier="community_only")
        self.assertEqual(
            self._accept(entity, self.r1).status_code, status.HTTP_202_ACCEPTED
        )

    def test_an_ordinary_record_needs_one(self):
        entity = self._submit("deities")
        self.assertEqual(
            self._accept(entity, self.r1).status_code, status.HTTP_201_CREATED
        )
        entity.refresh_from_db()
        self.assertEqual(entity.status, "accepted")
        self.assertEqual(
            Deity.objects.get(pk=entity.cidoc_object_id).status, "accepted"
        )
