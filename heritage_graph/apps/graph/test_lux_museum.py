"""Tests for federated museum LUX integration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from apps.graph.kg_engine.lux_museum import (
    LuxLink,
    discover_lux_links,
    fetch_museum_projection_with_lux,
    is_lux_stub_uri,
)


class LuxMuseumHelpersTest(SimpleTestCase):
    def test_is_lux_stub_uri(self):
        self.assertTrue(
            is_lux_stub_uri(
                "https://w3id.org/heritagegraph/imported/lux/place/abc-123"
            )
        )
        self.assertFalse(
            is_lux_stub_uri("https://w3id.org/heritagegraph/resource/person/1")
        )

    @override_settings(
        RDF_RESOURCE_BASE_URI="https://w3id.org/heritagegraph/resource/",
        RDF_PUBLIC_GRAPH_URI="https://w3id.org/heritagegraph/graph/public",
        RDF_LUX_IMPORTED_GRAPH_URI="https://w3id.org/heritagegraph/imported/lux",
    )
    def test_discover_lux_links_exact_match(self):
        store = MagicMock()
        store.select.side_effect = [
            [
                {
                    "curated": "https://w3id.org/heritagegraph/resource/person/1",
                    "lux": "https://w3id.org/heritagegraph/imported/lux/person/p1",
                    "external": "https://lux.collections.yale.edu/person/abc",
                }
            ],
        ]
        links = discover_lux_links(
            store=store,
            curated_iris={"https://w3id.org/heritagegraph/resource/person/1"},
            curated_labels={
                "https://w3id.org/heritagegraph/resource/person/1": "Test Person"
            },
            link_limit=10,
            label_match_limit=0,
        )
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0].method, "exactMatch")
        self.assertEqual(
            links[0].lux,
            "https://w3id.org/heritagegraph/imported/lux/person/p1",
        )

    @override_settings(
        RDF_RESOURCE_BASE_URI="https://w3id.org/heritagegraph/resource/",
        RDF_PUBLIC_GRAPH_URI="https://w3id.org/heritagegraph/graph/public",
        RDF_LUX_IMPORTED_GRAPH_URI="https://w3id.org/heritagegraph/imported/lux",
        RDF_LUX_LINKED_NODE_LIMIT=10,
        RDF_LUX_LABEL_MATCH_LIMIT=0,
    )
    @patch("apps.graph.kg_engine.lux_museum.fetch_graph_projection")
    @patch("apps.graph.kg_engine.lux_museum.discover_lux_links")
    def test_fetch_museum_projection_merges_layers(
        self, mock_discover, mock_curated
    ):
        mock_curated.return_value = {
            "nodes": [
                {
                    "s": "https://w3id.org/heritagegraph/resource/person/1",
                    "type": "https://w3id.org/heritagegraph/Person",
                    "label": "Curated",
                }
            ],
            "edges": [],
        }
        mock_discover.return_value = [
            LuxLink(
                curated="https://w3id.org/heritagegraph/resource/person/1",
                lux="https://w3id.org/heritagegraph/imported/lux/person/p1",
                external="https://lux.collections.yale.edu/person/abc",
                method="exactMatch",
            )
        ]
        store = MagicMock()
        store.select.side_effect = [
            [
                {
                    "s": "https://w3id.org/heritagegraph/imported/lux/person/p1",
                    "type": "https://w3id.org/heritagegraph/Person",
                    "label": "LUX Person",
                    "external": "https://lux.collections.yale.edu/person/abc",
                }
            ],
            [],
        ]
        out = fetch_museum_projection_with_lux(store=store)
        self.assertEqual(len(out["lux_links"]), 1)
        self.assertEqual(len(out["nodes"]), 2)
        self.assertEqual(len(out["edges"]), 1)
        self.assertIn("exactMatch", out["edges"][0]["p"])
