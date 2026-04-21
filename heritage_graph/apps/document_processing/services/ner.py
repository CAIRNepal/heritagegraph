from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExtractedNerItem:
    field_name: str
    field_value: str
    source_entity_type: str
    confidence: float


YEAR_RE = re.compile(r"\b(1[0-9]{3}|2[0-9]{3})\b")


def naive_extract(*, text: str) -> list[ExtractedNerItem]:
    """
    v1: deterministic, local extraction for MVPs. Used when no LLM key or as fallback.
    """
    t = (text or "").strip()
    if not t:
        return []

    items: list[ExtractedNerItem] = []
    for m in YEAR_RE.finditer(t):
        year = m.group(0)
        items.append(
            ExtractedNerItem(
                field_name="date_year_hint",
                field_value=year,
                source_entity_type="DATE",
                confidence=0.45,
            )
        )

    first_line = t.splitlines()[0].strip() if t else ""
    if 1 < len(first_line) <= 160:
        items.append(
            ExtractedNerItem(
                field_name="title_line_hint",
                field_value=first_line,
                source_entity_type="OTHER",
                confidence=0.3,
            )
        )

    return items


def _llm_registry_extract(*, text: str, class_key: str, api_key: str) -> list[ExtractedNerItem]:
    from anthropic import Anthropic

    from apps.cidoc_data.linkml_loader import get_effective_registry_payload

    registry = get_effective_registry_payload()
    cls = (registry.get("classes") or {}).get(class_key) or {}
    fields = cls.get("fields") or []
    lines: list[str] = []
    for f in fields[:120]:
        fk = f.get("key")
        if not fk:
            continue
        lines.append(
            f"- {fk}: type={f.get('type', 'text')} label={f.get('label', '')} "
            f"required={bool(f.get('required'))}"
        )
    schema_hint = "\n".join(lines) or "(no fields)"
    body = (
        f"You extract structured heritage metadata from a document. "
        f"Ontology class key: {class_key}.\n"
        f"Allowed field keys (use only these for field_name):\n{schema_hint}\n\n"
        "Return a single JSON object with key \"extractions\": an array of objects, each with:\n"
        '  "field_name" (string, must match a key above),\n'
        '  "field_value" (string),\n'
        '  "confidence" (number 0-1),\n'
        '  "evidence_span" (short verbatim quote from the text, may be empty).\n'
        "If nothing matches, return {\"extractions\": []}.\n\n"
        f"Document text:\n{(text or '')[:100000]}"
    )

    client = Anthropic(api_key=api_key)
    model = getattr(settings, "ANTHROPIC_OCR_MODEL", "claude-3-5-sonnet-20241022")
    msg = client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": body}],
    )
    raw_text = ""
    for block in msg.content:
        if hasattr(block, "text"):
            raw_text += block.text
    raw_text = raw_text.strip()
    if not raw_text:
        return naive_extract(text=text)
    # Strip markdown fences if any
    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```[a-zA-Z]*\n?", "", raw_text)
        raw_text = re.sub(r"\n?```$", "", raw_text).strip()
    data = json.loads(raw_text)
    rows = data.get("extractions") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return naive_extract(text=text)
    allowed = {f.get("key") for f in fields if f.get("key")}
    out: list[ExtractedNerItem] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        fn = str(row.get("field_name") or "").strip()
        fv = str(row.get("field_value") or "").strip()
        if not fn or not fv or (allowed and fn not in allowed):
            continue
        try:
            conf = float(row.get("confidence", 0.5))
        except (TypeError, ValueError):
            conf = 0.5
        conf = max(0.0, min(1.0, conf))
        out.append(
            ExtractedNerItem(
                field_name=fn,
                field_value=fv,
                source_entity_type="LLM",
                confidence=conf,
            )
        )
    return out or naive_extract(text=text)


def extract_structured_fields(
    *, text: str, ontology_class_key: str | None = None
) -> list[ExtractedNerItem]:
    """
    Registry-aware extraction when ANTHROPIC_API_KEY is set and a class key is given;
    otherwise deterministic naive_extract.
    """
    api_key = (
        getattr(settings, "ANTHROPIC_API_KEY", None)
        or os.environ.get("ANTHROPIC_API_KEY", "")
        or ""
    ).strip()
    if ontology_class_key and api_key:
        try:
            return _llm_registry_extract(
                text=text, class_key=ontology_class_key, api_key=api_key
            )
        except Exception:
            logger.exception("LLM registry extract failed; using naive_extract")
    return naive_extract(text=text)
