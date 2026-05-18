"""
Agent 2 — Ontology-Grounded Extraction Agent

Dual-temperature self-consistency extraction with ontology-constrained predicates,
multi-factor confidence calibration, and hallucination mitigation.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .confidence import (
    calibrate,
    extraction_agreement_score,
    ontology_grounding_score,
)
from .config import DEFAULT_CONFIG, PipelineConfig
from .ontology import CLASS_URI, allowed_predicates_from_snippet, predicate_uri
from .types import (
    CandidateAssertion,
    DocumentChunk,
    DocumentIntelligenceResult,
    ExtractionResult,
    Triple,
)

logger = logging.getLogger(__name__)

_FEW_SHOT = """
--- EXAMPLE 1 ---
Text: "Pashupatinath was constructed during the reign of King Manadeva in the 5th century CE."
Triples:
[
  {"subject": "Pashupatinath", "subject_type": "E22_Human-Made_Object",
   "predicate": "P108_was_produced_by", "object": "King Manadeva", "object_type": "E21_Person"},
  {"subject": "Pashupatinath", "subject_type": "E22_Human-Made_Object",
   "predicate": "P4_has_time-span", "object": "5th century CE", "object_type": "literal"}
]

--- EXAMPLE 2 ---
Text: "The stone inscription records that Lichhavi king Amshuverma donated land to the Pashupatinath temple."
Triples:
[
  {"subject": "Amshuverma", "subject_type": "E21_Person",
   "predicate": "P22_transferred_title_to", "object": "Pashupatinath temple", "object_type": "E22_Human-Made_Object"},
  {"subject": "inscription", "subject_type": "E34_Inscription",
   "predicate": "P67_refers_to", "object": "land donation", "object_type": "E8_Acquisition"}
]

--- EXAMPLE 3 ---
Text: "The Kumari of Patan is selected from the Shakya goldsmith caste and must display 32 physical perfections."
Triples:
[
  {"subject": "Kumari of Patan", "subject_type": "E21_Person",
   "predicate": "P107_has_current_or_former_member", "object": "Shakya goldsmith caste", "object_type": "E74_Group"},
  {"subject": "Kumari of Patan", "subject_type": "E21_Person",
   "predicate": "selection_criteria", "object": "32 physical perfections", "object_type": "literal"}
]
"""

_EXTRACTION_PROMPT_TEMPLATE = """\
You are an expert Nepalese cultural heritage archivist trained in CIDOC-CRM ontology.

Heritage document type: {heritage_doc_type}
Document language: {language}
Chunk structure: {structural_label}

ALLOWED predicates for this document (use ONLY these or standard CIDOC P-properties):
{allowed_predicates}

Relevant ontology classes and properties:
{ontology_hint}

Few-shot extraction examples:
{few_shot}

---
Extract ALL (subject, predicate, object) triples from the text chunk.

Rules:
- subject_type and object_type MUST be CIDOC-CRM or HeritageGraph class labels from the ontology.
- Use "literal" for object_type when the value is a date, number, or plain text.
- Do NOT invent predicates outside the allowed list unless they are standard CIDOC P-properties.
- Extract only claims explicitly supported by the text — no speculation.
- Return ONLY a valid JSON array. No explanation, no markdown fences.

