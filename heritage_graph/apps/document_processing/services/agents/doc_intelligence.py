"""
Agent 1 — Document Intelligence Agent

Responsibilities:
- Classify heritage document type (inscription | chronicle | survey_report | oral_history | gazette)
- Detect language (Nepali / Sanskrit / Newari / English)
- Semantic chunking with ontology-hint assignment per chunk
- Select the relevant CIDOC ontology snippet for downstream extraction
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import TYPE_CHECKING

from .types import DocumentChunk, DocumentIntelligenceResult, HeritageDocType

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_OLLAMA_MODEL = "llama3.1:70b"

# Maps heritage doc type → relevant CIDOC class keys in the schema registry
_DOC_TYPE_ONTOLOGY_MAP: dict[HeritageDocType, list[str]] = {
    HeritageDocType.INSCRIPTION: ["structure", "iconography"],
    HeritageDocType.CHRONICLE: ["structure", "ritual", "festival", "tradition"],
    HeritageDocType.SURVEY_REPORT: ["structure", "iconography", "tradition"],
    HeritageDocType.ORAL_HISTORY: ["ritual", "festival", "tradition"],
    HeritageDocType.GAZETTE: ["structure", "tradition"],
    HeritageDocType.UNKNOWN: ["structure", "ritual", "festival", "tradition", "iconography"],
}

# Keyword heuristics used as fallback when Ollama is unavailable
_HEURISTIC_KEYWORDS: dict[HeritageDocType, list[str]] = {
    HeritageDocType.INSCRIPTION: [
        "inscription", "stone inscription", "śilālekha", "lipi", "shilalekha",
        "carved", "engraved", "temple pillar",
    ],
    HeritageDocType.CHRONICLE: [
        "chronicle", "vaṃśāvali", "vamsavali", "gopalavamsavali",
        "royal history", "dynasty", "king", "reign", "ruled",
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

Respond with a JSON object: {"type": "<one of the five>", "confidence": <0.0-1.0>}
No other text.

Document excerpt (first 600 chars):
{excerpt}
"""


def _classify_with_ollama(text: str) -> tuple[HeritageDocType, float]:
    try:
        import json

        import ollama

        excerpt = text[:600].replace("\n", " ")
        response = ollama.chat(
            model=_OLLAMA_MODEL,
            messages=[
                {"role": "user", "content": _CLASSIFICATION_PROMPT.format(excerpt=excerpt)}
            ],
            options={"temperature": 0.1},
        )
        raw = response["message"]["content"].strip()
        # Strip markdown fences if any
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
        # Map langdetect codes to our labels
        return {
            "ne": "Nepali",
            "sa": "Sanskrit",
            "en": "English",
            "hi": "Hindi",
        }.get(lang, lang)
    except Exception:
        return "unknown"


def _sentence_split(text: str) -> list[str]:
    """Sentence-aware split used when chonkie is unavailable."""
    sentences = re.split(r"(?<=[।॥.!?])\s+|\n{2,}", text)
    return [s.strip() for s in sentences if s.strip()]


def _semantic_chunks(text: str, max_tokens: int = 256) -> list[tuple[str, int, int]]:
    """
    Returns list of (chunk_text, char_start, char_end).
    Uses chonkie if available, otherwise falls back to sentence-batching.
    """
    try:
        from chonkie import SentenceChunker

        chunker = SentenceChunker(chunk_size=max_tokens, chunk_overlap=20)
        raw_chunks = chunker.chunk(text)
        result = []
        for c in raw_chunks:
            start = text.find(c.text)
            end = start + len(c.text) if start != -1 else len(text)
            result.append((c.text, max(0, start), end))
        return result
    except Exception:
        pass

    # Fallback: batch sentences up to max_tokens (approximate by char count)
    sentences = _sentence_split(text)
    chunks: list[tuple[str, int, int]] = []
    current_sentences: list[str] = []
    current_len = 0
    char_cursor = 0

    for sentence in sentences:
        token_approx = len(sentence.split())
        if current_sentences and current_len + token_approx > max_tokens:
            chunk_text = " ".join(current_sentences)
            end = char_cursor
            start = end - len(chunk_text)
            chunks.append((chunk_text, max(0, start), end))
            current_sentences = []
            current_len = 0
        current_sentences.append(sentence)
        current_len += token_approx
        char_cursor += len(sentence) + 1

    if current_sentences:
        chunk_text = " ".join(current_sentences)
        end = char_cursor
        start = max(0, end - len(chunk_text))
        chunks.append((chunk_text, start, end))

    return chunks


def _build_ontology_snippet(class_keys: list[str]) -> dict:
    """Pull the relevant CIDOC classes from the schema registry."""
    try:
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        payload = get_effective_registry_payload()
        all_classes = payload.get("classes") or {}
        return {k: all_classes[k] for k in class_keys if k in all_classes}
    except Exception:
        logger.debug("Registry not available; ontology snippet will be empty", exc_info=True)
        return {}


def run_doc_intelligence(
    *,
    text: str,
    use_ollama: bool = True,
    chunk_max_tokens: int = 256,
) -> DocumentIntelligenceResult:
    """
    Entry point for Agent 1.

    Args:
        text: Full OCR-extracted document text.
        use_ollama: If True, attempt Ollama classification first.
        chunk_max_tokens: Approximate max tokens per chunk.

    Returns:
        DocumentIntelligenceResult with doc type, language, chunks, ontology snippet.
    """
    if not text or not text.strip():
        return DocumentIntelligenceResult(
            heritage_doc_type=HeritageDocType.UNKNOWN,
            heritage_doc_type_confidence=0.0,
            detected_language="unknown",
            chunks=[],
            ontology_snippet={},
        )

    # Step 1: classify heritage document type
    if use_ollama:
        doc_type, confidence = _classify_with_ollama(text)
    else:
        doc_type, confidence = _classify_with_heuristics(text)

    # Step 2: language detection
    language = _detect_language(text)

    # Step 3: determine ontology class keys for this doc type
    class_keys = _DOC_TYPE_ONTOLOGY_MAP.get(doc_type, _DOC_TYPE_ONTOLOGY_MAP[HeritageDocType.UNKNOWN])

    # Step 4: build ontology snippet from registry
    ontology_snippet = _build_ontology_snippet(class_keys)

    # Step 5: semantic chunking
    raw_chunks = _semantic_chunks(text, max_tokens=chunk_max_tokens)
    chunks: list[DocumentChunk] = []
    for chunk_text, char_start, char_end in raw_chunks:
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
            )
        )

    logger.info(
        "Doc Intelligence: type=%s (%.2f), lang=%s, chunks=%d",
        doc_type.value,
        confidence,
        language,
        len(chunks),
    )

    return DocumentIntelligenceResult(
        heritage_doc_type=doc_type,
        heritage_doc_type_confidence=confidence,
        detected_language=language,
        chunks=chunks,
        ontology_snippet=ontology_snippet,
    )
