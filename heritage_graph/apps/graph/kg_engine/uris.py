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
