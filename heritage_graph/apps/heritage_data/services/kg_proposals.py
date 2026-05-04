"""Materialization and audit helpers for entity / relationship proposals (007)."""

from __future__ import annotations

import uuid
from typing import Any

from apps.cidoc_data.identity_constants import (
    IDENTITY_SAME_REFERENT_PROPERTY,
    RELATIONSHIP_PROPERTY_PREFIX,
)
from apps.cidoc_data.identity_validation import assertable_model_names
from apps.cidoc_data.models import (
    DataSource,
    EntityCluster,
    HeritageAssertion,
)
from apps.heritage_data.models import (
    EntityProposal,
    EntityProposalAuditEvent,
    RelationshipProposal,
    RelationshipProposalAuditEvent,
)
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError


def append_entity_audit(
    proposal: EntityProposal,
    *,
    actor,
    action: str,
    from_status: str,
    to_status: str,
    comment: str = "",
) -> None:
    EntityProposalAuditEvent.objects.create(
        proposal=proposal,
        actor=actor,
        action=action,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
    )


def append_relationship_audit(
    proposal: RelationshipProposal,
    *,
    actor,
    action: str,
    from_status: str,
    to_status: str,
    comment: str = "",
) -> None:
    RelationshipProposalAuditEvent.objects.create(
        proposal=proposal,
        actor=actor,
        action=action,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
    )


def _actor_label(actor) -> str:
    if hasattr(actor, "email") and actor.email:
        return str(actor.email)
    if hasattr(actor, "username"):
        return str(actor.username)
    return ""


def _primary_source_from_json(ids: list[Any]) -> DataSource | None:
    for raw in ids or []:
        try:
            pk = uuid.UUID(str(raw))
        except (ValueError, TypeError):
            continue
        ds = DataSource.objects.filter(pk=pk).first()
        if ds:
            return ds
    return None


def validate_entity_proposal_ready(proposal: EntityProposal) -> None:
    errors: dict[str, Any] = {}
    if not (proposal.anchor_records or []):
        errors["anchor_records"] = "At least one CIDOC anchor record is required."
    if not proposal.canonical_label.strip():
        errors["canonical_label"] = "Required."
    ts = (proposal.type_scope or "").strip().lower()
    if ts not in assertable_model_names():
        errors["type_scope"] = f"Unsupported type_scope {proposal.type_scope!r}."
    if proposal.resolution_mode == EntityProposal.RESOLUTION_LINK:
        if proposal.existing_cluster_id is None:
            errors["existing_cluster"] = "Required when linking to an existing cluster."
        elif proposal.existing_cluster.merged_into_id:
            errors["existing_cluster"] = (
                "Chosen cluster is merged; pick the surviving cluster."
            )
        elif proposal.existing_cluster.type_scope != ts:
            errors["existing_cluster"] = (
                "Existing cluster type_scope does not match proposal."
            )
    if not (proposal.supporting_source_ids or []):
        errors["supporting_source_ids"] = (
            "At least one DataSource UUID is required as supporting evidence."
        )
    elif _primary_source_from_json(proposal.supporting_source_ids) is None:
        errors["supporting_source_ids"] = "No valid DataSource UUID found in list."

    for i, row in enumerate(proposal.anchor_records or []):
        if not isinstance(row, dict):
            errors[f"anchor_records[{i}]"] = "Each anchor must be an object."
            continue
        et = str(row.get("entity_type") or "").strip().lower()
        eid = row.get("entity_id")
        if et not in assertable_model_names():
            errors[f"anchor_records[{i}].entity_type"] = (
                "Unknown or unsupported entity_type."
            )
            continue
        if et != ts:
            errors[f"anchor_records[{i}]"] = (
                "Anchor entity_type must match proposal type_scope."
            )
            continue
        try:
            oid = int(eid)
        except (TypeError, ValueError):
            errors[f"anchor_records[{i}].entity_id"] = "Must be an integer PK."
            continue
        ct = ContentType.objects.filter(model=et).first()
        if not ct or not ct.model_class():
            errors[f"anchor_records[{i}]"] = "Unknown content type."
            continue
        if not ct.model_class().objects.filter(pk=oid).exists():
            errors[f"anchor_records[{i}]"] = f"No {et} with id={oid}."

    if errors:
        raise DRFValidationError(errors)


