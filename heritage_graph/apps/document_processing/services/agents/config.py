"""
Pipeline configuration — env-driven knobs for heritage KG ingestion agents.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env_bool(key: str, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_float(key: str, default: float) -> float:
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class PipelineConfig:
    """Central configuration for the agentic KG ingestion pipeline."""

    ollama_model: str = "llama3.1:70b"
    oxigraph_url: str = "http://localhost:7878"

    # Extraction
    extraction_temp_low: float = 0.1
    extraction_temp_high: float = 0.4
    fuzzy_agreement_threshold: int = 82
    min_extraction_confidence: float = 0.0

    # SHACL — fail-closed by default for production rigor
    shacl_fail_open: bool = False
    shacl_shapes_path: str | None = None

    # Entity resolution
    entity_fuzzy_threshold: int = 85
    entity_lookup_limit: int = 500

    # Epistemic routing thresholds
    threshold_auto_accept: float = 0.90
    threshold_community_review: float = 0.70
    threshold_expert_review: float = 0.50

    # Doc intelligence
    chunk_max_tokens: int = 256
    chunk_overlap_tokens: int = 20
    use_ollama_classification: bool = True

    # Provenance / named graphs
    provenance_named_graph: bool = True
    write_prov_triples: bool = True

    @classmethod
    def from_env(cls) -> PipelineConfig:
        return cls(
            ollama_model=os.environ.get("HERITAGEGRAPH_OLLAMA_MODEL", "llama3.1:70b"),
            oxigraph_url=os.environ.get("OXIGRAPH_URL", "http://localhost:7878"),
            extraction_temp_low=_env_float("HERITAGEGRAPH_EXTRACTION_TEMP_LOW", 0.1),
            extraction_temp_high=_env_float("HERITAGEGRAPH_EXTRACTION_TEMP_HIGH", 0.4),
            fuzzy_agreement_threshold=_env_int("HERITAGEGRAPH_FUZZY_AGREEMENT_THRESHOLD", 82),
            min_extraction_confidence=_env_float("HERITAGEGRAPH_MIN_EXTRACTION_CONFIDENCE", 0.0),
            shacl_fail_open=_env_bool("HERITAGEGRAPH_SHACL_FAIL_OPEN", False),
            shacl_shapes_path=os.environ.get("HERITAGEGRAPH_SHACL_SHAPES_PATH"),
            entity_fuzzy_threshold=_env_int("HERITAGEGRAPH_ENTITY_FUZZY_THRESHOLD", 85),
            entity_lookup_limit=_env_int("HERITAGEGRAPH_ENTITY_LOOKUP_LIMIT", 500),
            threshold_auto_accept=_env_float("HERITAGEGRAPH_THRESHOLD_AUTO_ACCEPT", 0.90),
            threshold_community_review=_env_float("HERITAGEGRAPH_THRESHOLD_COMMUNITY_REVIEW", 0.70),
            threshold_expert_review=_env_float("HERITAGEGRAPH_THRESHOLD_EXPERT_REVIEW", 0.50),
            chunk_max_tokens=_env_int("HERITAGEGRAPH_CHUNK_MAX_TOKENS", 256),
            chunk_overlap_tokens=_env_int("HERITAGEGRAPH_CHUNK_OVERLAP_TOKENS", 20),
            use_ollama_classification=_env_bool("HERITAGEGRAPH_USE_OLLAMA_CLASSIFICATION", True),
            provenance_named_graph=_env_bool("HERITAGEGRAPH_PROVENANCE_NAMED_GRAPH", True),
            write_prov_triples=_env_bool("HERITAGEGRAPH_WRITE_PROV_TRIPLES", True),
        )


DEFAULT_CONFIG = PipelineConfig.from_env()
