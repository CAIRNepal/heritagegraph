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
import uuid
from typing import Any

import requests
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save

logger = logging.getLogger(__name__)

_CONNECTED = False

# Tracks entity_cluster FK before save — refresh RDF for old clusters on change.
HERITAGE_ASSERTION_PRIOR_ENTITY_CLUSTER_ID: dict[uuid.UUID, uuid.UUID | None] = {}


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


def _local_oxigraph_available() -> bool:
    try:
        import pyoxigraph  # noqa: F401
    except ImportError:
        return False
    return True


def _triple_to_pyoxigraph_quad(t: Any):
    """Build a pyoxigraph Quad from rdf_entity_projection._Triple."""
    try:
        from pyoxigraph import Literal, NamedNode, Quad
    except ImportError:
        return None

    from apps.cidoc_data.rdf_entity_projection import RDF_PREFIXES

    sub = NamedNode(t.subj)
    pred = NamedNode(t.pred)
    if t.obj_uri:
        return Quad(sub, pred, NamedNode(t.obj_uri), None)
    if not t.literal:
        return None
    lexical, datatype = t.literal
    geo_wkt = RDF_PREFIXES["geo"] + "wktLiteral"

    if not datatype:
        return Quad(sub, pred, Literal(lexical), None)
    if datatype == geo_wkt:
        return Quad(sub, pred, Literal(lexical, datatype=NamedNode(geo_wkt)), None)
    return Quad(sub, pred, Literal(lexical, datatype=NamedNode(datatype)), None)


def _local_replace_slot_projection(
    *, subject_uri: str, managed_predicate_iris: set[str], triples: list[Any]
) -> None:
    """Clear managed CIDOC-slot predicates for subject, then insert fresh triples."""
    if not _local_oxigraph_available():
        return
    try:
        from pyoxigraph import NamedNode, Store
    except ImportError:
        return

    store = Store(_oxigraph_store_path())
    sub = NamedNode(subject_uri)
    for pred_iri in sorted(managed_predicate_iris):
        pn = NamedNode(pred_iri)
        try:
            for q in store.quads_for_pattern(sub, pn, None, None):
                store.remove(q)
        except Exception:
            pass

    for triple in triples:
        quad = _triple_to_pyoxigraph_quad(triple)
        if quad is None:
            continue
        try:
            store.add(quad)
        except Exception as exc:
            logger.warning("Local Oxigraph add quad failed: %s", exc)


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
    obj_uri = _uri_for_generic(instance.object_content_type, instance.object_object_id)
    if not subj_uri or not obj_uri:
        return

    raw_prop = instance.asserted_property or ""
    prop_suffix = (
        raw_prop[len("relationship.") :] if "relationship." in raw_prop else raw_prop
    )
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
    """Upsert slot triples, labels, types, plus owl:sameAs when IRIs resolve."""
    if not rdf_sync_enabled() or instance is None:
        return

    from apps.cidoc_data.rdf_entity_projection import (
        sparql_delete_subject_predicates,
        sparql_insert_for_triples,
        tripleset_for_metadata_instance,
    )

    uri = _resource_uri(instance)

    triples, managed_preds = tripleset_for_metadata_instance(
        instance,
        resource_uri_fn=_resource_uri,
        label_fn=_label_for,
    )

    endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    if not endpoint:
        _local_replace_slot_projection(
            subject_uri=uri,
            managed_predicate_iris=managed_preds,
            triples=triples,
        )
        return

    delete_fragment = sparql_delete_subject_predicates(uri, managed_preds)
    insert_fragment = sparql_insert_for_triples(triples)
    _sparql_update(delete_fragment + insert_fragment)


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


def _is_identity_same_referent_assertion(assertion: Any) -> bool:
    from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY

    ap = assertion.asserted_property or ""
    return (
        ap == IDENTITY_SAME_REFERENT_PROPERTY
        and assertion.content_type_id
        and assertion.object_id is not None
    )


def _heritage_assertion_pre_save_prior_cluster(
    sender: type, instance: Any, **_kwargs: object
) -> None:
    if not rdf_sync_enabled():
        return
    if getattr(instance._state, "adding", False):
        return
    from apps.cidoc_data.models import HeritageAssertion

    try:
        prior = HeritageAssertion.objects.only("entity_cluster_id").get(pk=instance.pk)
    except HeritageAssertion.DoesNotExist:
        return
    HERITAGE_ASSERTION_PRIOR_ENTITY_CLUSTER_ID[instance.pk] = prior.entity_cluster_id


