"""
RDF / triplestore projection hooks (MR3).

When RDF_SYNC_ENABLED is set, CIDOC MetaData saves project registry-aligned
triples into the public named graph (see ``rdf_publish``). Optional SHACL gate
uses existing generated shapes — no ontology edits.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from apps.cidoc_data.rdf_publish import (
    delete_subject_from_store,
    label_for_instance,
    persist_slot_projection,
    resource_uri_for_instance,
)
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save

logger = logging.getLogger(__name__)

_CONNECTED = False

HERITAGE_ASSERTION_PRIOR_ENTITY_CLUSTER_ID: dict[uuid.UUID, uuid.UUID | None] = {}


def rdf_sync_enabled() -> bool:
    return bool(getattr(settings, "RDF_SYNC_ENABLED", False))


def _resource_uri(instance: Any) -> str:
    return resource_uri_for_instance(instance)


def _label_for(instance: Any) -> str:
    return label_for_instance(instance)


def queue_relationship_assertion_projection(
    instance: Any | None = None, **_kwargs: object
) -> None:
    """Project assertions to public + assertion + prov named graphs (on commit)."""
    if not rdf_sync_enabled() or instance is None:
        return
    from apps.cidoc_data.assertion_validation import is_relationship_property
    from apps.graph.kg_engine.engine import get_kg_engine

    prop = instance.asserted_property or ""
    if is_relationship_property(prop) or (
        instance.reconciliation_status == "accepted"
        and prop
        and (instance.asserted_value or "").strip()
    ):

        def _run() -> None:
            get_kg_engine().publish_assertion(instance)

        transaction.on_commit(_run)


def queue_entity_projection(instance: Any | None = None, **_kwargs: object) -> None:
    """Upsert slot triples when published; remove from PUBLIC when not."""
    if not rdf_sync_enabled() or instance is None:
        return

    from apps.cidoc_data.publication_policy import is_published_for_rdf

    if not is_published_for_rdf(instance):
        _delete_projection(instance)
        return

    from apps.cidoc_data.rdf_entity_projection import tripleset_for_metadata_instance

    uri = _resource_uri(instance)
    triples, managed_preds = tripleset_for_metadata_instance(
        instance,
        resource_uri_fn=_resource_uri,
        label_fn=_label_for,
    )
    persist_slot_projection(
        subject_uri=uri,
        triples=triples,
        managed_predicate_iris=managed_preds,
    )


def _delete_projection(instance: Any) -> None:
    if not rdf_sync_enabled() or instance is None:
        return
    delete_subject_from_store(uri=_resource_uri(instance))


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
    post_delete.connect(_on_assertion_deleted, sender=HeritageAssertion, weak=False)
    post_delete.connect(
        _on_identity_assertion_deleted, sender=HeritageAssertion, weak=False
    )
    post_save.connect(_on_entity_cluster_saved, sender=EntityCluster, weak=False)

    _CONNECTED = True


def _on_assertion_deleted(sender, instance, **kwargs: object) -> None:
    if not rdf_sync_enabled():
        return
    from apps.graph.kg_engine.engine import get_kg_engine

    get_kg_engine().unpublish_assertion(instance)


def project_all_accepted_assertions() -> int:
    """Reproject every accepted HeritageAssertion to assertion + prov graphs."""
    if not rdf_sync_enabled():
        return 0
    from apps.cidoc_data.models import HeritageAssertion
    from apps.graph.kg_engine.engine import get_kg_engine

    engine = get_kg_engine()
    n = 0
    from apps.cidoc_data.publication_policy import is_curated_assertion

    for assertion in HeritageAssertion.objects.filter(
        reconciliation_status="accepted"
    ).iterator():
        if not is_curated_assertion(assertion):
            engine.unpublish_assertion(assertion)
            continue
        if engine.publish_assertion(assertion):
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
