"""Tests for PUBLIC graph pollution detection (linkset model)."""

from apps.graph.kg_engine.uris import (
    is_non_curated_instance_iri,
    is_public_graph_pollution,
)
from django.test import SimpleTestCase

PREFIX = "https://w3id.org/heritagegraph/resource/"


class PublicGraphPollutionTests(SimpleTestCase):
    def test_ontology_class_is_not_pollution(self):
        iri = "https://w3id.org/heritagegraph/Monument"
        self.assertFalse(is_non_curated_instance_iri(iri))

    def test_lux_instance_is_pollution(self):
        iri = "https://lux.collections.yale.edu/object/abc"
        self.assertTrue(is_non_curated_instance_iri(iri))

    def test_rdf_type_triple_not_pollution(self):
        subj = f"{PREFIX}monument/1"
        typ = "https://w3id.org/heritagegraph/Monument"
        self.assertFalse(is_public_graph_pollution(subject=subj, object_iri=typ))

    def test_skos_exactmatch_to_wikidata_not_pollution(self):
        subj = f"{PREFIX}monument/1"
        wd = "http://www.wikidata.org/entity/Q123"
        self.assertFalse(is_public_graph_pollution(subject=subj, object_iri=wd))

    def test_imported_lux_edge_is_pollution(self):
        subj = f"{PREFIX}monument/1"
        lux = "https://w3id.org/heritagegraph/imported/lux/stub/1"
        self.assertTrue(is_public_graph_pollution(subject=subj, object_iri=lux))
