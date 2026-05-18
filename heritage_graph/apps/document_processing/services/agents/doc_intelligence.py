"""
Agent 1 — Document Intelligence Agent

Responsibilities:
- Classify heritage document type
- Detect language (Nepali / Sanskrit / Newari / English / Hindi)
- Structure-aware semantic chunking with ontology hints
- Select CIDOC ontology snippet from schema registry
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from .config import DEFAULT_CONFIG, PipelineConfig
from .types import DocumentChunk, DocumentIntelligenceResult, HeritageDocType

logger = logging.getLogger(__name__)

_DOC_TYPE_ONTOLOGY_MAP: dict[HeritageDocType, list[str]] = {
    HeritageDocType.INSCRIPTION: ["structure", "iconography"],
    HeritageDocType.CHRONICLE: ["structure", "ritual", "festival", "tradition"],
    HeritageDocType.SURVEY_REPORT: ["structure", "iconography", "tradition"],
    HeritageDocType.ORAL_HISTORY: ["ritual", "festival", "tradition"],
    HeritageDocType.GAZETTE: ["structure", "tradition"],
    HeritageDocType.UNKNOWN: ["structure", "ritual", "festival", "tradition", "iconography"],
}

_HEURISTIC_KEYWORDS: dict[HeritageDocType, list[str]] = {
    HeritageDocType.INSCRIPTION: [
        "inscription", "stone inscription", "śilālekha", "lipi", "shilalekha",
        "carved", "engraved", "temple pillar", "शिलालेख",
    ],
    HeritageDocType.CHRONICLE: [
        "chronicle", "vaṃśāvali", "vamsavali", "gopalavamsavali",
        "royal history", "dynasty", "king", "reign", "ruled", "वंशावली",
    ],
    HeritageDocType.SURVEY_REPORT: [
        "survey", "assessment", "archaeological report", "documentation",
        "inventory", "field notes", "excavation",
    ],
    HeritageDocType.ORAL_HISTORY: [
        "oral tradition", "oral history", "narrative", "interview",
        "testimony", "storyteller", "legend",
    ],
    HeritageDocType.GAZETTE: [
        "gazette", "rajpatra", "government notice", "official notification",
        "act", "regulation", "ministry",
    ],
}

_CLASSIFICATION_PROMPT = """\
You are a Nepalese cultural heritage archivist. Classify the following document excerpt \
into exactly one of these heritage document types:

- inscription  : stone/metal inscriptions, śilālekha, donative records
- chronicle    : vamsavali, royal histories, dynastic chronicles
- survey_report: archaeological surveys, field assessments, heritage inventories
- oral_history : oral traditions, recorded interviews, folk narratives
- gazette      : official government records, rajpatra, legal notifications

Respond with a JSON object: {{"type": "<one of the five>", "confidence": <0.0-1.0>}}
No other text.

