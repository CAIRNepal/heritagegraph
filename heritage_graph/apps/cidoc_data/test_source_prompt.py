"""Evidence capture on descriptive records.

Records previously had nowhere to store where their content came from:
provenance existed only on `HeritageAssertion`, and only optionally, so a record
could be created, accepted and published with no evidence trail at all.

These tests pin the contract of the fix: the field exists on every registry
model, it round-trips through the API, it is optional, and coverage is
measurable.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.cidoc_data.test_source_prompt -v2
"""

from apps.cidoc_data.models import Person
from django.apps import apps as django_apps
from django.test import SimpleTestCase, TestCase


class SourceFieldPresenceTests(SimpleTestCase):
    def test_every_registry_model_can_record_a_source(self):
        """A model a contributor can fill in must be able to say where it came from."""
        missing = []
        for model in django_apps.get_app_config("cidoc_data").get_models():
            names = {f.name for f in model._meta.get_fields()}
            # Registry models are the ones carrying the shared MetaData contract.
            if {"title", "description", "contributor", "status"} <= names:
                if "source_citation" not in names or "source" not in names:
                    missing.append(model.__name__)
        self.assertEqual(missing, [], f"models without an evidence field: {missing}")


class SourceCitationTests(TestCase):
    def test_source_is_optional(self):
        """Requiring evidence would exclude genuine oral and community knowledge."""
        person = Person.objects.create(name="Test person", status="pending_review")

        self.assertEqual(person.source_citation, "")
        self.assertIsNone(person.source_id)
        self.assertFalse(person.has_recorded_source)

    def test_free_text_citation_counts_as_a_source(self):
        person = Person.objects.create(
            name="Test person",
            status="pending_review",
            source_citation="Told to me by the temple guthi, March 2026.",
        )

        self.assertTrue(person.has_recorded_source)

    def test_whitespace_only_citation_is_not_a_source(self):
        person = Person.objects.create(
            name="Test person", status="pending_review", source_citation="   "
        )

        self.assertFalse(person.has_recorded_source)


class EntitySourceCoverageTests(TestCase):
    def test_coverage_metric_counts_published_records_only(self):
        from apps.graph.kg_engine.quality import entity_source_coverage

        Person.objects.create(
            name="Sourced", status="accepted", source_citation="A book."
        )
        Person.objects.create(name="Unsourced", status="accepted")
        # Not published, so outside the denominator.
        Person.objects.create(name="Pending", status="pending_review")

        result = entity_source_coverage()

        self.assertEqual(result["published_records"], 2)
        self.assertEqual(result["with_source"], 1)
        self.assertEqual(result["value"], 0.5)

    def test_coverage_is_none_when_nothing_is_published(self):
        from apps.graph.kg_engine.quality import entity_source_coverage

        self.assertIsNone(entity_source_coverage()["value"])
