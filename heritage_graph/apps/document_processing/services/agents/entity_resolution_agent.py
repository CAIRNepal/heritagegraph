"""
Agent 4 — Entity Resolution Agent

Co-reference, transliteration normalization, SPARQL lookup, fuzzy matching,
and URI minting with resolution confidence scores.
"""

from __future__ import annotations

import logging
from dataclasses import replace

from .confidence import calibrate, entity_resolution_score
from .config import DEFAULT_CONFIG, PipelineConfig
from .ontology import CLASS_URI, is_literal_type, mint_entity_uri
from .sparql import SparqlClient
from .types import (
    EntityResolutionResult,
    ResolvedAssertion,
    ShaclValidationResult,
    ValidatedAssertion,
)

logger = logging.getLogger(__name__)

_TRANSLITERATION_MAP: dict[str, str] = {
    "swayambhu": "Swayambhunath",
    "swayambhunath": "Swayambhunath",
    "swayambhu nath": "Swayambhunath",
    "स्वयम्भू": "Swayambhunath",
    "swoyambhu": "Swayambhunath",
    "pashupati": "Pashupatinath",
    "pashupatinath": "Pashupatinath",
    "पशुपतिनाथ": "Pashupatinath",
    "boudha": "Boudhanath",
    "boudhanath": "Boudhanath",
    "bodhnath": "Boudhanath",
    "bauddha": "Boudhanath",
    "baudhanath": "Boudhanath",
    "बौद्धनाथ": "Boudhanath",
    "changu narayan": "Changu Narayan",
    "changnarayan": "Changu Narayan",
    "चाँगुनारायण": "Changu Narayan",
    "bhadgaon": "Bhaktapur",
    "bhaktapur": "Bhaktapur",
    "भक्तपुर": "Bhaktapur",
    "patan": "Lalitpur",
    "lalitpur": "Lalitpur",
    "ललितपुर": "Lalitpur",
    "kantipur": "Kathmandu",
    "kathmandu": "Kathmandu",
    "काठमाडौँ": "Kathmandu",
    "kumari": "Kumari",
    "living goddess": "Kumari",
    "देवी": "Kumari",
    "licchhavi": "Lichhavi",
    "lichhavi": "Lichhavi",
    "lichavi": "Lichhavi",
    "malla": "Malla",
    "manadeva": "Manadeva",
    "mandeva": "Manadeva",
    "amshuverma": "Amshuverma",
    "amsuvarma": "Amshuverma",
}

_COREF_TRIGGERS: dict[str, frozenset[str]] = {
    "E22_Human-Made_Object": frozenset({
        "the temple", "the shrine", "the monument", "the structure",
        "the building", "the pagoda", "it", "this",
    }),
    "E21_Person": frozenset({
        "the king", "the ruler", "the person", "the individual",
        "he", "she", "they", "the queen", "the priest",
    }),
    "E53_Place": frozenset({
        "the place", "the location", "the site", "the city",
        "the town", "the village", "there",
    }),
    "E74_Group": frozenset({
        "the group", "the community", "the organization",
        "the institution", "the caste", "they",
    }),
    "E4_Period": frozenset({
        "the period", "the era", "the dynasty", "the reign", "the time",
    }),
}


def _normalize_name(name: str) -> str:
    key = name.strip().lower()
    return _TRANSLITERATION_MAP.get(key, name.strip())


def _is_coref(name: str, class_label: str) -> bool:
    triggers = _COREF_TRIGGERS.get(class_label, frozenset())
    return name.strip().lower() in triggers


def _fuzzy_best(
    name: str,
    candidates: list[tuple[str, str]],
) -> tuple[str, float] | None:
    try:
        from rapidfuzz import fuzz
    except ImportError:
        return None

    best_uri, best_score = "", 0.0
    name_lower = name.lower()
    for uri, lbl in candidates:
        score = float(fuzz.ratio(name_lower, lbl.lower()))
        if score > best_score:
            best_score, best_uri = score, uri
    return (best_uri, best_score) if best_uri else None


