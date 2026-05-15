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
    confidence_score: float         # dual-temperature agreement, 0.0–1.0
    source_chunk_id: str
    char_start: int
    char_end: int
    extraction_model: str           # e.g. "llama3.1:70b"
    page_number: int | None = None
    # raw responses kept for audit / retraining dataset
    raw_low_temp: str = ""
    raw_high_temp: str = ""


@dataclass
class ExtractionResult:
    candidates: list[CandidateAssertion]
    rejected_count: int             # triples that failed JSON parse or were empty
    agent_version: str = "2.0"


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
    violation_type: str             # "domain_range" | "node_kind" | "cross_class" | "unknown_predicate"


@dataclass
class ShaclValidationResult:
    validated: list[ValidatedAssertion]
    rejected: list[RejectedAssertion]
    agent_version: str = "3.0"


# ── Agent 4 types ─────────────────────────────────────────────────────────────

@dataclass
class ResolvedAssertion:
    """ValidatedAssertion with canonical URIs minted or looked up from Oxigraph."""
    validated: ValidatedAssertion
    subject_uri: str                     # canonical URI in hg: namespace (new or existing)
    object_uri: str | None               # canonical URI, or None if object is a literal
    subject_is_new: bool                 # True → URI was freshly minted (not found in graph)
    object_is_new: bool                  # True → URI was freshly minted
    resolution_notes: list[str] = field(default_factory=list)


@dataclass
class EntityResolutionResult:
    resolved: list[ResolvedAssertion]
    skipped_count: int = 0               # assertions skipped due to irresolvable errors
    agent_version: str = "4.0"


# ── Agent 5 types ─────────────────────────────────────────────────────────────

class RouteDecision(str, Enum):
    AUTO_ACCEPT      = "auto_accept"       # confidence ≥ 0.90, no conflict → Oxigraph INSERT + DB accepted
    COMMUNITY_REVIEW = "community_review"  # 0.70–0.89, no conflict → pending, community queue
    EXPERT_REVIEW    = "expert_review"     # 0.50–0.69 → pending, domain expert queue
    EXPERT_CURATOR   = "expert_curator"    # kumari_flag set → always expert curator, regardless of score
    CONFLICT         = "conflict"          # existing graph triple disagrees → disputed
    REJECT           = "reject"            # confidence < 0.50 → logged only, no DB write


@dataclass
class RoutedAssertion:
    resolved: ResolvedAssertion
    route: RouteDecision
    db_assertion_id: str | None            # UUID of created HeritageAssertion; None if rejected
    conflict_detected: bool
    kumari_flagged: bool
    routing_reason: str
    oxigraph_written: bool = False         # True if triple was INSERT'd to Oxigraph


@dataclass
class EpistemicRoutingResult:
    routed: list[RoutedAssertion]
    counts: dict[str, int] = field(default_factory=dict)   # RouteDecision.value → count
    agent_version: str = "5.0"
