"""Contributor terms, leaderboard opt-out and pseudonymization."""

from io import StringIO

from apps.cidoc_data.models import Deity, HeritageAssertion
from apps.heritage_data.contributor_terms import TERMS_VERSION
from apps.heritage_data.models import UserProfile
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


@override_settings(CONTRIBUTOR_TERMS_REQUIRED=True, RDF_SYNC_ENABLED=False)
class ContributorTermsTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="newcomer", email="n@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def _contribute(self):
        return self.client.post(
            "/api/v1/cidoc/deities/",
            {"name": "Vishnu", "source_citation": "A book."},
            format="json",
        )

    def test_a_contribution_waits_for_the_terms(self):
        resp = self._contribute()
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.assertEqual(resp.json()["code"], "contributor_terms_required")
        self.assertFalse(Deity.objects.exists())

        consent = self.client.post(
            "/api/v1/data/api/contributor-consent/", {"accept": True}, format="json"
        )
        self.assertEqual(consent.status_code, status.HTTP_200_OK, consent.content)
        self.assertTrue(consent.json()["accepted"])
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.contributor_terms_version, TERMS_VERSION)
        self.assertIsNotNone(profile.contributor_terms_accepted_at)

        self.assertEqual(self._contribute().status_code, status.HTTP_201_CREATED)

    def test_new_terms_ask_again(self):
        UserProfile.objects.update_or_create(
            user=self.user, defaults={"contributor_terms_version": "2000-01-01"}
        )
        self.assertEqual(self._contribute().status_code, status.HTTP_403_FORBIDDEN)

    def test_a_qr_visitor_confirms_the_terms_inline(self):
        self.client.force_authenticate(user=None)
        body = {
            "entity_name": "Nyatapola",
            "contribution_type": "history",
            "content": "Built in 1702.",
        }
        refused = self.client.post(
            "/api/v1/data/api/public-contributions/", body, format="json"
        )
        self.assertEqual(
            refused.status_code, status.HTTP_400_BAD_REQUEST, refused.content
        )
        self.assertIn("accepts_terms", refused.json())
        ok = self.client.post(
            "/api/v1/data/api/public-contributions/",
            {**body, "accepts_terms": True},
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.content)


@override_settings(RDF_SYNC_ENABLED=False)
class LeaderboardOptOutTest(APITestCase):
    def test_an_opted_out_contributor_is_not_ranked(self):
        from apps.heritage_data.models import CulturalEntity

        shy = User.objects.create_user(
            username="shy", email="shy@example.com", password="pw"
        )
        CulturalEntity.objects.create(
            name="x",
            description="",
            category="other",
            status="accepted",
            contributor=shy,
        )
        self.client.force_authenticate(user=shy)
        def names():
            resp = self.client.get("/api/v1/data/leaderboard/")
            return {u.get("username") for u in resp.json().get("results", [])}
        self.assertIn("shy", names())
        resp = self.client.post(
            "/api/v1/data/api/contributor-consent/",
            {"show_on_leaderboard": False},
            format="json",
        )
        self.assertFalse(resp.json()["show_on_leaderboard"])
        self.assertNotIn("shy", names())


@override_settings(RDF_SYNC_ENABLED=False)
class PseudonymizeTest(APITestCase):
    def test_attribution_is_replaced_everywhere(self):
        user = User.objects.create_user(
            username="leaving", email="l@example.com", password="pw", first_name="Real"
        )
        UserProfile.objects.create(user=user, organization="An Org")
        deity = Deity.objects.create(
            name="Vishnu", status="accepted", contributor="leaving"
        )
        ha = HeritageAssertion.objects.create(
            content_type=ContentType.objects.get_for_model(Deity),
            object_id=deity.pk,
            asserted_property="note",
            asserted_value="x",
            confidence="likely",
            contributed_by="l@example.com",
            attributed_to_agent="leaving",
        )
        call_command("pseudonymize_contributor", "leaving", stdout=StringIO())
        user.refresh_from_db()
        deity.refresh_from_db()
        ha.refresh_from_db()
        self.assertTrue(user.username.startswith("contributor-"))
        self.assertEqual(deity.contributor, user.username)
        self.assertEqual(ha.contributed_by, user.username)
        self.assertEqual(ha.attributed_to_agent, user.username)
        self.assertEqual(user.first_name, "")
        self.assertEqual(user.profile.organization, "")
        self.assertFalse(user.profile.show_on_leaderboard)
        self.assertTrue(user.is_active)
