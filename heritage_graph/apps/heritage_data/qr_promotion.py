"""Promotion of QR/public contributions into the structured review pipeline.

Path C (anonymous ``PublicContribution``) historically dead-ended: a curator
marked a note "incorporated" and re-entered the content by hand. Promotion
creates the same artifacts a structured form submission creates — a CIDOC
row (``pending_review``), a ``CulturalEntity`` wrapper, and Revision #1 —
so the QR note rides the normal accept→publish gate, with provenance back
to the original scan preserved in the revision data and on the contribution.
"""

from __future__ import annotations

import logging

from django.apps import apps as django_apps
from django.contrib.contenttypes.models import ContentType
from django.db import transaction

logger = logging.getLogger(__name__)


class PromotionError(ValueError):
    """Raised when a public contribution cannot be promoted."""


def _resolve_cidoc_model(target_type: str):
    from apps.cidoc_data.models import MetaData

    name = (target_type or "").strip()
    if not name:
        raise PromotionError("target_type is required to promote a contribution.")
    try:
        model = django_apps.get_model("cidoc_data", name)
    except LookupError:
        raise PromotionError(f"Unknown CIDOC type {name!r}.") from None
    if not issubclass(model, MetaData) or model._meta.abstract:
        raise PromotionError(f"{name!r} is not a promotable CIDOC type.")
    return model


def promote_public_contribution(contribution, *, target_type: str, reviewer):
    """Create CIDOC row + CulturalEntity wrapper + Revision #1 from a QR note.

    Returns the created CulturalEntity. Raises PromotionError when the target
    type is invalid or the CIDOC row cannot be constructed.
    """
    from apps.cidoc_data.views import _get_category_for_model
    from apps.heritage_data.models import Activity, CulturalEntity, Revision

    model = _resolve_cidoc_model(target_type)
    entity_name = (
        contribution.entity_name or f"QR contribution {contribution.id}"
    ).strip()

    field_names = {f.name for f in model._meta.concrete_fields}
    cidoc_kwargs = {
        "description": contribution.content,
        "contributor": f"qr:{contribution.contributor_name or 'Anonymous'}",
        "status": "pending_review",
    }
    if "name" in field_names:
        cidoc_kwargs["name"] = entity_name
    elif "title" in field_names:
        cidoc_kwargs["title"] = entity_name
    if "source_description" in field_names and contribution.source_description:
        cidoc_kwargs["source_description"] = contribution.source_description

    with transaction.atomic():
        try:
            cidoc_row = model.objects.create(**cidoc_kwargs)
        except Exception as exc:
            raise PromotionError(
                f"Could not create {model.__name__} from contribution: {exc}"
            ) from exc

        entity = CulturalEntity.objects.create(
            name=entity_name,
            description=contribution.content,
            category=_get_category_for_model(model),
            status="pending_review",
            contributor=reviewer,
            cidoc_content_type=ContentType.objects.get_for_model(model),
            cidoc_object_id=cidoc_row.pk,
        )

        # Revision #1 carries full provenance back to the field observation:
        # who said it, where, via what channel — prov:wasDerivedFrom in spirit.
        revision = Revision.objects.create(
            entity=entity,
            revision_number=1,
            created_by=reviewer,
            data={
                "name": entity_name,
                "description": contribution.content,
                "_cidoc_model": model.__name__,
                "_cidoc_id": cidoc_row.pk,
                "_public_contribution_id": str(contribution.id),
                "_source": contribution.submitted_via,
                "_contributor_name": contribution.contributor_name or "Anonymous",
                "_source_description": contribution.source_description,
                "_latitude": str(contribution.latitude)
                if contribution.latitude is not None
                else None,
                "_longitude": str(contribution.longitude)
                if contribution.longitude is not None
                else None,
                "_contributed_at": contribution.created_at.isoformat(),
            },
        )
        entity.current_revision = revision
        entity.save(update_fields=["current_revision"])

        Activity.objects.create(
            entity=entity,
            user=reviewer,
            activity_type="submitted",
            comment=(
                f'Promoted QR contribution {contribution.id} '
                f'("{entity_name}") into the review pipeline as {model.__name__}'
            ),
        )

        contribution.promoted_entity = entity
        if contribution.entity is None:
            contribution.entity = entity
        contribution.save(update_fields=["promoted_entity", "entity", "updated_at"])

    return entity