Document excerpt (first 600 chars):
{excerpt}
"""

# Citation / verse markers common in inscriptions and chronicles
_CITATION_RE = re.compile(
    r"(?:^|\n)\s*(?:श्लोक|sloka|verse|stanza|\d+\.|\[\d+\]|[०-९]+\.)",
    re.MULTILINE | re.IGNORECASE,
)
_PARAGRAPH_SPLIT_RE = re.compile(r"\n{2,}")

_LANG_MAP = {
    "ne": "Nepali",
    "sa": "Sanskrit",
    "en": "English",
    "hi": "Hindi",
    "new": "Newari",
    "bo": "Newari",  # langdetect sometimes maps Nepal Bhasa variants
}


def _classify_with_ollama(text: str, model: str) -> tuple[HeritageDocType, float]:
    try:
        import json

        import ollama

        excerpt = text[:600].replace("\n", " ")
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "user", "content": _CLASSIFICATION_PROMPT.format(excerpt=excerpt)}
            ],
            options={"temperature": 0.1},
        )
        raw = response["message"]["content"].strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw).strip()
        data = json.loads(raw)
        doc_type = HeritageDocType(data.get("type", "unknown"))
        confidence = float(data.get("confidence", 0.5))
        return doc_type, max(0.0, min(1.0, confidence))
    except Exception:
        logger.debug("Ollama classification failed; using heuristics", exc_info=True)
        return _classify_with_heuristics(text)


def _classify_with_heuristics(text: str) -> tuple[HeritageDocType, float]:
    lower = text[:2000].lower()
    scores: dict[HeritageDocType, int] = {t: 0 for t in HeritageDocType}
    for doc_type, keywords in _HEURISTIC_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in lower:
                scores[doc_type] += 1
    best = max(scores, key=lambda t: scores[t])
    total = sum(scores.values())
    confidence = (scores[best] / total) if total > 0 else 0.0
    if scores[best] == 0:
        return HeritageDocType.UNKNOWN, 0.0
    return best, min(0.75, 0.35 + confidence * 0.4)


def _detect_language(text: str) -> str:
    try:
        from langdetect import detect, LangDetectException

        sample = text[:3000]
        lang = detect(sample)
        return _LANG_MAP.get(lang, lang)
    except Exception:
        return "unknown"


def _detect_devanagari_ratio(text: str) -> float:
    if not text:
        return 0.0
    devanagari = sum(1 for c in text if "\u0900" <= c <= "\u097F")
    return devanagari / max(len(text), 1)


def _structural_label(chunk_text: str) -> str | None:
    if _CITATION_RE.search(chunk_text):
        return "citation"
    if re.search(r"^(?:Chapter|Section|अध्याय)\s", chunk_text, re.IGNORECASE | re.MULTILINE):
        return "section"
    return "paragraph"


def _sentence_split(text: str) -> list[str]:
    sentences = re.split(r"(?<=[।॥.!?])\s+|\n{2,}", text)
    return [s.strip() for s in sentences if s.strip()]


def _structure_aware_segments(text: str) -> list[tuple[str, int, int, str | None]]:
    """
    Split text into segments respecting paragraph and citation boundaries.
    Returns (segment_text, char_start, char_end, structural_label).
    """
    segments: list[tuple[str, int, int, str | None]] = []
    cursor = 0
    for para in _PARAGRAPH_SPLIT_RE.split(text):
        para = para.strip()
        if not para:
            continue
        start = text.find(para, cursor)
        if start == -1:
            start = cursor
        end = start + len(para)
        cursor = end
        label = _structural_label(para)
        if label == "citation" or len(para.split()) <= 80:
            segments.append((para, start, end, label))
        else:
            for sent in _sentence_split(para):
                s_start = text.find(sent, start)
                if s_start == -1:
                    s_start = start
                segments.append((sent, s_start, s_start + len(sent), "paragraph"))
    return segments or [(text, 0, len(text), "paragraph")]


def _semantic_chunks(
    text: str,
    *,
    max_tokens: int = 256,
    overlap_tokens: int = 20,
) -> list[tuple[str, int, int, str | None]]:
    try:
        from chonkie import SentenceChunker

        chunker = SentenceChunker(chunk_size=max_tokens, chunk_overlap=overlap_tokens)
        raw_chunks = chunker.chunk(text)
        result: list[tuple[str, int, int, str | None]] = []
        for c in raw_chunks:
            start = text.find(c.text)
            end = start + len(c.text) if start != -1 else len(text)
            result.append((c.text, max(0, start), end, _structural_label(c.text)))
        return result
    except Exception:
        pass

    segments = _structure_aware_segments(text)
    chunks: list[tuple[str, int, int, str | None]] = []
    current_parts: list[str] = []
    current_len = 0
    chunk_start = 0
    chunk_label: str | None = None

    for seg_text, seg_start, seg_end, seg_label in segments:
        token_approx = len(seg_text.split())
        if current_parts and current_len + token_approx > max_tokens:
            chunk_text = " ".join(current_parts)
            chunks.append((chunk_text, chunk_start, seg_start, chunk_label))
            overlap_parts = current_parts[-2:] if overlap_tokens > 0 else []
            current_parts = overlap_parts
            current_len = sum(len(p.split()) for p in current_parts)
            chunk_start = seg_start
            chunk_label = seg_label
        current_parts.append(seg_text)
        current_len += token_approx
        if chunk_label is None:
            chunk_label = seg_label

    if current_parts:
        chunk_text = " ".join(current_parts)
        end = segments[-1][2] if segments else len(text)
        chunks.append((chunk_text, chunk_start, end, chunk_label))

    return chunks


def _build_ontology_snippet(class_keys: list[str]) -> dict:
    try:
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        payload = get_effective_registry_payload()
        all_classes = payload.get("classes") or {}
        return {k: all_classes[k] for k in class_keys if k in all_classes}
    except Exception:
        logger.debug("Registry not available; ontology snippet will be empty", exc_info=True)
        return {}


def _estimate_ocr_quality(
    text: str,
    document_metadata: dict[str, Any] | None,
    explicit_estimate: float,
) -> float:
    if document_metadata:
        for key in ("ocr_confidence", "mean_ocr_confidence", "classification_confidence"):
            val = document_metadata.get(key)
            if val is not None:
                try:
                    return max(0.0, min(1.0, float(val)))
                except (TypeError, ValueError):
                    pass
    if explicit_estimate < 1.0:
        return explicit_estimate
    dev_ratio = _detect_devanagari_ratio(text)
    if dev_ratio > 0.3:
        return 0.95
    return 1.0


def run_doc_intelligence(
    *,
    text: str,
    use_ollama: bool = True,
    chunk_max_tokens: int = 256,
    chunk_overlap: int = 20,
    ocr_quality_estimate: float = 1.0,
    document_metadata: dict[str, Any] | None = None,
    config: PipelineConfig | None = None,
) -> DocumentIntelligenceResult:
    """
    Entry point for Agent 1.

    Args:
        text: Full OCR-extracted document text.
        use_ollama: Attempt LLM classification before heuristics.
        chunk_max_tokens: Approximate max tokens per chunk.
        chunk_overlap: Token overlap between adjacent chunks.
        ocr_quality_estimate: Prior OCR quality (0–1) for downstream confidence.
        document_metadata: UploadedDocument.metadata for OCR confidence propagation.
        config: Pipeline configuration override.

    Returns:
        DocumentIntelligenceResult with doc type, language, chunks, ontology snippet.
    """
    cfg = config or DEFAULT_CONFIG
    model = cfg.ollama_model

    if not text or not text.strip():
        return DocumentIntelligenceResult(
            heritage_doc_type=HeritageDocType.UNKNOWN,
            heritage_doc_type_confidence=0.0,
            detected_language="unknown",
            chunks=[],
            ontology_snippet={},
            ocr_quality_estimate=0.0,
        )

    if use_ollama:
        doc_type, confidence = _classify_with_ollama(text, model)
    else:
        doc_type, confidence = _classify_with_heuristics(text)

    language = _detect_language(text)
    class_keys = _DOC_TYPE_ONTOLOGY_MAP.get(doc_type, _DOC_TYPE_ONTOLOGY_MAP[HeritageDocType.UNKNOWN])
    ontology_snippet = _build_ontology_snippet(class_keys)

    ocr_quality = _estimate_ocr_quality(text, document_metadata, ocr_quality_estimate)

    raw_chunks = _semantic_chunks(
        text,
        max_tokens=chunk_max_tokens or cfg.chunk_max_tokens,
        overlap_tokens=chunk_overlap or cfg.chunk_overlap_tokens,
    )
    chunks: list[DocumentChunk] = []
    for chunk_text, char_start, char_end, struct_label in raw_chunks:
        chunk_lang = _detect_language(chunk_text) if len(chunk_text) > 80 else language
        chunks.append(
            DocumentChunk(
                chunk_id=str(uuid.uuid4()),
                text=chunk_text,
                char_start=char_start,
                char_end=char_end,
                language=chunk_lang,
                ontology_hint=class_keys,
                token_count=len(chunk_text.split()),
                ocr_confidence=ocr_quality,
                structural_label=struct_label,
            )
        )

    logger.info(
        "Doc Intelligence: type=%s (%.2f), lang=%s, chunks=%d, ocr_q=%.2f",
        doc_type.value,
        confidence,
        language,
        len(chunks),
        ocr_quality,
    )

    return DocumentIntelligenceResult(
        heritage_doc_type=doc_type,
        heritage_doc_type_confidence=confidence,
        detected_language=language,
        chunks=chunks,
        ontology_snippet=ontology_snippet,
        ocr_quality_estimate=ocr_quality,
    )
