"""
Suggest external authority alignments for EntityCluster rows.

v1: Wikidata label search + GeoNames for places. Reviewer accepts via cluster
``external_identifiers`` update (existing API).
"""

from __future__ import annotations

import logging
import re
from typing import Any

import requests

logger = logging.getLogger(__name__)

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
GEONAMES_SEARCH = "http://api.geonames.org/searchJSON"
GETTY_AAT_SPARQL = "http://vocab.getty.edu/sparql.json"


def suggest_getty_aat(label: str, *, limit: int = 5) -> list[dict[str, Any]]:
    """
    Query Getty AAT SPARQL endpoint for term matches.

    Returns candidates: {authority, iri, label, description, score}.
    Score is 1.0 for an exact case-insensitive match, 0.85 otherwise.
    """
    q = _normalize_label(label)
    if not q:
        return []
    sparql = f"""
SELECT ?Subject ?Term WHERE {{
  ?Subject a skos:Concept ;
           skos:inScheme aat: ;
           rdfs:label|skos:prefLabel ?Term .
  FILTER(LANG(?Term) = "en" || LANG(?Term) = "")
  FILTER(CONTAINS(LCASE(STR(?Term)), LCASE("{q}")))
}} LIMIT {limit}
"""
    try:
        resp = requests.get(
            GETTY_AAT_SPARQL,
            params={"query": sparql},
            headers={"Accept": "application/sparql-results+json"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Getty AAT query failed: %s", exc)
        return []

    out: list[dict[str, Any]] = []
    for row in data.get("results", {}).get("bindings", []):
        iri = row.get("Subject", {}).get("value", "")
        lbl = row.get("Term", {}).get("value", "") or q
        if not iri:
            continue
        score = 1.0 if lbl.lower() == q.lower() else 0.85
        out.append({"authority": "getty_aat", "iri": iri, "label": lbl, "description": "", "score": score})
    return out


def reconcile_assertion(assertion_id: str) -> dict[str, Any]:
    """
    Attempt reconciliation for one HeritageAssertion.

    Queries Getty AAT and Wikidata with the asserted_value as label.
    Updates assertion.reconciliation_status and writes skos:exactMatch to the
    outbox when a high-confidence match is found.

    Returns a result dict with 'status', 'match_iri', 'authority'.
    """
    from apps.cidoc_data.models import HeritageAssertion

    try:
        assertion = HeritageAssertion.objects.get(pk=assertion_id)
    except HeritageAssertion.DoesNotExist:
        logger.warning("reconcile_assertion: assertion %s not found", assertion_id)
        return {"status": "not_found"}

    label = (assertion.asserted_value or "").strip()
    if not label:
        return {"status": "skipped"}

    candidates: list[dict[str, Any]] = []
    candidates.extend(suggest_getty_aat(label, limit=3))
    candidates.extend(suggest_wikidata(label, limit=3))

    if not candidates:
        HeritageAssertion.objects.filter(pk=assertion_id).update(
            reconciliation_status="no_match"
        )
        return {"status": "no_match"}

    best = max(candidates, key=lambda c: float(c.get("score", 0)))
    score = float(best.get("score", 0))

    if score >= 0.95:
        new_status = "reconciled"
    elif score >= 0.75:
        new_status = "close_match"
    else:
        new_status = "unverified"

    HeritageAssertion.objects.filter(pk=assertion_id).update(reconciliation_status=new_status)

    if new_status in {"reconciled", "close_match"}:
        _write_exact_match_to_outbox(assertion, best["iri"], new_status)

    return {"status": new_status, "match_iri": best["iri"], "authority": best["authority"]}


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


def _write_exact_match_to_outbox(assertion: Any, match_iri: str, status: str) -> None:
    """Insert skos:exactMatch or skos:closeMatch triple for the assertion's subject."""
    try:
        from apps.graph.kg_engine.engine import get_kg_engine
        from apps.graph.kg_engine.partitions import GraphPartition
        from apps.graph.kg_engine.uris import resource_uri_for_instance

        if assertion.content_type_id is None or assertion.object_id is None:
            return
        from django.contrib.contenttypes.models import ContentType

        ct = ContentType.objects.get(pk=assertion.content_type_id)
        model = ct.model_class()
        if model is None:
            return
        subj_inst = model.objects.filter(pk=assertion.object_id).first()
        if subj_inst is None:
            return
        subj_uri = resource_uri_for_instance(subj_inst)
        pred = (
            "http://www.w3.org/2004/02/skos/core#exactMatch"
            if status == "reconciled"
            else "http://www.w3.org/2004/02/skos/core#closeMatch"
        )
        graph_uri = GraphPartition.ALIGNMENT.uri()
        if not graph_uri:
            return
        engine = get_kg_engine()
        engine.store.upsert_object_triple(
            subject_uri=subj_uri,
            pred_uri=pred,
            object_uri=match_iri,
            graph_uri=graph_uri,
        )
        logger.info("Reconciliation: %s %s %s", subj_uri, pred.split("#")[-1], match_iri)
    except Exception as exc:
        logger.warning("Could not write reconciliation match to outbox: %s", exc)


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
