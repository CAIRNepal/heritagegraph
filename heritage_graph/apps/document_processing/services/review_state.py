from __future__ import annotations

import copy
from typing import Any


def merge_ingestion_review_state(existing: dict[str, Any] | None, patch: dict[str, Any]) -> dict[str, Any]:
    """Deep-merge contributor review draft (field decisions, block corrections, handoff key)."""
    base: dict[str, Any] = dict(existing or {})

    if "field_decisions" in patch and isinstance(patch["field_decisions"], dict):
        fd = dict(base.get("field_decisions") or {})
        for fk, fv in patch["field_decisions"].items():
            if fv is None:
                fd.pop(str(fk), None)
            elif isinstance(fv, dict):
                prev = dict(fd.get(str(fk)) or {})
                for ik, iv in fv.items():
                    if iv is None:
                        prev.pop(ik, None)
                    else:
                        prev[ik] = iv
                fd[str(fk)] = prev
        base["field_decisions"] = fd

    if "block_corrections" in patch and isinstance(patch["block_corrections"], dict):
        bc = dict(base.get("block_corrections") or {})
        for bk, bv in patch["block_corrections"].items():
            if bv is None:
                bc.pop(str(bk), None)
            elif isinstance(bv, dict):
                bc[str(bk)] = bv
        base["block_corrections"] = bc

    if "ontology_handoff_key" in patch:
        v = patch["ontology_handoff_key"]
        if v is None or v == "":
            base.pop("ontology_handoff_key", None)
        else:
            base["ontology_handoff_key"] = str(v)

    if "finalized_at" in patch:
        v = patch["finalized_at"]
        if v is None or v == "":
            base.pop("finalized_at", None)
        else:
            base["finalized_at"] = str(v)

    return base


def pages_with_block_corrections(
    pages_out: list[dict[str, Any]],
    review_state: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Apply saved OCR line corrections for review payload (engine-agnostic)."""
    block_corrections = (review_state or {}).get("block_corrections") or {}
    if not block_corrections:
        return pages_out

    merged: list[dict[str, Any]] = []
    for page in pages_out:
        page_copy = copy.deepcopy(page)
        blocks = page_copy.get("blocks")
        if not isinstance(blocks, list):
            merged.append(page_copy)
            continue
        pn = int(page_copy.get("page_number") or 0)
        new_blocks: list[dict[str, Any]] = []
        for idx, block in enumerate(blocks):
            if not isinstance(block, dict):
                new_blocks.append(block)
                continue
            b = dict(block)
            key = f"{pn}_{idx}"
            corr = block_corrections.get(key)
            if isinstance(corr, dict) and "corrected_text" in corr:
                raw_txt = b.get("text")
                if raw_txt is not None and "original_text" not in b:
                    b["original_text"] = raw_txt
                b["text"] = str(corr.get("corrected_text") or "")
            new_blocks.append(b)
        page_copy["blocks"] = new_blocks
        merged.append(page_copy)
    return merged
