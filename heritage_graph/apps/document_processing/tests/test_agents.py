"""Unit tests for heritage KG ingestion agents (no LLM / Oxigraph required)."""

from __future__ import annotations

import unittest

from apps.document_processing.services.agents.confidence import (
    calibrate,
    extraction_agreement_score,
    ontology_grounding_score,
)
from apps.document_processing.services.agents.doc_intelligence import (
    _classify_with_heuristics,
    _semantic_chunks,
    _structure_aware_segments,
)
from apps.document_processing.services.agents.entity_resolution_agent import (
    _normalize_name,
)
from apps.document_processing.services.agents.extraction_agent import (
    _fuzzy_match_triples,
    _parse_triples,
    _predicate_allowed,
)
from apps.document_processing.services.agents.ontology import (
    INVERSE_MAP,
    class_uri,
    is_literal_type,
    mint_entity_uri,
    predicate_uri,
)
from apps.document_processing.services.agents.shacl_agent import _load_shapes_index
from apps.document_processing.services.agents.sparql import (
    escape_sparql_string,
    validate_uri,
)
from apps.document_processing.services.agents.types import HeritageDocType, Triple


class OntologyUtilsTests(unittest.TestCase):
    def test_predicate_uri_crm(self):
        self.assertTrue(predicate_uri("P108_was_produced_by").endswith("P108_was_produced_by"))

    def test_predicate_uri_hg(self):
        self.assertTrue(predicate_uri("hg:selected_person").endswith("selected_person"))

    def test_class_uri_known(self):
        self.assertIn("E21_Person", class_uri("E21_Person"))

    def test_is_literal(self):
        self.assertTrue(is_literal_type("literal"))
        self.assertFalse(is_literal_type("E21_Person"))

    def test_mint_uri_format(self):
        uri = mint_entity_uri("E22_Human-Made_Object")
        self.assertIn("heritagegraph/entity/e22-human-made-object-", uri)

    def test_inverse_map_nonempty(self):
        self.assertGreater(len(INVERSE_MAP), 5)


class ConfidenceTests(unittest.TestCase):
    def test_exact_agreement_highest(self):
        self.assertEqual(extraction_agreement_score(exact_match=True), 1.0)

    def test_single_run_lower(self):
        score = extraction_agreement_score(single_run_only=True)
        self.assertLess(score, 0.6)

    def test_composite_weighted(self):
        bd = calibrate(1.0, 1.0, 1.0, 1.0, 1.0)
        self.assertAlmostEqual(bd.composite, 1.0, places=2)

    def test_weak_ocr_pulls_down(self):
        high = calibrate(1.0, 1.0, 1.0, 1.0, 1.0).composite
        low = calibrate(1.0, 1.0, 1.0, 1.0, 0.3).composite
        self.assertGreater(high, low)

    def test_ontology_grounding(self):
        score = ontology_grounding_score(
            predicate_in_snippet=True,
            subject_class_known=True,
            object_class_known=True,
        )
        self.assertGreaterEqual(score, 0.9)


class ExtractionParsingTests(unittest.TestCase):
    def test_parse_json_array(self):
        raw = '[{"subject": "A", "subject_type": "E21_Person", "predicate": "P1", "object": "B", "object_type": "literal"}]'
        triples = _parse_triples(raw)
        self.assertEqual(len(triples), 1)
        self.assertEqual(triples[0].subject, "A")

    def test_fuzzy_agreement_partial_credit(self):
        low = [Triple("Pashupati Temple", "E22_Human-Made_Object", "P7", "Nepal", "E53_Place")]
        high = [Triple("Pashupati Temple", "E22_Human-Made_Object", "P7", "Nepal", "E53_Place")]
        agreed = _fuzzy_match_triples(low, high, fuzzy_threshold=82)
        self.assertEqual(len(agreed), 1)
        _, score, exact, _ = next(iter(agreed.values()))
        self.assertTrue(exact)
        self.assertEqual(score, 1.0)

    def test_predicate_allowed_crm(self):
        self.assertTrue(_predicate_allowed("P108_was_produced_by", frozenset()))


class DocIntelligenceTests(unittest.TestCase):
    def test_heuristic_inscription(self):
        text = "This stone inscription śilālekha records a donation."
        doc_type, conf = _classify_with_heuristics(text)
        self.assertEqual(doc_type, HeritageDocType.INSCRIPTION)
        self.assertGreater(conf, 0.0)

    def test_structure_segments(self):
        text = "First paragraph.\n\nSecond paragraph with श्लोक १."
        segs = _structure_aware_segments(text)
        self.assertGreaterEqual(len(segs), 1)

    def test_semantic_chunks_nonempty(self):
        text = "Sentence one. Sentence two. Sentence three with more words here."
        chunks = _semantic_chunks(text, max_tokens=10, overlap_tokens=2)
        self.assertGreater(len(chunks), 0)


class EntityResolutionTests(unittest.TestCase):
    def test_transliteration(self):
        self.assertEqual(_normalize_name("swayambhu"), "Swayambhunath")
        self.assertEqual(_normalize_name("स्वयम्भू"), "Swayambhunath")


class SparqlSecurityTests(unittest.TestCase):
    def test_escape_quotes(self):
        self.assertIn('\\"', escape_sparql_string('say "hello"'))

    def test_reject_injection_uri(self):
        with self.assertRaises(ValueError):
            validate_uri('http://evil.com> ; DROP ALL')


class ShaclIndexTests(unittest.TestCase):
    def test_shapes_index_loads_or_empty(self):
        from apps.document_processing.services.agents.ontology import (
            default_shapes_path,
        )

        path = str(default_shapes_path())
        index = _load_shapes_index(path)
        self.assertIsInstance(index, dict)


if __name__ == "__main__":
    unittest.main()
