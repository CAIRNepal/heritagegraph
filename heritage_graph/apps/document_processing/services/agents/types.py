from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class HeritageDocType(str, Enum):
    INSCRIPTION = "inscription"
    CHRONICLE = "chronicle"
    SURVEY_REPORT = "survey_report"
    ORAL_HISTORY = "oral_history"
    GAZETTE = "gazette"
    UNKNOWN = "unknown"


@dataclass
class DocumentChunk:
    chunk_id: str
    text: str
    char_start: int
    char_end: int
    language: str
    ontology_hint: list[str]
    token_count: int
    page_number: int | None = None


@dataclass
class DocumentIntelligenceResult:
    heritage_doc_type: HeritageDocType
    heritage_doc_type_confidence: float
    detected_language: str
    chunks: list[DocumentChunk]
    ontology_snippet: dict
    agent_version: str = "1.0"
