"""Canonical URI policy for knowledge graph resources."""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from django.conf import settings

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.ontology_config import RDF_PREFIXES, expand_curie

# CRM property codes, e.g. ``P74_has_current_or_former_residence``.
_CRM_PROPERTY_CODE = re.compile(r"^P\d+[A-Za-z0-9._-]*$")


def resource_base() -> str:
    return str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")


def curated_resource_uri_prefix() -> str:
    """Prefix for HeritageGraph-owned curated instance IRIs (not bulk imports)."""
    return f"{resource_base()}/"


def is_curated_resource_uri(iri: str | None) -> bool:
    """True when *iri* lives in the curated resource namespace."""
    if not iri:
        return False
    return str(iri).startswith(curated_resource_uri_prefix())


def is_non_curated_instance_iri(iri: str | None) -> bool:
    """True when *iri* looks like a foreign **instance** imported into PUBLIC by mistake.

    Ontology class IRIs, CRM codes, W3C vocab, and graph partition IRIs are **not**
    treated as pollution (``rdf:type`` and ``skos:exactMatch`` targets must survive).
    """
    if not iri or not str(iri).startswith(("http://", "https://")):
        return False
    text = str(iri)
    if text.startswith(curated_resource_uri_prefix()):
        return False
    if "/imported/" in text or "lux.collections.yale.edu" in text:
        return True
    allowed_prefixes = (
        "http://www.w3.org/",
        "http://www.wikidata.org/",
        "https://www.wikidata.org/",
        "http://www.cidoc-crm.org/",
        "http://www.w3.org/2006/time",
        "http://www.opengis.net/",
        "http://purl.org/dc/",
        "http://www.nanopub.org/",
        "https://creativecommons.org/",
        "https://vocab.getty.edu/",
        "https://w3id.org/heritagegraph/graph/",
    )
    if any(text.startswith(p) for p in allowed_prefixes):
        return False
    hg = RDF_PREFIXES.get("heritageGraph", "https://w3id.org/heritagegraph/")
    if text.startswith(hg) and "/resource/" not in text:
        return False
    return True


def is_public_graph_pollution(*, subject: str, object_iri: str | None) -> bool:
    """Whether a triple in PUBLIC should be removed (bulk import / wrong instance IRIs)."""
    if not subject.startswith(curated_resource_uri_prefix()):
        return True
    return is_non_curated_instance_iri(object_iri)


def curated_resource_uri_filter(*, var: str = "?s") -> str:
    """SPARQL FILTER: keep only curated resource IRIs (excludes bulk imports like LUX)."""
    prefix = curated_resource_uri_prefix()
    return f'FILTER(STRSTARTS(STR({var}), "{prefix}"))'


def resource_uri_for_instance(instance: Any) -> str:
    segment = instance.__class__.__name__.lower()
    try:
        from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model

        rk = registry_class_key_for_model(instance.__class__)
        if rk:
            segment = str(rk).strip().lower()
    except Exception:
        pass
    return f"{resource_base()}/{segment}/{instance.pk}"


def cultural_entity_uri(entity_id: Any) -> str:
    return f"{resource_base()}/entity/{entity_id}"


@lru_cache(maxsize=1)
def _slot_uri_by_key() -> dict[str, str]:
    """Map every registry field key → its ontology slot_uri (CURIE).

    Lets moderated ``relationship.*`` edges resolve to the SAME canonical
    predicate IRI as the FK-slot projection, eliminating duplicate predicates.
    """
    out: dict[str, str] = {}
    try:
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        payload = get_effective_registry_payload() or {}
    except Exception:
        return out
    for cls in (payload.get("classes") or {}).values():
        for field in (cls or {}).get("fields") or ():
            key = field.get("key")
            slot_uri = field.get("slot_uri")
            if key and slot_uri and key not in out:
                out[key] = str(slot_uri)
    return out


def legacy_property_predicate_uri(suffix: str) -> str:
    """Deprecated ad-hoc predicate IRIs under ``{resource_base}/property/``."""
    return f"{resource_base()}/property/{(suffix or '').lstrip('/')}"


def legacy_property_predicate_prefix() -> str:
    return f"{resource_base()}/property/"


def relationship_predicate_uri(prop_suffix: str) -> str:
    """Resolve a ``relationship.<suffix>`` predicate to a real, declared IRI.

    Resolution order (avoids the prior ``{base}/property/<suffix>`` ghost
    predicates that were undefined in the ontology):
      1. a known ontology slot → its canonical ``slot_uri``;
      2. a CIDOC-CRM property code (``P…``) → the CRM namespace;
      3. otherwise the heritageGraph ontology namespace (declarable), not an
         ad-hoc resource path.
    """
    raw = (prop_suffix or "").strip()
    prefix = "relationship."
    suffix = (raw[len(prefix):] if raw.startswith(prefix) else raw).strip()
    if not suffix:
        return f"{resource_base()}/property/"

    slot_uri = _slot_uri_by_key().get(suffix)
    if slot_uri:
        return expand_curie(slot_uri)
    if _CRM_PROPERTY_CODE.match(suffix):
        return RDF_PREFIXES["crm"] + suffix
    return RDF_PREFIXES.get("heritageGraph", "https://w3id.org/heritagegraph/") + suffix


def document_graph_uri(document_id: str) -> str:
    return GraphPartition.DOCUMENT.uri(suffix=str(document_id)) or ""


def label_for_instance(instance: Any) -> str:
    for attr in ("name", "title"):
        value = getattr(instance, attr, None)
        if value:
            return str(value)[:500]
    return str(instance.pk)
