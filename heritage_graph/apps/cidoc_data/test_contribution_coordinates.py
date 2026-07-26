"""Contributed coordinates must reach the map layer.

Before this, no contribute form could capture a coordinate. The registry
exposed a single `place_coordinates` slot typed as free text on Place only,
while the API's real contract is the `latitude`/`longitude` pair that the CIDOC
serializers fold into the `point` column. Structures and monuments had a
`point` column and no form field at all, so a newly contributed place could
only ever appear on the Atlas if its name happened to match the hardcoded
gazetteer in `museum_graph_enrichment`.
"""

import json
from pathlib import Path

from apps.cidoc_data.models import ArchitecturalStructure, Location, Monument
from apps.graph.kg_engine.museum_graph_enrichment import coords_from_instance
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

REGISTRY_JSON = (
    Path(__file__).resolve().parents[3]
    / "heritage_graph_ui"
    / "src"
    / "lib"
    / "ontology"
    / "registry.generated.json"
)


class ContributedCoordinatesTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("mapper", password="x", is_staff=True)

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_registry_exposes_a_geo_widget_for_every_model_with_a_point_column(self):
        classes = json.loads(REGISTRY_JSON.read_text())["classes"]
        for key in ("location", "structure", "monument"):
            geo = [f for f in classes[key]["fields"] if f["type"] == "geo_point"]
            self.assertTrue(
                geo,
                f"{key} has a `point` column but no geo_point field on its form",
            )

    def test_structure_contribution_persists_coordinates_for_the_map(self):
        anchor = Location.objects.create(
            name="Anchor Place", type="temple", current_status="preserved"
        )
        resp = self.client.post(
            "/api/v1/cidoc/structures/",
            {
                "name": "Coordinate Test Temple",
                "structure_type": "Temple",
                "has_current_location": anchor.pk,
                # Exactly what buildOntologyFormPayload now sends for geo_point.
                "latitude": "27.7042",
                "longitude": "85.3076",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)

        structure = ArchitecturalStructure.objects.get(pk=resp.json()["id"])
        self.assertTrue(structure.point, "coordinates did not reach the point column")
        self.assertEqual(coords_from_instance(structure), ("27.7042", "85.3076"))

        # And the API reads them back in the shape the form re-hydrates from.
        detail = self.client.get(f"/api/v1/cidoc/structures/{structure.pk}/")
        self.assertEqual(float(detail.json()["latitude"]), 27.7042)
        self.assertEqual(float(detail.json()["longitude"]), 85.3076)

    def test_monument_contribution_persists_coordinates(self):
        resp = self.client.post(
            "/api/v1/cidoc/monuments/",
            {
                "name": "Coordinate Test Stupa",
                "latitude": "27.7215",
                "longitude": "85.3620",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        monument = Monument.objects.get(pk=resp.json()["id"])
        self.assertEqual(coords_from_instance(monument), ("27.7215", "85.362"))

    def test_contributed_coordinates_project_to_rdf_wkt(self):
        """The point column must reach RDF as geo:asWKT POINT(lon lat) — not
        only the JSON enrichment layer — so SPARQL/LOD consumers get geometry."""
        from apps.cidoc_data.rdf_entity_projection import (
            tripleset_for_metadata_instance,
        )
        from apps.cidoc_data.rdf_publish import (
            label_for_instance,
            resource_uri_for_instance,
        )

        resp = self.client.post(
            "/api/v1/cidoc/structures/",
            {
                "name": "WKT Projection Temple",
                "structure_type": "Temple",
                "latitude": "27.7042",
                "longitude": "85.3076",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        structure = ArchitecturalStructure.objects.get(pk=resp.json()["id"])

        triples, _managed = tripleset_for_metadata_instance(
            structure,
            resource_uri_fn=resource_uri_for_instance,
            label_fn=label_for_instance,
        )
        wkt_literals = [
            t.literal[0]
            for t in triples
            if t.literal and "wktLiteral" in (t.literal[1] or "")
        ]
        # WKT is longitude-first.
        self.assertIn("POINT(85.3076 27.7042)", wkt_literals)

    def test_coordinates_are_independent_of_the_hardcoded_gazetteer(self):
        """A place with no gazetteer entry still gets coordinates."""
        resp = self.client.post(
            "/api/v1/cidoc/locations/",
            {
                "name": "Somewhere Not In The Gazetteer",
                "latitude": "28.1234",
                "longitude": "84.5678",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        loc = Location.objects.get(pk=resp.json()["id"])
        self.assertEqual(coords_from_instance(loc), ("28.1234", "84.5678"))
