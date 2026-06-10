"""Tests for museum graph ORM enrichment (geo + temporal)."""

from apps.cidoc_data.models import Location, Monument
from apps.graph.kg_engine.museum_graph_enrichment import (
    coords_from_instance,
    enrich_museum_graph_nodes,
    parse_resource_uri,
    temporal_hint_from_instance,
)
from apps.graph.kg_engine.uris import resource_base
from django.test import TestCase


class MuseumGraphEnrichmentTests(TestCase):
    def test_parse_resource_uri(self):
        base = resource_base().rstrip("/")
        hit = parse_resource_uri(f"{base}/monument/12")
        self.assertEqual(hit, ("monument", 12))
        self.assertIsNone(parse_resource_uri("https://example.org/other/1"))

    def test_temporal_from_monument(self):
        m = Monument.objects.create(
            name="Test Stupa",
            construction_date="c. 5th century CE",
        )
        self.assertEqual(temporal_hint_from_instance(m), "c. 5th century CE")

    def test_coords_from_known_place_label(self):
        loc = Location.objects.create(
            name="Swayambhunath",
            type="temple",
            current_status="active",
        )
        coords = coords_from_instance(loc)
        self.assertIsNotNone(coords)
        lat, lng = coords
        self.assertAlmostEqual(float(lat), 27.7149, places=2)
        self.assertAlmostEqual(float(lng), 85.2903, places=2)

    def test_propagate_coords_along_location_edge(self):
        base = resource_base().rstrip("/")
        place_iri = f"{base}/location/1"
        monument_iri = f"{base}/monument/2"
        nodes = {
            place_iri: {
                "id": place_iri,
                "label": "Pashupatinath",
                "lat": None,
                "long": None,
                "inceptionYear": None,
            },
            monument_iri: {
                "id": monument_iri,
                "label": "Test Monument",
                "lat": None,
                "long": None,
                "inceptionYear": None,
            },
        }
        edges = [
            {
                "source": monument_iri,
                "target": place_iri,
                "predicate": f"{base}/located_at",
                "predicateLocal": "located_at",
            }
        ]
        enrich_museum_graph_nodes(nodes, edges)
        self.assertIsNotNone(nodes[place_iri]["lat"])
        self.assertIsNotNone(nodes[monument_iri]["lat"])
        self.assertEqual(nodes[monument_iri]["lat"], nodes[place_iri]["lat"])

    def test_wikimedia_images_for_known_label(self):
        base = resource_base().rstrip("/")
        monument_iri = f"{base}/monument/99"
        nodes = {
            monument_iri: {
                "id": monument_iri,
                "label": "Boudhanath Stupa",
                "lat": None,
                "long": None,
                "inceptionYear": None,
                "comment": None,
            },
        }
        enrich_museum_graph_nodes(nodes, [])
        self.assertTrue(nodes[monument_iri].get("imageUrl"))
        self.assertTrue(nodes[monument_iri].get("images"))
        self.assertEqual(nodes[monument_iri].get("imageSource"), "demo_wikimedia_label_match")
        self.assertIn("Buddha", nodes[monument_iri].get("comment") or "")
        self.assertEqual(
            nodes[monument_iri].get("narrativeSource"),
            "demo_corpus_label_match",
        )