def _resolve_entity(
    name: str,
    class_label: str,
    chunk_id: str,
    coref_registry: dict[str, dict[str, str]],
    client: SparqlClient,
    *,
    fuzzy_threshold: int,
    lookup_limit: int,
) -> tuple[str, bool, str, float]:
    """Returns (uri, is_new, note, resolution_score)."""
    notes: list[str] = []

    if _is_coref(name, class_label):
        last_uri = coref_registry.get(chunk_id, {}).get(class_label)
        if last_uri:
            score = entity_resolution_score(coref=True)
            return last_uri, False, f"co-ref '{name}' → {last_uri}", score

    canonical = _normalize_name(name)
    if canonical != name:
        notes.append(f"transliteration: '{name}' → '{canonical}'")

    class_u = CLASS_URI.get(class_label)
    exact_hits = client.exact_label_lookup(canonical, class_u)
    if not exact_hits and canonical != name:
        exact_hits = client.exact_label_lookup(name, class_u)
    if exact_hits:
        score = entity_resolution_score(exact_match=True)
        note = f"exact '{canonical}' → {exact_hits[0]}"
        if notes:
            note = "; ".join(notes) + "; " + note
        return exact_hits[0], False, note, score

    label_cands = client.label_candidates(class_u, limit=lookup_limit)
    best = _fuzzy_best(canonical, label_cands)
    if best:
        best_uri, fuzz_score = best
        if fuzz_score >= fuzzy_threshold:
            score = entity_resolution_score(fuzzy_score=fuzz_score)
            note = f"fuzzy ({fuzz_score:.0f}%) '{canonical}' → {best_uri}"
            if notes:
                note = "; ".join(notes) + "; " + note
            return best_uri, False, note, score

    new_uri = mint_entity_uri(class_label)
    score = entity_resolution_score(minted=True)
    note = f"minted '{canonical}' → {new_uri}"
    if notes:
        note = "; ".join(notes) + "; " + note
    return new_uri, True, note, score


def _update_candidate_confidence(
    validated: ValidatedAssertion,
    subject_score: float,
    object_score: float,
) -> ValidatedAssertion:
    cand = validated.candidate
    bd = cand.confidence_breakdown or {}
    ext = float(bd.get("extraction_agreement", 0.5))
    ont = float(bd.get("ontology_grounding", 0.8))
    shacl_s = float(bd.get("shacl_validity", 1.0))
    ocr = float(bd.get("ocr_quality", 1.0))
    ent_score = min(subject_score, object_score)
    breakdown = calibrate(ext, ont, shacl_s, ent_score, ocr)
    new_cand = replace(
        cand,
        confidence_score=breakdown.composite,
        confidence_breakdown=breakdown.to_dict(),
    )
    return replace(validated, candidate=new_cand)


def run_entity_resolution(
    shacl_result: ShaclValidationResult,
    *,
    oxigraph_url: str | None = None,
    config: PipelineConfig | None = None,
) -> EntityResolutionResult:
    """Agent 4 entry point."""
    cfg = config or DEFAULT_CONFIG
    url = oxigraph_url or cfg.oxigraph_url
    client = SparqlClient(url)

    coref_registry: dict[str, dict[str, str]] = {}
    resolved: list[ResolvedAssertion] = []
    skipped = 0

    for validated in shacl_result.validated:
        triple = validated.candidate.triple
        chunk_id = validated.candidate.source_chunk_id
        notes: list[str] = []

        try:
            subj_uri, subj_new, subj_note, subj_score = _resolve_entity(
                triple.subject,
                triple.subject_type,
                chunk_id,
                coref_registry,
                client,
                fuzzy_threshold=cfg.entity_fuzzy_threshold,
                lookup_limit=cfg.entity_lookup_limit,
            )
            notes.append(f"subject: {subj_note}")
            coref_registry.setdefault(chunk_id, {})[triple.subject_type] = subj_uri

            obj_uri: str | None = None
            obj_new = False
            obj_score = 1.0
            if not is_literal_type(triple.object_type):
                obj_uri, obj_new, obj_note, obj_score = _resolve_entity(
                    triple.object,
                    triple.object_type,
                    chunk_id,
                    coref_registry,
                    client,
                    fuzzy_threshold=cfg.entity_fuzzy_threshold,
                    lookup_limit=cfg.entity_lookup_limit,
                )
                notes.append(f"object: {obj_note}")
                coref_registry.setdefault(chunk_id, {})[triple.object_type] = obj_uri
            else:
                notes.append("object: literal")

            validated = _update_candidate_confidence(validated, subj_score, obj_score)

            resolved.append(
                ResolvedAssertion(
                    validated=validated,
                    subject_uri=subj_uri,
                    object_uri=obj_uri,
                    subject_is_new=subj_new,
                    object_is_new=obj_new,
                    resolution_notes=notes,
                    subject_resolution_score=subj_score,
                    object_resolution_score=obj_score,
                )
            )
        except Exception:
            logger.warning(
                "Entity resolution failed for (%s, %s, %s)",
                triple.subject,
                triple.predicate,
                triple.object,
                exc_info=True,
            )
            skipped += 1

    logger.info(
        "Entity resolution: %d resolved, %d skipped",
        len(resolved),
        skipped,
    )
    return EntityResolutionResult(resolved=resolved, skipped_count=skipped)