def _maybe_queue_entity_projection_from_ct(
    ct_id: int | None, object_id: int | None
) -> None:
    if ct_id is None or object_id is None:
        return
    try:
        from django.contrib.contenttypes.models import ContentType

        ct = ContentType.objects.get(pk=ct_id)
    except Exception:
        return
    model = ct.model_class()
    if model is None or not _is_cidoc_metadata_model(model):
        return
    try:
        obj = model.objects.get(pk=object_id)
    except model.DoesNotExist:
        return
    queue_entity_projection(obj)


def _refresh_rdf_for_identity_cluster_members(cluster_ids: set[uuid.UUID]) -> None:
    from apps.cidoc_data import identity_services
    from apps.cidoc_data.models import EntityCluster

    for cid in cluster_ids:
        try:
            cluster = EntityCluster.objects.get(pk=cid)
        except EntityCluster.DoesNotExist:
            continue
        for row in identity_services.active_memberships_for_cluster(cluster):
            oid = getattr(row, "object_id", None)
            ctid = getattr(row, "content_type_id", None)
            _maybe_queue_entity_projection_from_ct(ctid, oid)


def schedule_identity_linked_rdf_refresh(
    *, cluster_ids: set[uuid.UUID], subject_ct_id: int | None, subject_oid: int | None
) -> None:
    """Defer owl:sameAs + metadata projection until DB commit succeeds."""
    if not rdf_sync_enabled():
        return

    def _run() -> None:
        clean = {c for c in cluster_ids if c is not None}
        _refresh_rdf_for_identity_cluster_members(clean)
        if subject_ct_id is not None and subject_oid is not None:
            _maybe_queue_entity_projection_from_ct(subject_ct_id, subject_oid)

    transaction.on_commit(_run)


def _on_assertion_saved(sender, instance, **kwargs: object) -> None:
    queue_relationship_assertion_projection(instance)

    if not rdf_sync_enabled():
        return
    if _is_identity_same_referent_assertion(instance):
        prior = HERITAGE_ASSERTION_PRIOR_ENTITY_CLUSTER_ID.pop(instance.pk, None)
        affected: set[uuid.UUID] = set()
        if prior:
            affected.add(prior)
        if getattr(instance, "entity_cluster_id", None):
            affected.add(instance.entity_cluster_id)
        schedule_identity_linked_rdf_refresh(
            cluster_ids=affected,
            subject_ct_id=instance.content_type_id,
            subject_oid=int(instance.object_id)
            if instance.object_id is not None
            else None,
        )


def _on_identity_assertion_deleted(sender, instance, **kwargs: object) -> None:
    """Remove stale owl:sameAs from siblings/subject when membership row disappears."""
    if not rdf_sync_enabled():
        return
    if not _is_identity_same_referent_assertion(instance):
        return
    cluster_id = getattr(instance, "entity_cluster_id", None)
    affected = {cluster_id} if cluster_id else set()
    schedule_identity_linked_rdf_refresh(
        cluster_ids=affected,
        subject_ct_id=instance.content_type_id,
        subject_oid=int(instance.object_id)
        if instance.object_id is not None
        else None,
    )


def _on_entity_cluster_saved(sender, instance, **kwargs: object) -> None:
    """Re-project cluster members after curator edits external_identifiers."""
    if not rdf_sync_enabled():
        return
    update_fields = kwargs.get("update_fields")
    if (
        isinstance(update_fields, (list, tuple, set))
        and "external_identifiers" not in update_fields
    ):
        return
    schedule_identity_linked_rdf_refresh(
        cluster_ids={instance.pk},
        subject_ct_id=None,
        subject_oid=None,
    )


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

    from apps.cidoc_data.models import EntityCluster, HeritageAssertion

    pre_save.connect(
        _heritage_assertion_pre_save_prior_cluster,
        sender=HeritageAssertion,
        weak=False,
    )
    post_save.connect(_on_assertion_saved, sender=HeritageAssertion, weak=False)
    post_delete.connect(
        _on_identity_assertion_deleted, sender=HeritageAssertion, weak=False
    )
    post_save.connect(_on_entity_cluster_saved, sender=EntityCluster, weak=False)

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