def validate_relationship_proposal_ready(proposal: RelationshipProposal) -> None:
    errors: dict[str, Any] = {}
    st = proposal.subject_entity_type.strip().lower()
    ot = proposal.object_entity_type.strip().lower()
    for label, val in (("subject_entity_type", st), ("object_entity_type", ot)):
        if val not in assertable_model_names():
            errors[label] = f"Unsupported entity type {val!r}."
    if st == ot and proposal.subject_entity_id == proposal.object_entity_id:
        errors["object_entity_id"] = "Subject and object cannot be the same row."

    for side, et, eid in (
        ("subject", st, proposal.subject_entity_id),
        ("object", ot, proposal.object_entity_id),
    ):
        ct = ContentType.objects.filter(model=et).first()
        if not ct or not ct.model_class():
            errors[f"{side}_entity_type"] = "Unknown content type."
            continue
        if not ct.model_class().objects.filter(pk=eid).exists():
            errors[f"{side}_entity_id"] = f"No {et} with id={eid}."

    if not proposal.predicate.active:
        errors["predicate"] = "Predicate is inactive."

    for i, raw in enumerate(proposal.supporting_source_ids or []):
        try:
            pk = uuid.UUID(str(raw))
        except (ValueError, TypeError):
            errors[f"supporting_source_ids[{i}]"] = "Invalid UUID."
            continue
        if not DataSource.objects.filter(pk=pk).exists():
            errors[f"supporting_source_ids[{i}]"] = "DataSource not found."

    if errors:
        raise DRFValidationError(errors)


@transaction.atomic
def materialize_entity_proposal(proposal: EntityProposal, actor) -> EntityCluster:
    validate_entity_proposal_ready(proposal)
    primary = _primary_source_from_json(proposal.supporting_source_ids)
    if primary is None:
        raise DRFValidationError(
            {"supporting_source_ids": "Could not resolve a primary DataSource."}
        )

    ts = proposal.type_scope.strip().lower()
    if proposal.resolution_mode == EntityProposal.RESOLUTION_NEW:
        cluster = EntityCluster.objects.create(
            canonical_label=proposal.canonical_label.strip(),
            type_scope=ts,
            curated_aliases=list(proposal.aliases or []),
            external_identifiers=dict(proposal.external_identifiers or {}),
            note="",
        )
    else:
        cluster = proposal.existing_cluster
        ca = list(cluster.curated_aliases or [])
        for a in proposal.aliases or []:
            if a not in ca:
                ca.append(a)
        cluster.curated_aliases = ca
        ei = dict(cluster.external_identifiers or {})
        ei.update(dict(proposal.external_identifiers or {}))
        cluster.external_identifiers = ei
        cluster.save(
            update_fields=["curated_aliases", "external_identifiers", "updated_at"]
        )

    actor_label = _actor_label(actor)
    for row in proposal.anchor_records or []:
        et = str(row["entity_type"]).strip().lower()
        oid = int(row["entity_id"])
        ct = ContentType.objects.get(model=et)
        assertion = HeritageAssertion(
            content_type=ct,
            object_id=oid,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            asserted_value="",
            assertion_content=proposal.contributor_note or "",
            entity_cluster=cluster,
            source_id=primary.id,
            contributed_by=actor_label,
            confidence="likely",
            reconciliation_status="accepted",
            data_quality_note="",
        )
        assertion.full_clean()
        assertion.save()

    proposal.materialized_cluster = cluster
    proposal.status = EntityProposal.STATUS_APPROVED
    proposal.resolved_at = timezone.now()
    proposal.save(
        update_fields=[
            "materialized_cluster",
            "status",
            "resolved_at",
            "updated_at",
        ]
    )
    return cluster


@transaction.atomic
def materialize_relationship_proposal(
    proposal: RelationshipProposal, actor
) -> HeritageAssertion:
    validate_relationship_proposal_ready(proposal)
    pred_code = proposal.predicate.code
    asserted_property = f"{RELATIONSHIP_PROPERTY_PREFIX}{pred_code}"

    s_ct = ContentType.objects.get(model=proposal.subject_entity_type.strip().lower())
    o_ct = ContentType.objects.get(model=proposal.object_entity_type.strip().lower())

    assertion = HeritageAssertion(
        content_type=s_ct,
        object_id=proposal.subject_entity_id,
        object_content_type=o_ct,
        object_object_id=proposal.object_entity_id,
        asserted_property=asserted_property,
        asserted_value="",
        assertion_content=proposal.interpretation_note or "",
        temporal_scope_edtf=proposal.temporal_scope_edtf or "",
        source_id=proposal.primary_source_id,
        contributed_by=_actor_label(actor),
        confidence=proposal.confidence or "likely",
        reconciliation_status="accepted",
        data_quality_note="",
        entity_cluster=None,
    )
    assertion.full_clean()
    assertion.save()

    extra_ids: list[uuid.UUID] = []
    for raw in proposal.supporting_source_ids or []:
        try:
            extra_ids.append(uuid.UUID(str(raw)))
        except (ValueError, TypeError):
            continue
    if extra_ids:
        assertion.supporting_sources.set(DataSource.objects.filter(pk__in=extra_ids))

    proposal.materialized_assertion = assertion
    proposal.status = RelationshipProposal.STATUS_APPROVED
    proposal.resolved_at = timezone.now()
    proposal.save(
        update_fields=[
            "materialized_assertion",
            "status",
            "resolved_at",
            "updated_at",
        ]
    )
    return assertion
