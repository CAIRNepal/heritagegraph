"""Tests for evidence-weighted canonical record selection."""

from apps.cidoc_data.canonical_record_selection import (
    completeness_score,
    rank_cluster_members,
    select_canonical_member,
)
from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.models import EntityCluster, HeritageAssertion, Location
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase


class CanonicalRecordSelectionTests(TestCase):
    def setUp(self):
        self.ct = ContentType.objects.get_for_model(Location)

    def _membership(self, loc: Location, cluster: EntityCluster) -> None:
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

    def test_richer_record_wins(self):
        cluster = EntityCluster.objects.create(
            canonical_label="Pashupatinath Temple",
            type_scope="location",
        )
        thin = Location.objects.create(
            name="Pashupatinath Temple",
            contributor="a",
            status="pending_review",
        )
        rich = Location.objects.create(
            name="Pashupatinath Temple",
            contributor="b",
            description="UNESCO World Heritage Site on the Bagmati with detailed history.",
            status="accepted",
            coordinates_legacy="27.7104, 85.3486",
        )
        self._membership(thin, cluster)
        self._membership(rich, cluster)

        self.assertGreater(completeness_score(rich), completeness_score(thin))
        canonical = select_canonical_member(cluster)
        self.assertIsNotNone(canonical)
        self.assertEqual(canonical["entity_id"], rich.pk)

        ranked = rank_cluster_members(cluster)
        self.assertEqual(ranked[0]["entity_id"], rich.pk)
