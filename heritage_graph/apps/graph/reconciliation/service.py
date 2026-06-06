"""
Suggest external authority alignments for EntityCluster rows.

v1: Wikidata label search + GeoNames for places. Reviewer accepts via cluster
``external_identifiers`` update (existing API).
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
GEONAMES_SEARCH = "http://api.geonames.org/searchJSON"


def _normalize_label(label: str) -> str:
    return re.sub(r"\s+", " ", (label or "").strip())


def suggest_wikidata(label: str, *, language: str = "en", limit: int = 5) -> list[dict[str, Any]]:
    """Return candidate dicts: iri, label, description, score."""
    q = _normalize_label(label)
    if not q:
        return []
    try:
        resp = requests.get(
            WIKIDATA_API,
            params={
                "action": "wbsearchentities",
                "search": q,
                "language": language,
                "format": "json",
                "limit": limit,
            },
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Wikidata search failed: %s", exc)
        return []

    out: list[dict[str, Any]] = []
    for item in data.get("search", []) or []:
        eid = item.get("id")
        if not eid:
            continue
        iri = f"https://www.wikidata.org/entity/{eid}"
        out.append(
            {
                "authority": "wikidata",
                "iri": iri,
                "label": item.get("label") or q,
                "description": item.get("description") or "",
                "score": 0.85,
            }
        )
    return out


def suggest_geonames(
    label: str, *, username: str = "heritagegraph", limit: int = 5
) -> list[dict[str, Any]]:
    q = _normalize_label(label)
    if not q:
        return []
    try:
        resp = requests.get(
            GEONAMES_SEARCH,
            params={
                "q": q,
                "maxRows": limit,
                "username": username,
                "style": "FULL",
            },
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("GeoNames search failed: %s", exc)
        return []

    out: list[dict[str, Any]] = []
    for item in data.get("geonames", []) or []:
        gid = item.get("geonameId")
        if gid is None:
            continue
        out.append(
            {
                "authority": "geonames",
                "iri": f"http://sws.geonames.org/{gid}/",
                "label": item.get("name") or q,
                "description": item.get("countryName") or "",
                "score": 0.80,
            }
        )
    return out


def suggest_for_cluster(
    *,
    canonical_label: str,
    type_scope: str,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Combined suggestions ranked by simple heuristics."""
    candidates: list[dict[str, Any]] = []
    candidates.extend(suggest_wikidata(canonical_label, limit=limit))
    if type_scope in {"location", "place"}:
        candidates.extend(suggest_geonames(canonical_label, limit=limit))
    # Dedupe by IRI
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for c in sorted(candidates, key=lambda x: -float(x.get("score", 0))):
        iri = c.get("iri", "")
        if not iri or iri in seen:
            continue
        seen.add(iri)
        unique.append(c)
    return unique[:limit]
