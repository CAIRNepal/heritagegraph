"""
Integration smoke test for the KG ingestion pipeline (no Ollama / Oxigraph required).

Run:
  cd heritage_graph && PYTHONPATH=. python apps/document_processing/tests/test_pipeline_smoke.py
"""

from __future__ import annotations

import sys
import unittest
from unittest.mock import patch

from apps.document_processing.services.agents.confidence import calibrate
from apps.document_processing.services.agents.doc_intelligence import (
    run_doc_intelligence,
)
from apps.document_processing.services.agents.entity_resolution_agent import (
    run_entity_resolution,
)
from apps.document_processing.services.agents.extraction_agent import run_extraction
from apps.document_processing.services.agents.orchestrator import (
    run_kg_ingestion_pipeline,
)
from apps.document_processing.services.agents.shacl_agent import (
    _load_shapes_index,
    run_shacl_validation,
)

_load_shapes_index.cache_clear()
from apps.document_processing.services.agents.types import (
    CandidateAssertion,
    HeritageDocType,
    Triple,
)

SAMPLE_INSCRIPTION = """
शिलालेख — Stone inscription at Pashupatinath.

King Manadeva of the Lichhavi dynasty ruled Kantipur.
This inscription records that Amshuverma donated land to Pashupatinath temple
in the 5th century CE.
"""


def _mock_ollama_triples(_prompt: str, _temp: float, _model: str) -> str:
    return """[
      {"subject": "Pashupatinath", "subject_type": "E22_Human-Made_Object",
       "predicate": "P108_was_produced_by", "object": "King Manadeva", "object_type": "E21_Person"},
      {"subject": "Amshuverma", "subject_type": "E21_Person",
       "predicate": "P22_transferred_title_to", "object": "Pashupatinath temple", "object_type": "E22_Human-Made_Object"}
    ]"""


class MockSparqlClient:
    """In-memory stub — no Oxigraph server needed."""

    def __init__(self, base_url: str, *, timeout: int = 15) -> None:
        self.base_url = base_url

    def exact_label_lookup(self, label: str, class_uri: str | None = None, **kwargs) -> list[str]:
        known = {
            "pashupatinath": "https://w3id.org/heritagegraph/entity/pashupatinath",
            "king manadeva": "https://w3id.org/heritagegraph/entity/manadeva",
            "amshuverma": "https://w3id.org/heritagegraph/entity/amshuverma",
        }
        return [known[label.lower()]] if label.lower() in known else []

    def label_candidates(self, class_uri: str | None = None, **kwargs) -> list[tuple[str, str]]:
        return []

    def existing_objects(self, subject_uri: str, pred_uri: str, **kwargs) -> set[str]:
        return set()

    def insert_data(self, ntriples: str, *, graph_uri: str | None = None) -> bool:
        return True


class PipelineSmokeTests(unittest.TestCase):
  @patch("apps.document_processing.services.agents.extraction_agent._call_ollama", side_effect=_mock_ollama_triples)
  def test_stages_1_through_4(self, _mock_llm):
    di = run_doc_intelligence(text=SAMPLE_INSCRIPTION, use_ollama=False)
    self.assertGreater(len(di.chunks), 0)
    self.assertIn(di.heritage_doc_type, (HeritageDocType.INSCRIPTION, HeritageDocType.CHRONICLE, HeritageDocType.UNKNOWN))

    ex = run_extraction(di)
    self.assertGreater(len(ex.candidates), 0, "extraction should yield candidates with mocked LLM")

    shacl = run_shacl_validation(ex.candidates)
    self.assertGreater(len(shacl.validated) + len(shacl.rejected), 0)

    with patch(
      "apps.document_processing.services.agents.entity_resolution_agent.SparqlClient",
      MockSparqlClient,
    ):
      er = run_entity_resolution(shacl)
    self.assertGreater(len(er.resolved), 0)
    for r in er.resolved:
      self.assertTrue(r.subject_uri.startswith("https://"))
      self.assertGreater(r.validated.candidate.confidence_score, 0)

  @patch("apps.document_processing.services.agents.extraction_agent._call_ollama", side_effect=_mock_ollama_triples)
  def test_orchestrator_skip_db(self, _mock_llm):
    result = run_kg_ingestion_pipeline(
      text=SAMPLE_INSCRIPTION,
      document_id="00000000-0000-0000-0000-000000000001",
      skip_epistemic_db=True,
    )
    self.assertIsNone(result.errors or None)  # empty list is ok
    self.assertFalse(result.errors)
    self.assertIsNotNone(result.doc_intelligence)
    self.assertIsNotNone(result.extraction)
    self.assertIsNotNone(result.shacl)
    self.assertIsNotNone(result.entity_resolution)
    self.assertIsNone(result.epistemic_routing)
    self.assertIn("stages", result.metrics)

  def test_shacl_rejects_unknown_predicate_on_known_class(self):
    """Unknown predicate on a class that IS in SHACL shapes must be rejected."""
    bd = calibrate(0.5, 0.5, 1.0, 1.0, 1.0)
    bad = CandidateAssertion(
      triple=Triple("Pashupatinath", "E22_Human-Made_Object", "totally_fake_predicate_xyz", "Y", "literal"),
      confidence_score=bd.composite,
      source_chunk_id="c1",
      char_start=0,
      char_end=10,
      extraction_model="test",
      confidence_breakdown=bd.to_dict(),
    )
    shacl = run_shacl_validation([bad])
    self.assertGreater(len(shacl.rejected), 0, shacl.rejected)


if __name__ == "__main__":
  suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
  runner = unittest.TextTestRunner(verbosity=2)
  raise SystemExit(0 if runner.run(suite).wasSuccessful() else 1)