Text chunk:
{chunk_text}
"""


def _format_ontology_hint(ontology_snippet: dict) -> str:
    if not ontology_snippet:
        return "(no ontology constraints provided)"
    lines: list[str] = []
    for class_key, class_def in ontology_snippet.items():
        label = class_def.get("label", class_key) if isinstance(class_def, dict) else class_key
        lines.append(f"Class: {class_key} ({label})")
        if isinstance(class_def, dict):
            for f in (class_def.get("fields") or [])[:15]:
                fk = f.get("key") or f.get("name", "")
                fl = f.get("label", fk)
                if fk:
                    lines.append(f"  property: {fk} — {fl}")
    return "\n".join(lines)


def _format_allowed_predicates(ontology_snippet: dict) -> str:
    allowed = allowed_predicates_from_snippet(ontology_snippet)
    short = sorted({p.split("/")[-1] if p.startswith("http") else p for p in allowed})[:40]
    return ", ".join(short) if short else "(standard CIDOC P-properties only)"


def _call_ollama(prompt: str, temperature: float, model: str) -> str:
    import ollama

    response = ollama.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": temperature},
    )
    return response["message"]["content"].strip()


def _parse_triples(raw: str) -> list[Triple]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        return []
    try:
        rows: list[Any] = json.loads(m.group(0))
    except (json.JSONDecodeError, ValueError):
        return []

    triples: list[Triple] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        subj = str(row.get("subject") or "").strip()
        pred = str(row.get("predicate") or "").strip()
        obj = str(row.get("object") or "").strip()
        if not subj or not pred or not obj:
            continue
        triples.append(
            Triple(
                subject=subj,
                subject_type=str(row.get("subject_type") or "E1_CRM_Entity").strip(),
                predicate=pred,
                object=obj,
                object_type=str(row.get("object_type") or "literal").strip(),
            )
        )
    return triples


def _triple_key(t: Triple) -> str:
    return f"{t.subject.lower()}|{t.predicate.lower()}|{t.object.lower()}"


def _predicate_allowed(pred: str, allowed: frozenset[str]) -> bool:
    if pred in allowed:
        return True
    if predicate_uri(pred) in allowed:
        return True
    if re.match(r"^P\d+[a-z]?_", pred):
        return True
    return False


def _fuzzy_match_triples(
    low: list[Triple],
    high: list[Triple],
    *,
    fuzzy_threshold: int,
) -> dict[str, tuple[Triple, float, bool, float | None]]:
    """
    Returns {key: (triple, agreement_score, exact_match, fuzzy_ratio)}.
    """
    try:
        from rapidfuzz import fuzz
        use_fuzzy = True
    except ImportError:
        use_fuzzy = False

    agreed: dict[str, tuple[Triple, float, bool, float | None]] = {}
    low_keys = {_triple_key(t): t for t in low}
    high_keys = {_triple_key(t): t for t in high}
    consumed_high: set[str] = set()

    for k, t in low_keys.items():
        if k in high_keys:
            score = extraction_agreement_score(exact_match=True)
            agreed[k] = (t, score, True, None)
            consumed_high.add(k)

    for k, t in low_keys.items():
        if k in agreed:
            continue
        best_ratio: float | None = None
        best_hk = None
        if use_fuzzy:
            for hk in high_keys:
                if hk in consumed_high:
                    continue
                r = float(fuzz.ratio(k, hk))
                if best_ratio is None or r > best_ratio:
                    best_ratio, best_hk = r, hk
            if best_ratio is not None and best_ratio >= fuzzy_threshold and best_hk:
                score = extraction_agreement_score(
                    exact_match=False, fuzzy_ratio=best_ratio, fuzzy_threshold=fuzzy_threshold
                )
                agreed[k] = (t, score, False, best_ratio)
                consumed_high.add(best_hk)
                continue
        score = extraction_agreement_score(single_run_only=True)
        agreed[k] = (t, score, False, None)

    for k, t in high_keys.items():
        if k not in consumed_high:
            score = extraction_agreement_score(single_run_only=True)
            agreed[k] = (t, score, False, None)

    return agreed


def _extract_from_chunk(
    chunk: DocumentChunk,
    heritage_doc_type: str,
    ontology_snippet: dict,
    *,
    config: PipelineConfig,
    ocr_quality: float,
) -> tuple[list[CandidateAssertion], int]:
    allowed = allowed_predicates_from_snippet(ontology_snippet)
    prompt = _EXTRACTION_PROMPT_TEMPLATE.format(
        heritage_doc_type=heritage_doc_type,
        language=chunk.language,
        structural_label=chunk.structural_label or "paragraph",
        allowed_predicates=_format_allowed_predicates(ontology_snippet),
        ontology_hint=_format_ontology_hint(ontology_snippet),
        few_shot=_FEW_SHOT,
        chunk_text=chunk.text,
    )

    raw_low = raw_high = ""
    try:
        raw_low = _call_ollama(prompt, config.extraction_temp_low, config.ollama_model)
    except Exception:
        logger.warning("Ollama low-temp failed for chunk %s", chunk.chunk_id, exc_info=True)

    try:
        raw_high = _call_ollama(prompt, config.extraction_temp_high, config.ollama_model)
    except Exception:
        logger.warning("Ollama high-temp failed for chunk %s", chunk.chunk_id, exc_info=True)

    low_triples = _parse_triples(raw_low)
    high_triples = _parse_triples(raw_high)

    if not low_triples and not high_triples:
        return [], 1

    agreed = _fuzzy_match_triples(
        low_triples, high_triples, fuzzy_threshold=config.fuzzy_agreement_threshold
    )

    chunk_ocr = chunk.ocr_confidence if chunk.ocr_confidence is not None else ocr_quality
    candidates: list[CandidateAssertion] = []

    for triple, ext_score, exact, fuzzy_ratio in agreed.values():
        pred_ok = _predicate_allowed(triple.predicate, allowed)
        subj_known = triple.subject_type in CLASS_URI
        obj_known = triple.object_type in CLASS_URI or triple.object_type.lower() == "literal"
        ont_score = ontology_grounding_score(
            predicate_in_snippet=pred_ok,
            subject_class_known=subj_known,
            object_class_known=obj_known,
        )
        breakdown = calibrate(
            extraction_agreement=ext_score,
            ontology_grounding=ont_score,
            shacl_validity=1.0,
            entity_resolution=1.0,
            ocr_quality=chunk_ocr,
        )
        candidates.append(
            CandidateAssertion(
                triple=triple,
                confidence_score=breakdown.composite,
                source_chunk_id=chunk.chunk_id,
                char_start=chunk.char_start,
                char_end=chunk.char_end,
                extraction_model=config.ollama_model,
                page_number=chunk.page_number,
                raw_low_temp=raw_low,
                raw_high_temp=raw_high,
                confidence_breakdown=breakdown.to_dict(),
                ontology_grounded=pred_ok and subj_known,
            )
        )

    return candidates, 0


def run_extraction(
    di_result: DocumentIntelligenceResult,
    *,
    min_confidence: float = 0.0,
    config: PipelineConfig | None = None,
) -> ExtractionResult:
    """Agent 2 entry point."""
    cfg = config or DEFAULT_CONFIG
    all_candidates: list[CandidateAssertion] = []
    total_rejected = 0

    for chunk in di_result.chunks:
        candidates, rejected = _extract_from_chunk(
            chunk,
            heritage_doc_type=di_result.heritage_doc_type.value,
            ontology_snippet=di_result.ontology_snippet,
            config=cfg,
            ocr_quality=di_result.ocr_quality_estimate,
        )
        total_rejected += rejected
        all_candidates.extend(c for c in candidates if c.confidence_score >= min_confidence)

    logger.info(
        "Extraction complete: %d candidates from %d chunks (rejected=%d)",
        len(all_candidates),
        len(di_result.chunks),
        total_rejected,
    )

    return ExtractionResult(candidates=all_candidates, rejected_count=total_rejected)
