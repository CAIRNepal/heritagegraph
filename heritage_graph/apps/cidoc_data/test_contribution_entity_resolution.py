"""Tests for contribution-time entity resolution."""

from apps.cidoc_data.contribution_entity_resolution import resolve_contribution_identity
from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.identity_validation import (
    labels_are_auto_mergeable,
    labels_are_similar,
    normalize_label,
)
from apps.cidoc_data.identity_services import active_memberships_for_subject
from apps.cidoc_data.models import EntityCluster, HeritageAssertion, IdentityResolutionCandidate, Location
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase


class IdentityLabelMatchTests(TestCase):
    def test_normalize_strips_punctuation(self):
        self.assertEqual(normalize_label("Pashupatinath Temple"), "pashupatinathtemple")

    def test_similar_labels(self):
        self.assertTrue(labels_are_similar("Pashupatinath", "Pashupatinath Temple"))
        self.assertFalse(labels_are_similar("Pashupatinath", "Boudhanath"))
        self.assertFalse(labels_are_auto_mergeable("L", "Lumbini"))
        self.assertFalse(
            labels_are_auto_mergeable("Paubha of Green Tara", "Paubha of Vasudhara")
        )


class ContributionEntityResolutionTests(TestCase):
    def setUp(self):
        self.ct = ContentType.objects.get_for_model(Location)

    def _bootstrap_cluster(self, loc: Location, label: str) -> EntityCluster:
        cluster = EntityCluster.objects.create(
            canonical_label=label,
            type_scope="location",
        )
        ha = HeritageAssertion(
            content_type=self.ct,
            object_id=loc.pk,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            entity_cluster=cluster,
            reconciliation_status="accepted",
            confidence="certain",
            contributed_by="test",
        )
        ha.full_clean()
        ha.save()
        return cluster

    def test_exact_match_links_existing_cluster(self):
        existing = Location.objects.create(name="Pashupatinath", contributor="a")
        self._bootstrap_cluster(existing, "Pashupatinath")

        new_loc = Location.objects.create(name="Pashupatinath", contributor="b")
        result = resolve_contribution_identity(new_loc, contributed_by="user_b")

        self.assertEqual(result.outcome, "linked_existing")
        self.assertTrue(result.candidate_id)
        self.assertTrue(
            IdentityResolutionCandidate.objects.filter(
                status="open",
                signal_scores__rule="duplicate_contribution_same_cluster",
            ).exists()
        )
        mem = active_memberships_for_subject(self.ct, new_loc.pk).first()
        self.assertIsNotNone(mem)
        existing_mem = active_memberships_for_subject(self.ct, existing.pk).first()
        self.assertEqual(mem.entity_cluster_id, existing_mem.entity_cluster_id)
        self.assertEqual(
            EntityCluster.objects.filter(type_scope="location", merged_into__isnull=True).count(),
            1,
        )

    def test_similar_match_queues_candidate(self):
        existing = Location.objects.create(name="Pashupatinath", contributor="a")
        self._bootstrap_cluster(existing, "Pashupatinath")

        new_loc = Location.objects.create(
            name="Pashupatinath Temple",
            contributor="b",
        )
        result = resolve_contribution_identity(new_loc, contributed_by="user_b")

        self.assertEqual(result.outcome, "candidate_queued")
        self.assertTrue(
            IdentityResolutionCandidate.objects.filter(status="open").exists()
        )
        mem = active_memberships_for_subject(self.ct, new_loc.pk).first()
        self.assertIsNotNone(mem)
        self.assertNotEqual(
            mem.entity_cluster_id,
            active_memberships_for_subject(self.ct, existing.pk).first().entity_cluster_id,
        )

    def test_no_match_creates_singleton(self):
        Location.objects.create(name="Bhaktapur Durbar Square", contributor="a")
        new_loc = Location.objects.create(name="Patan Durbar Square", contributor="b")
        result = resolve_contribution_identity(new_loc, contributed_by="user_b")

        self.assertEqual(result.outcome, "singleton_created")
        self.assertTrue(
            active_memberships_for_subject(self.ct, new_loc.pk).exists()
        )

    def test_skips_when_membership_exists(self):
        loc = Location.objects.create(name="Swayambhunath", contributor="a")
        cluster = self._bootstrap_cluster(loc, "Swayambhunath")
        result = resolve_contribution_identity(loc, contributed_by="user_a")
        self.assertEqual(result.outcome, "skipped")
        self.assertEqual(result.cluster_id, str(cluster.id))
