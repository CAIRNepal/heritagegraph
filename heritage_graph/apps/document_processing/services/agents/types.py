from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


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
    ocr_confidence: float | None = None
    structural_label: str | None = None  # e.g. "citation", "verse", "paragraph"


@dataclass
class DocumentIntelligenceResult:
    heritage_doc_type: HeritageDocType
    heritage_doc_type_confidence: float
    detected_language: str
    chunks: list[DocumentChunk]
    ontology_snippet: dict
    ocr_quality_estimate: float = 1.0
    agent_version: str = "1.1"


# ── Agent 2 types ─────────────────────────────────────────────────────────────

@dataclass
class Triple:
    subject: str
    subject_type: str       # CIDOC class label, e.g. "E22_Human-Made_Object"
    predicate: str          # ontology property or field key
    object: str
    object_type: str        # CIDOC class label or "literal"


@dataclass
class CandidateAssertion:
    """In-memory output of Agent 2; written to DB by Agent 5 after resolution."""
    triple: Triple
    confidence_score: float         # calibrated composite, 0.0–1.0
    source_chunk_id: str
    char_start: int
    char_end: int
    extraction_model: str           # e.g. "llama3.1:70b"
    page_number: int | None = None
    raw_low_temp: str = ""
    raw_high_temp: str = ""
    confidence_breakdown: dict[str, float] = field(default_factory=dict)
    ontology_grounded: bool = True


@dataclass
class ExtractionResult:
    candidates: list[CandidateAssertion]
    rejected_count: int             # triples that failed JSON parse or were empty
    agent_version: str = "2.1"


# ── Agent 3 types ─────────────────────────────────────────────────────────────

@dataclass
class ValidatedAssertion:
    candidate: CandidateAssertion
    checks_passed: list[str]        # names of validation checks that passed
    corrected: bool = False         # True if predicate/direction was auto-corrected
    correction_note: str = ""


@dataclass
class RejectedAssertion:
    candidate: CandidateAssertion
    reason: str                     # human-readable error
    violation_type: str             # domain_range | node_kind | cross_class | unknown_predicate | validator_error


@dataclass
class ShaclValidationResult:
    validated: list[ValidatedAssertion]
    rejected: list[RejectedAssertion]
    agent_version: str = "3.1"


# ── Agent 4 types ─────────────────────────────────────────────────────────────

@dataclass
class ResolvedAssertion:
    """ValidatedAssertion with canonical URIs minted or looked up from Oxigraph."""
    validated: ValidatedAssertion
    subject_uri: str
    object_uri: str | None
    subject_is_new: bool
    object_is_new: bool
    resolution_notes: list[str] = field(default_factory=list)
    subject_resolution_score: float = 1.0
    object_resolution_score: float = 1.0


@dataclass
class EntityResolutionResult:
    resolved: list[ResolvedAssertion]
    skipped_count: int = 0
    agent_version: str = "4.1"


# ── Agent 5 types ─────────────────────────────────────────────────────────────

class RouteDecision(str, Enum):
    AUTO_ACCEPT      = "auto_accept"
    COMMUNITY_REVIEW = "community_review"
    EXPERT_REVIEW    = "expert_review"
    EXPERT_CURATOR   = "expert_curator"
    CONFLICT         = "conflict"
    REJECT           = "reject"


@dataclass
class RoutedAssertion:
    resolved: ResolvedAssertion
    route: RouteDecision
    db_assertion_id: str | None
    conflict_detected: bool
    kumari_flagged: bool
    routing_reason: str
    oxigraph_written: bool = False
    provenance_graph_uri: str | None = None


@dataclass
class EpistemicRoutingResult:
    routed: list[RoutedAssertion]
    counts: dict[str, int] = field(default_factory=dict)
    agent_version: str = "5.1"


# ── Pipeline orchestration ────────────────────────────────────────────────────

@dataclass
class PipelineResult:
    """Full pipeline output with per-stage results and telemetry."""
    doc_intelligence: DocumentIntelligenceResult | None = None
    extraction: ExtractionResult | None = None
    shacl: ShaclValidationResult | None = None
    entity_resolution: EntityResolutionResult | None = None
    epistemic_routing: EpistemicRoutingResult | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    pipeline_run_id: str = ""
