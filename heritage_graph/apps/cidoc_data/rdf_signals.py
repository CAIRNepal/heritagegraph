"""
RDF / triplestore projection hooks (MR3).

When RDF_SYNC_ENABLED and RDF_ENDPOINT_URL are set, POST SPARQL UPDATE
to the configured store on save/delete of CIDOC MetaData models.

When RDF_SYNC_ENABLED is enabled but RDF_ENDPOINT_URL is empty, we fall back to a
local on-disk Oxigraph store at `oxigraph_db/` using `pyoxigraph`.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import requests
from django.apps import apps
from django.conf import settings
from django.db.models.signals import post_delete, post_save

logger = logging.getLogger(__name__)

_CONNECTED = False


def rdf_sync_enabled() -> bool:
    return bool(getattr(settings, "RDF_SYNC_ENABLED", False))


def _oxigraph_store_path() -> str:
    return str(getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db") or "oxigraph_db")


def _resource_uri(instance: Any) -> str:
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    name = instance.__class__.__name__.lower()
    return f"{base}/{name}/{instance.pk}"


def _label_for(instance: Any) -> str:
    for attr in ("name", "title"):
        v = getattr(instance, attr, None)
        if v:
            return str(v)[:500]
    return str(instance.pk)


def _escape_literal(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def _local_oxigraph_available() -> bool:
    try:
        import pyoxigraph  # noqa: F401
    except ImportError:
        return False
    return True


def _local_upsert_label(*, uri: str, label: str) -> None:
    try:
        from pyoxigraph import Literal, NamedNode, Quad, Store
    except ImportError:
        return
    store = Store(_oxigraph_store_path())
    subj = NamedNode(uri)
    pred = NamedNode("http://www.w3.org/2000/01/rdf-schema#label")

    # Remove previous labels to avoid duplicates.
    try:
        for q in store.quads_for_pattern(subj, pred, None, None):
            store.remove(q)
    except Exception:
        # Best-effort cleanup; continue with insert.
        pass

    store.add(Quad(subj, pred, Literal(label), None))


def _local_delete_subject(*, uri: str) -> None:
    try:
        from pyoxigraph import NamedNode, Store
    except ImportError:
        return
    store = Store(_oxigraph_store_path())
    subj = NamedNode(uri)
    try:
        for q in store.quads_for_pattern(subj, None, None, None):
            store.remove(q)
    except Exception as exc:
        logger.warning("Local Oxigraph delete failed: %s", exc)


def _sparql_update(update: str) -> None:
    endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    if not rdf_sync_enabled() or not endpoint:
        return
    try:
        r = requests.post(
            endpoint,
            data=update.encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
            timeout=45,
        )
        r.raise_for_status()
    except Exception as exc:
        logger.warning("RDF SPARQL update failed: %s", exc)


def _uri_for_generic(content_type, object_id) -> str | None:
    if content_type is None or object_id is None:
        return None
    model = content_type.model_class()
    if model is None:
        return None
    try:
        obj = model.objects.get(pk=object_id)
    except model.DoesNotExist:
        return None
    return _resource_uri(obj)


def queue_relationship_assertion_projection(
    instance: Any | None = None, **_kwargs: object
) -> None:
    """Emit one triple for accepted relationship.* assertions (007)."""
    if not rdf_sync_enabled() or instance is None:
        return
    from apps.cidoc_data.assertion_validation import is_relationship_property

    if instance.reconciliation_status != "accepted":
        return
    if not is_relationship_property(instance.asserted_property):
        return

    subj_uri = _uri_for_generic(instance.content_type, instance.object_id)
    obj_uri = _uri_for_generic(
        instance.object_content_type, instance.object_object_id
    )
    if not subj_uri or not obj_uri:
        return

    raw_prop = instance.asserted_property or ""
    prop_suffix = raw_prop[len("relationship.") :] if "relationship." in raw_prop else raw_prop
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    pred_uri = f"{base}/property/{prop_suffix}"

    endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    if not endpoint:
        if not _local_oxigraph_available():
            return
        try:
            from pyoxigraph import NamedNode, Quad, Store
        except ImportError:
            return
        store = Store(_oxigraph_store_path())
        s_n = NamedNode(subj_uri)
        p_n = NamedNode(pred_uri)
        o_n = NamedNode(obj_uri)
        try:
            for q in store.quads_for_pattern(s_n, p_n, o_n, None):
                store.remove(q)
        except Exception:
            pass
        store.add(Quad(s_n, p_n, o_n, None))
        return

    update = f"INSERT DATA {{ <{subj_uri}> <{pred_uri}> <{obj_uri}> . }}\n"
    _sparql_update(update)


def queue_entity_projection(instance: Any | None = None, **_kwargs: object) -> None:
    """Upsert minimal triples for one CIDOC record (stub → rdfs:label)."""
    if not rdf_sync_enabled() or instance is None:
        return
    uri = _resource_uri(instance)
    label = _label_for(instance)

    endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    if not endpoint:
        if not _local_oxigraph_available():
            return
        _local_upsert_label(uri=uri, label=label)
        return

    escaped = _escape_literal(label)
    update = (
        "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
        f"INSERT DATA {{ <{uri}> rdfs:label \"{escaped}\" . }}\n"
    )
    _sparql_update(update)


def _delete_projection(instance: Any) -> None:
    if not rdf_sync_enabled() or instance is None:
        return
    uri = _resource_uri(instance)

    endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    if not endpoint:
        if not _local_oxigraph_available():
            return
        _local_delete_subject(uri=uri)
        return

    update = f"DELETE WHERE {{ <{uri}> ?p ?o . }}\n"
    _sparql_update(update)


def _is_cidoc_metadata_model(model: type) -> bool:
    from apps.cidoc_data.models import MetaData

    return (
        issubclass(model, MetaData)
        and model is not MetaData
        and not model._meta.abstract
    )


def _on_instance_saved(sender, instance, **kwargs: object) -> None:
    queue_entity_projection(instance)


def _on_instance_deleted(sender, instance, **kwargs: object) -> None:
    _delete_projection(instance)


def _on_assertion_saved(sender, instance, **kwargs: object) -> None:
    queue_relationship_assertion_projection(instance)


def connect_signals() -> None:
    """Register RDF hooks once (idempotent). Handlers no-op unless RDF_SYNC_ENABLED."""
    global _CONNECTED
    if _CONNECTED:
        return
    cfg = apps.get_app_config("cidoc_data")
    seen: set[type] = set()
    for model in cfg.get_models():
        if not _is_cidoc_metadata_model(model) or model in seen:
            continue
        seen.add(model)
        post_save.connect(_on_instance_saved, sender=model, weak=False)
        post_delete.connect(_on_instance_deleted, sender=model, weak=False)

    from apps.cidoc_data.models import HeritageAssertion

    post_save.connect(_on_assertion_saved, sender=HeritageAssertion, weak=False)

    _CONNECTED = True


def project_all_metadata_instances() -> int:
    """Full rebuild: emit INSERT DATA for every MetaData subclass row."""
    if not rdf_sync_enabled():
        return 0
    n = 0
    cfg = apps.get_app_config("cidoc_data")
    for model in cfg.get_models():
        if not _is_cidoc_metadata_model(model):
            continue
        for obj in model.objects.all().iterator():
            queue_entity_projection(obj)
            n += 1
    return n


def is_readonly_sparql_query(q: str) -> bool:
    """Reject obvious write operations for the public SPARQL proxy."""
    s = " ".join((q or "").lower().split())
    if not s:
        return False
    if re.search(r"\b(insert|delete|drop|load|clear|copy|move|add|create)\b", s):
        return False
    return bool(re.search(r"\b(select|ask|construct|describe)\b", s))
