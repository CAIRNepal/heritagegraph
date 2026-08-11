"""Canonical URI policy for knowledge graph resources."""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.ontology_config import RDF_PREFIXES, expand_curie
from django.conf import settings

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


def project_resource_uri(project_id: Any) -> str:
    """PID for a Project: {resource_base}/project/{uuid}."""
    return f"{resource_base()}/project/{project_id}"


def project_graph_uri(project_id: Any) -> str:
    """Named graph IRI for a project's draft assertions."""
    return GraphPartition.PROJECT.uri(suffix=str(project_id)) or ""


def metadata_model_and_pk_for_resource_uri(uri: str | None):
    """Inverse of resource_uri_for_instance: curated IRI → (MetaData model, pk).

    Returns None when the IRI is foreign, malformed, or does not map to a
    concrete CIDOC MetaData model — callers must NOT treat that as a deleted
    row (assertion/cluster/entity IRIs share the curated namespace).
    """
    base = curated_resource_uri_prefix()
    if not uri or not str(uri).startswith(base):
        return None
    parts = str(uri)[len(base) :].strip("/").split("/")
    if len(parts) != 2 or not all(parts):
        return None
    segment, pk = parts

    from apps.cidoc_data.cidoc_registry_keys import model_for_registry_key
    from apps.cidoc_data.models import MetaData

    model = model_for_registry_key(segment)
    if model is None or not issubclass(model, MetaData) or model._meta.abstract:
        return None
    return model, pk


def metadata_instance_for_resource_uri(uri: str | None):
    """Live CIDOC MetaData instance for a curated IRI, or None."""
    resolved = metadata_model_and_pk_for_resource_uri(uri)
    if resolved is None:
        return None
    model, pk = resolved
    try:
        return model.objects.filter(pk=pk).first()
    except (ValueError, TypeError):
        return None


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
    suffix = (raw[len(prefix) :] if raw.startswith(prefix) else raw).strip()
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


# Characters that terminate or restructure an IRI inside a SPARQL query. Any of
# these reaching an f-string interpolation lets a caller break out of `<...>`
# and rewrite the query around it.
_IRI_FORBIDDEN = set('<>"{}|\\^`') | {chr(c) for c in range(0x21)} | {chr(0x7F)}

# Generous ceiling: real resource IRIs are far shorter, and an unbounded value
# is a cheap way to push expensive queries at the store.
_IRI_MAX_LEN = 512


def is_safe_iri(iri: str | None) -> bool:
    """True when `iri` can be interpolated into `<...>` without altering a query.

    SPARQL has no bound-parameter API here, so user-supplied IRIs reaching the
    LOD dereference and neighbourhood endpoints are validated instead of
    escaped. Both endpoints are AllowAny and call the store directly, bypassing
    the CARE filters that `CARESparqlProxyView` injects -- so an injected UNION
    there would read across named graphs, including access-tier-restricted rows.

    Deliberately a strict allowlist on structure: http(s) scheme, bounded
    length, and no character that can close an IRI or introduce a new clause.
    """
    if not iri or len(iri) > _IRI_MAX_LEN:
        return False
    if not (iri.startswith("http://") or iri.startswith("https://")):
        return False
    return not any(ch in _IRI_FORBIDDEN for ch in iri)
