"""Edges on ontology-slot predicates must carry their assertion's provenance.

The provenance map was keyed on the relationship code while edges carry the
published predicate IRI, so `has_current_location` (published as
crm:P55_has_current_location) never matched; and it read `source.title`, a
field DataSource does not have, so a registered source never showed.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test apps.graph.test_edge_provenance -v2
"""

from apps.cidoc_data.models import (
    ArchitecturalStructure,
    DataSource,
    HeritageAssertion,
    Location,
)
from apps.graph.kg_engine.uris import relationship_predicate_uri
from apps.graph.views import _assertion_provenance_map
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase, override_settings

BASE = "https://cair-nepal.org/heritagegraph/resource/"


@override_settings(RDF_SYNC_ENABLED=False, RDF_RESOURCE_BASE_URI=BASE)
class EdgeProvenanceTests(TestCase):
    def test_slot_predicate_edge_finds_its_provenance_and_source_name(self):
        place = Location.objects.create(name="Bhaktapur")
        temple = ArchitecturalStructure.objects.create(
            name="Nyatapola Temple", structure_type="Temple"
        )
        source = DataSource.objects.create(name="Wikidata", source_type="web")
        HeritageAssertion.objects.create(
            content_type=ContentType.objects.get_for_model(temple),
            object_id=temple.pk,
            object_content_type=ContentType.objects.get_for_model(place),
            object_object_id=place.pk,
            asserted_property="relationship.has_current_location",
            source=source,
            source_citation="Wikidata Q1513892 P131 Q2",
            reconciliation_status="accepted",
            contributed_by="wikidata_import",
        )

        predicate = relationship_predicate_uri("relationship.has_current_location")
        self.assertTrue(predicate.endswith("P55_has_current_location"))
        prov = _assertion_provenance_map()[
            (f"{BASE}structure/{temple.pk}", predicate, f"{BASE}location/{place.pk}")
        ]
        self.assertEqual(prov["source"], "Wikidata")
        self.assertEqual(prov["citation"], "Wikidata Q1513892 P131 Q2")
        self.assertEqual(prov["assertedBy"], "wikidata_import")
