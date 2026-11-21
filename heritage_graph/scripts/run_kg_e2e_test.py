#!/usr/bin/env python
"""
Full KG pipeline E2E test — run inside the backend container:

  docker exec heritage-backend python /app/heritage_graph/scripts/run_kg_e2e_test.py
"""

from __future__ import annotations

import json
import os
import sys
from unittest.mock import patch

# Force development (container default is production + GDAL, which breaks one-off scripts)
os.environ["DJANGO_ENV"] = "development"
os.environ["DJANGO_SETTINGS_MODULE"] = "heritage_graph.settings.pipeline_e2e"

import django

django.setup()

from apps.document_processing.models import UploadedDocument
from apps.document_processing.services.agents.types import HeritageDocType
from apps.document_processing.tasks import run_kg_pipeline
from apps.heritage_data.models import Media
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

SAMPLE_TEXT = """
शिलालेख — Stone inscription at Pashupatinath.

King Manadeva of the Lichhavi dynasty ruled Kantipur.
This inscription records that Amshuverma donated land to Pashupatinath temple
in the 5th century CE.
"""

# Single triple aligned with SHACL shapes (E22 + P108 forward alias)
MOCK_LLM_JSON = """[
  {"subject": "Pashupatinath", "subject_type": "E22_Human-Made_Object",
   "predicate": "P108_was_produced_by", "object": "King Manadeva", "object_type": "E21_Person"}
]"""


def _mock_ollama(prompt: str, temperature: float, model: str) -> str:
    return MOCK_LLM_JSON


def _mock_classify(text: str, model: str) -> tuple:
    return HeritageDocType.INSCRIPTION, 0.9


def main() -> int:
    # Backend image may lack pyshacl; use fail-open for index-only validation in e2e
    os.environ.setdefault("HERITAGEGRAPH_SHACL_FAIL_OPEN", "true")

    print("=" * 60)
    print("HeritageGraph KG Pipeline — Full E2E Test")
    print("=" * 60)

    from apps.document_processing.services.agents.ontology import default_shapes_path
    from apps.document_processing.services.agents.shacl_agent import _load_shapes_index
    from apps.document_processing.services.agents.sparql import SparqlClient

    _load_shapes_index.cache_clear()

    oxigraph_url = os.environ.get("OXIGRAPH_URL", "http://oxigraph:7878")
    client = SparqlClient(oxigraph_url)
    rows = client.select("SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o } LIMIT 1")
    print(f"Oxigraph ({oxigraph_url}): OK ({len(rows)} binding(s))")

    shapes = default_shapes_path()
    if not shapes.is_file():
        print(f"FAIL: SHACL shapes not found at {shapes}")
        return 1
    print(f"SHACL shapes: {shapes}")

    User = get_user_model()
    user = User.objects.order_by("id").first()
    if user is None:
        user = User.objects.create_user(
            username="kg_e2e_test",
            email="kg-e2e@test.local",
            password="unused-test-only",
        )

    media = Media.objects.create(
        ingestion_contributor=user,
        media_type="image",
        file=ContentFile(SAMPLE_TEXT.encode("utf-8"), name="kg_e2e_test.txt"),
        description="KG pipeline E2E test fixture",
    )
    doc = UploadedDocument.objects.create(
        media=media,
        document_type="image_inscription",
        status="completed",
        raw_text=SAMPLE_TEXT,
        metadata={},
    )
    print(f"Created UploadedDocument: {doc.id}")

    with (
        patch(
            "apps.document_processing.services.agents.extraction_agent._call_ollama",
            side_effect=_mock_ollama,
        ),
        patch(
            "apps.document_processing.services.agents.doc_intelligence._classify_with_ollama",
            side_effect=_mock_classify,
        ),
    ):
        run_kg_pipeline.run(document_id=str(doc.id))

    doc.refresh_from_db()
    meta = doc.metadata or {}
    status = meta.get("pipeline_status")
    errors = meta.get("pipeline_error")
    agent_status = meta.get("agent_status", {})
    assertions = meta.get("assertions", [])

    print("-" * 60)
    print(f"pipeline_status: {status}")
    print(f"agent_status: {json.dumps(agent_status, indent=2)}")
    if errors:
        print(f"pipeline_error: {errors}")

    results = meta.get("agent_results", {})
    print(f"agent_results keys: {list(results.keys())}")
    for key, val in results.items():
        print(f"  {key}: {json.dumps(val, default=str)[:400]}")

    print(f"assertions ({len(assertions)}):")
    for a in assertions:
        print(
            f"  - {a.get('subject')} —{a.get('predicate')}→ {a.get('object')} "
            f"| route={a.get('route')} score={a.get('confidence_score')}"
        )

    print("-" * 60)
    if status != "complete":
        print("FAIL: pipeline did not complete")
        return 1
    if not assertions:
        print("FAIL: no assertions produced")
        return 1

    failed_agents = [k for k, v in agent_status.items() if v != "complete"]
    if failed_agents:
        print(f"FAIL: agents not complete: {failed_agents}")
        return 1

    print(f"PASS: {len(assertions)} assertion(s), routes={[a.get('route') for a in assertions]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
