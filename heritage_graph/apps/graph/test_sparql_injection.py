"""User-supplied IRIs must not be able to rewrite a SPARQL query.

Two AllowAny endpoints interpolate caller input into `<...>` and query the store
directly, bypassing the CARE access-tier filters that `CARESparqlProxyView`
injects. An injected UNION there would read across named graphs, including rows
withheld as `sensitive_indigenous` or `community_only`.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.graph.test_sparql_injection -v2
"""

from apps.graph.kg_engine.uris import is_safe_iri
from django.test import SimpleTestCase, TestCase

BREAKOUT = "https://example.org/a> . ?s ?p ?o } UNION { GRAPH ?g { ?s ?p ?o "


class IsSafeIriTests(SimpleTestCase):
    def test_accepts_a_normal_resource_iri(self):
        self.assertTrue(is_safe_iri("https://w3id.org/heritagegraph/resource/person/1"))

    def test_rejects_iri_closing_the_angle_brackets(self):
        self.assertFalse(is_safe_iri(BREAKOUT))

    def test_rejects_each_query_structuring_character(self):
        for ch in '<>"{}|\\^`':
            with self.subTest(char=ch):
                self.assertFalse(is_safe_iri(f"https://example.org/a{ch}b"))

    def test_rejects_whitespace_and_control_characters(self):
        for ch in (" ", "\t", "\n", "\r"):
            with self.subTest(char=repr(ch)):
                self.assertFalse(is_safe_iri(f"https://example.org/a{ch}b"))

    def test_rejects_non_http_schemes(self):
        self.assertFalse(is_safe_iri("ftp://example.org/a"))
        self.assertFalse(is_safe_iri("javascript:alert(1)"))

    def test_rejects_unbounded_length(self):
        self.assertFalse(is_safe_iri("https://example.org/" + "a" * 600))

    def test_rejects_empty(self):
        self.assertFalse(is_safe_iri(""))
        self.assertFalse(is_safe_iri(None))


class InjectionEndpointTests(TestCase):
    def test_neighborhood_rejects_a_breakout_iri(self):
        response = self.client.get("/cidoc/kg/neighborhood/", {"uri": BREAKOUT})

        self.assertEqual(response.status_code, 400)
        self.assertIn("uri", response.json()["error"])

    def test_neighborhood_still_accepts_a_valid_iri(self):
        response = self.client.get(
            "/cidoc/kg/neighborhood/",
            {"uri": "https://w3id.org/heritagegraph/resource/person/1"},
        )

        self.assertEqual(response.status_code, 200)

    def test_lod_dereference_rejects_a_breakout_path(self):
        response = self.client.get("/lod/resource/a> . ?s ?p ?o } UNION { ?a ?b ?c ")

        self.assertEqual(response.status_code, 404)
