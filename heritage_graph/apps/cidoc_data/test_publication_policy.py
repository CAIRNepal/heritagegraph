"""Tests for curation-gated RDF publication policy."""

from django.test import SimpleTestCase

from apps.cidoc_data.publication_policy import (
    PUBLISHED_STATUSES,
    WITHHELD_STATUSES,
    is_curated_assertion,
    is_published_for_rdf,
)


class _Stub:
    def __init__(self, status=None, contributed_by=""):
        self.status = status
        self.contributed_by = contributed_by
        self.reconciliation_status = "accepted"


class PublicationPolicyTests(SimpleTestCase):
    def test_published_statuses(self):
        self.assertIn("accepted", PUBLISHED_STATUSES)
        self.assertIn("published", PUBLISHED_STATUSES)

    def test_legacy_null_is_public(self):
        self.assertTrue(is_published_for_rdf(_Stub(None)))
        self.assertTrue(is_published_for_rdf(_Stub("")))

    def test_withheld_statuses(self):
        for s in WITHHELD_STATUSES:
            self.assertFalse(is_published_for_rdf(_Stub(s)))

    def test_explicit_published(self):
        self.assertTrue(is_published_for_rdf(_Stub("accepted")))
        self.assertTrue(is_published_for_rdf(_Stub("published")))

    def test_test_assertions_excluded(self):
        self.assertFalse(is_curated_assertion(_Stub(contributed_by="test-seed")))
        self.assertTrue(is_curated_assertion(_Stub(contributed_by="curator@example.com")))
