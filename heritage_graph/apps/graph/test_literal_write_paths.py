"""Literals written to the store must be valid RDF with full datatype IRIs.

Projection code passes datatypes as CURIEs ("xsd:string"). Written verbatim
they became the IRI <xsd:string> (scheme "xsd"), and line breaks were left
raw inside short-quoted strings, which SPARQL rejects -- so an entity with a
multi-line description silently failed to project over HTTP.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.graph.test_literal_write_paths -v2
"""

from unittest.mock import patch

from apps.cidoc_data.rdf_entity_projection import _Triple, _triple_to_line
from apps.graph.kg_engine.store import KnowledgeGraphStore
from django.test import SimpleTestCase
from rdflib import XSD, Graph, Literal, URIRef

S = "https://cair-nepal.org/heritagegraph/resource/place/1"
P = "http://www.w3.org/2000/01/rdf-schema#comment"


def _parse_line(line: str) -> Literal:
    # _triple_to_line emits SPARQL/Turtle terms (``^^xsd:date``), not N-Triples.
    data = f"@prefix xsd: <{XSD}> .\n{line.strip()}"
    graph = Graph().parse(data=data, format="turtle")
    ((_, _, obj),) = list(graph)
    return obj


class TripleToLineTests(SimpleTestCase):
    def test_curie_datatype_is_expanded(self):
        line = _triple_to_line(_Triple(S, P, None, ("1757-01-01", "xsd:date")))
        self.assertEqual(_parse_line(line), Literal("1757-01-01", datatype=XSD.date))

    def test_multiline_literal_is_valid_ntriples(self):
        text = 'First line\nSecond "quoted" line\r\nThird'
        line = _triple_to_line(_Triple(S, P, None, (text, "xsd:string")))
        self.assertNotIn("\n", line.strip())
        self.assertEqual(str(_parse_line(line)), text)

    def test_language_tag_is_kept(self):
        line = _triple_to_line(_Triple(S, P, None, ("Kumari", "@ne-latn")))
        self.assertEqual(_parse_line(line), Literal("Kumari", lang="ne-latn"))


class TripleToQuadTests(SimpleTestCase):
    def test_curie_datatype_is_expanded(self):
        quad = KnowledgeGraphStore()._triple_to_quad(
            _Triple(S, P, None, ("x", "xsd:anyURI")), graph_uri=None
        )
        self.assertEqual(quad.object.datatype.value, str(XSD.anyURI))


class UpsertLiteralTripleTests(SimpleTestCase):
    def _sparql(self, lexical, datatype):
        store = KnowledgeGraphStore()
        with patch.object(store, "update", return_value=True) as update:
            store.upsert_literal_triple(
                subject_uri=S, pred_uri=P, lexical=lexical,
                datatype=datatype, graph_uri="https://example.org/g",
            )
        return update.call_args.args[0]

    def test_curie_datatype_is_expanded(self):
        sparql = self._sparql("1757", "xsd:gYear")
        self.assertIn(f'"1757"^^<{XSD.gYear}>', sparql)
        self.assertNotIn("<xsd:", sparql)

    def test_language_tag_is_not_a_datatype(self):
        self.assertIn('"Kumari"@ne-latn', self._sparql("Kumari", "@ne-latn"))

    def test_line_breaks_are_escaped(self):
        sparql = self._sparql("a\nb", "")
        self.assertIn('"a\\nb"', sparql)
        self.assertEqual(sparql.count("\n"), 2)

    def test_full_datatype_iri_passes_through(self):
        self.assertIn(f"^^<{XSD.date}>", self._sparql("1757-01-01", str(XSD.date)))

    def test_inserted_object_parses(self):
        sparql = self._sparql('He said "hi"\nthen left', "xsd:string")
        obj = sparql.split(f"<{P}> ", 2)[2].rsplit(" . }", 1)[0]
        line = f"<{S}> <{P}> {obj} ."
        self.assertEqual(str(_parse_line(line)), 'He said "hi"\nthen left')
