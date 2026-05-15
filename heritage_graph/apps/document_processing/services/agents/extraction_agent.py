"""
Agent 2 — Ontology-Grounded Extraction Agent

For each DocumentChunk produced by Agent 1:
- Builds a prompt from the CIDOC ontology snippet + few-shot heritage examples
- Calls Ollama (Llama 3.1 70B) twice: temperature 0.1 and 0.4
- Parses (subject, predicate, object) triples from both responses
- Computes per-triple agreement score (entropy-based confidence signal)
- Returns a list[CandidateAssertion] with confidence_score populated

Design principle — dual-temperature agreement:
  A triple that appears in BOTH runs gets confidence 1.0.
  A triple that appears in only ONE run gets confidence 0.5.
  Fuzzy matching (rapidfuzz) handles minor surface variations between runs.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .types import (
    CandidateAssertion,
    DocumentChunk,
    DocumentIntelligenceResult,
    ExtractionResult,
    Triple,
)

logger = logging.getLogger(__name__)

_OLLAMA_MODEL = "llama3.1:70b"
_TEMP_LOW = 0.1
_TEMP_HIGH = 0.4
_FUZZY_THRESHOLD = 82   # rapidfuzz ratio cutoff for treating two triples as the same


# ── Few-shot examples ─────────────────────────────────────────────────────────

_FEW_SHOT = """
--- EXAMPLE 1 ---
Text: "Pashupatinath was constructed during the reign of King Manadeva in the 5th century CE."
Triples:
[
  {"subject": "Pashupatinath", "subject_type": "E22_Human-Made_Object",
   "predicate": "P108_was_produced_by", "object": "King Manadeva", "object_type": "E21_Person"},
  {"subject": "Pashupatinath", "subject_type": "E22_Human-Made_Object",
   "predicate": "P4_has_time-span", "object": "5th century CE", "object_type": "E52_Time-Span"}
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

Relevant ontology classes and properties for this document:
{ontology_hint}

Few-shot extraction examples:
{few_shot}

---
Now extract ALL (subject, predicate, object) triples from the following text chunk.

Rules:
- Use the provided ontology classes for subject_type and object_type when possible.
- Use "literal" for object_type when the value is a date, number, or plain text.
- Extract every factual claim — do not skip minor ones.
- If no triples can be extracted, return an empty array [].
- Return ONLY a valid JSON array. No explanation, no markdown fences.

Text chunk:
{chunk_text}
"""


# ── Ontology hint formatter ────────────────────────────────────────────────────

def _format_ontology_hint(ontology_snippet: dict) -> str:
    if not ontology_snippet:
        return "(no ontology constraints provided)"
    lines: list[str] = []
    for class_key, class_def in ontology_snippet.items():
        label = class_def.get("label", class_key) if isinstance(class_def, dict) else class_key
        lines.append(f"Class: {class_key} ({label})")
        if isinstance(class_def, dict):
            fields = class_def.get("fields") or []
            for f in fields[:15]:
                fk = f.get("key") or f.get("name", "")
                fl = f.get("label", fk)
                if fk:
                    lines.append(f"  property: {fk} — {fl}")
    return "\n".join(lines)


# ── Ollama call ────────────────────────────────────────────────────────────────

def _call_ollama(prompt: str, temperature: float) -> str:
    import ollama

    response = ollama.chat(
        model=_OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": temperature},
    )
    return response["message"]["content"].strip()


# ── Triple parsing ─────────────────────────────────────────────────────────────

def _parse_triples(raw: str) -> list[Triple]:
    text = raw.strip()
    # Strip markdown fences
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    # Find first JSON array
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


# ── Agreement scoring ──────────────────────────────────────────────────────────

def _triple_key(t: Triple) -> str:
    return f"{t.subject.lower()}|{t.predicate.lower()}|{t.object.lower()}"


def _fuzzy_match_triples(
    low: list[Triple], high: list[Triple]
) -> dict[str, tuple[Triple, float]]:
    """
    Returns {canonical_key: (triple, confidence_score)}.
    Confidence is 1.0 if triple appears in both runs (exact or fuzzy), 0.5 if only one.
    """
    try:
        from rapidfuzz import fuzz
        use_fuzzy = True
    except ImportError:
        use_fuzzy = False

    agreed: dict[str, tuple[Triple, float]] = {}
    low_keys = {_triple_key(t): t for t in low}
    high_keys = {_triple_key(t): t for t in high}
    consumed_high: set[str] = set()

    # Exact matches
    for k, t in low_keys.items():
        if k in high_keys:
            agreed[k] = (t, 1.0)
            consumed_high.add(k)

    # Low-temp triples without exact match — try fuzzy against unconsumed high-temp
    for k, t in low_keys.items():
        if k in agreed:
            continue
        if use_fuzzy:
            best_ratio, best_hk = 0, None
            for hk in high_keys:
                if hk in consumed_high:
                    continue
                r = fuzz.ratio(k, hk)
                if r > best_ratio:
                    best_ratio, best_hk = r, hk
            if best_ratio >= _FUZZY_THRESHOLD and best_hk:
                agreed[k] = (t, 1.0)
                consumed_high.add(best_hk)
                continue
        agreed[k] = (t, 0.5)

    # High-temp triples not matched to any low-temp triple
    for k, t in high_keys.items():
        if k not in consumed_high:
            agreed[k] = (t, 0.5)

    return agreed


# ── Per-chunk extraction ───────────────────────────────────────────────────────

def _extract_from_chunk(
    chunk: DocumentChunk,
    heritage_doc_type: str,
    ontology_snippet: dict,
) -> tuple[list[CandidateAssertion], int]:
    ontology_hint_text = _format_ontology_hint(ontology_snippet)
    prompt = _EXTRACTION_PROMPT_TEMPLATE.format(
        heritage_doc_type=heritage_doc_type,
        language=chunk.language,
        ontology_hint=ontology_hint_text,
        few_shot=_FEW_SHOT,
        chunk_text=chunk.text,
    )

    raw_low = raw_high = ""
    try:
        raw_low = _call_ollama(prompt, _TEMP_LOW)
    except Exception:
        logger.warning("Ollama call (temp=%.1f) failed for chunk %s", _TEMP_LOW, chunk.chunk_id, exc_info=True)

    try:
        raw_high = _call_ollama(prompt, _TEMP_HIGH)
    except Exception:
        logger.warning("Ollama call (temp=%.1f) failed for chunk %s", _TEMP_HIGH, chunk.chunk_id, exc_info=True)

    low_triples = _parse_triples(raw_low)
    high_triples = _parse_triples(raw_high)

    if not low_triples and not high_triples:
        return [], 1   # 1 rejected (the chunk itself yielded nothing)

    agreed = _fuzzy_match_triples(low_triples, high_triples)

    candidates: list[CandidateAssertion] = []
    for triple, confidence in agreed.values():
        candidates.append(
            CandidateAssertion(
                triple=triple,
                confidence_score=confidence,
                source_chunk_id=chunk.chunk_id,
                char_start=chunk.char_start,
                char_end=chunk.char_end,
                extraction_model=_OLLAMA_MODEL,
                page_number=chunk.page_number,
                raw_low_temp=raw_low,
                raw_high_temp=raw_high,
            )
        )

    logger.debug(
        "Chunk %s: low=%d high=%d agreed=%d",
        chunk.chunk_id[:8],
        len(low_triples),
        len(high_triples),
        len(candidates),
    )
    return candidates, 0


# ── Public entry point ─────────────────────────────────────────────────────────

def run_extraction(
    di_result: DocumentIntelligenceResult,
    *,
    min_confidence: float = 0.0,
) -> ExtractionResult:
    """
    Agent 2 entry point.

    Args:
        di_result: Output of Agent 1 (DocumentIntelligenceResult).
        min_confidence: Drop candidates below this threshold before returning.

    Returns:
        ExtractionResult with all CandidateAssertions and a rejected count.
    """
    all_candidates: list[CandidateAssertion] = []
    total_rejected = 0

    for chunk in di_result.chunks:
        candidates, rejected = _extract_from_chunk(
            chunk,
            heritage_doc_type=di_result.heritage_doc_type.value,
            ontology_snippet=di_result.ontology_snippet,
        )
        total_rejected += rejected
        all_candidates.extend(
            c for c in candidates if c.confidence_score >= min_confidence
        )

    logger.info(
        "Extraction complete: %d candidates from %d chunks (rejected=%d)",
        len(all_candidates),
        len(di_result.chunks),
        total_rejected,
    )

    return ExtractionResult(
        candidates=all_candidates,
        rejected_count=total_rejected,
    )
