"""Tests for curation-gated RDF publication policy."""

from apps.cidoc_data.publication_policy import (
    PUBLISHED_STATUSES,
    WITHHELD_STATUSES,
    has_publishable_label,
    is_curated_assertion,
    is_published_for_rdf,
)
from django.test import SimpleTestCase


class _Stub:
    def __init__(self, status=None, contributed_by=""):
        self.status = status
        self.contributed_by = contributed_by
        self.reconciliation_status = "accepted"


class _NamedStub(_Stub):
    """Stub that carries a label field, like every concrete MetaData model."""

    def __init__(self, status=None, name="Nyatapola Temple", title=""):
        super().__init__(status=status)
        self.name = name
        self.title = title


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


class PublishableLabelTests(SimpleTestCase):
    """A row nobody can identify must not reach the public surface."""

    def test_real_name_publishes(self):
        self.assertTrue(has_publishable_label(_NamedStub()))
        self.assertTrue(is_published_for_rdf(_NamedStub("accepted")))

    def test_single_character_name_is_withheld(self):
        # Real defects observed in graph/public: structures labelled "S" and a
        # place labelled "L", rendered beside genuine heritage records.
        for stray in ("S", "L", "x", " s "):
            self.assertFalse(has_publishable_label(_NamedStub(name=stray)))
            self.assertFalse(is_published_for_rdf(_NamedStub("published", name=stray)))

    def test_empty_name_is_withheld(self):
        self.assertFalse(has_publishable_label(_NamedStub(name="")))
        self.assertFalse(is_published_for_rdf(_NamedStub("accepted", name="")))

    def test_title_is_accepted_when_name_is_blank(self):
        self.assertTrue(has_publishable_label(_NamedStub(name="", title="Krishna Mandir")))

    def test_approved_status_cannot_override_a_missing_label(self):
        for status in PUBLISHED_STATUSES:
            self.assertFalse(is_published_for_rdf(_NamedStub(status, name="")))

    def test_abstains_without_a_label_field(self):
        self.assertTrue(has_publishable_label(_Stub("accepted")))
