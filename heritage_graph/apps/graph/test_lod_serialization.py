"""Dereferenced resources must round-trip their RDF terms exactly.

The LOD view used to hand-format Turtle and JSON-LD from bare SELECT strings,
which dropped language tags and datatypes, left newlines unescaped (invalid
Turtle), turned any literal starting with "http" into an IRI, and let JSON-LD
overwrite repeated predicates.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.graph.test_lod_serialization -v2
"""

import json
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from rdflib import RDFS, XSD, Graph, Literal, URIRef

BASE = "https://cair-nepal.org/heritagegraph/resource/"
SUBJECT = URIRef(BASE + "tradition/37")
HG = "https://cair-nepal.org/heritagegraph/"

ROWS = [
    {"p": str(RDFS.label), "o": "Kumari Worship", "kind": "literal", "lang": "en",
     "dt": "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"},
    {"p": str(RDFS.label), "o": "Kumari Worship", "kind": "literal",
     "dt": str(XSD.string)},
    {"p": HG + "date_earliest", "o": "1757-01-01", "kind": "literal",
     "dt": str(XSD.date)},
    {"p": str(RDFS.comment), "o": 'Line one\nLine "two"', "kind": "literal",
     "dt": str(XSD.string)},
    {"p": HG + "note", "o": "http://not-an-iri", "kind": "literal",
     "dt": str(XSD.string)},
    {"p": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
     "o": HG + "ReligiousTradition", "kind": "iri"},
    {"p": HG + "associated_with", "o": BASE + "person/1", "kind": "iri"},
    {"p": HG + "associated_with", "o": BASE + "person/2", "kind": "iri"},
]

EXPECTED = {
    (RDFS.label, Literal("Kumari Worship", lang="en")),
    (RDFS.label, Literal("Kumari Worship")),
    (URIRef(HG + "date_earliest"), Literal("1757-01-01", datatype=XSD.date)),
    (RDFS.comment, Literal('Line one\nLine "two"')),
    (URIRef(HG + "note"), Literal("http://not-an-iri")),
    (URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
     URIRef(HG + "ReligiousTradition")),
    (URIRef(HG + "associated_with"), URIRef(BASE + "person/1")),
    (URIRef(HG + "associated_with"), URIRef(BASE + "person/2")),
}


@override_settings(RDF_RESOURCE_BASE_URI=BASE)
class LodSerializationTests(SimpleTestCase):
    def _fetch(self, accept):
        with patch("apps.graph.lod_views.get_kg_engine") as engine:
            engine.return_value.query.return_value = ROWS
            return self.client.get("/lod/resource/tradition/37", HTTP_ACCEPT=accept)

    def _parsed(self, accept, fmt):
        response = self._fetch(accept)
        self.assertEqual(response.status_code, 200, response.content[:200])
        graph = Graph().parse(data=response.content.decode(), format=fmt)
        return {(p, o) for s, p, o in graph if s == SUBJECT}

    def test_turtle_keeps_every_term_exact(self):
        self.assertEqual(self._parsed("text/turtle", "turtle"), EXPECTED)

    def test_ntriples_keeps_every_term_exact(self):
        self.assertEqual(self._parsed("application/n-triples", "nt"), EXPECTED)

    def test_jsonld_keeps_every_term_exact(self):
        self.assertEqual(self._parsed("application/ld+json", "json-ld"), EXPECTED)

    def test_rdfxml_keeps_every_term_exact(self):
        self.assertEqual(self._parsed("application/rdf+xml", "xml"), EXPECTED)

    def test_jsonld_is_valid_json(self):
        json.loads(self._fetch("application/ld+json").content)

    def test_html_is_a_see_other_redirect(self):
        response = self._fetch("text/html")
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response["Location"], "/knowledge/tradition/37")
