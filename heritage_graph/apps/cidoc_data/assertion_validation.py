"""Validation for binary relationship assertions (spec 007)."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from .identity_constants import RELATIONSHIP_PROPERTY_PREFIX


def is_relationship_property(asserted_property: str | None) -> bool:
    p = asserted_property or ""
    return p.startswith(RELATIONSHIP_PROPERTY_PREFIX) and len(p) > len(
        RELATIONSHIP_PROPERTY_PREFIX
    )


def validate_relationship_assertion(instance) -> None:
    """Require structured subject/object/source for relationship.* rows."""
    has_object_side = bool(
        instance.object_content_type_id and instance.object_object_id
    )
    if is_relationship_property(instance.asserted_property):
        if not instance.content_type_id or not instance.object_id:
            raise ValidationError(
                {
                    "content_type": (
                        "Subject entity (content_type + object_id) required for "
                        "relationship assertions."
                    )
                }
            )
        if not has_object_side:
            raise ValidationError(
                {
                    "object_content_type": (
                        "Object entity (object_content_type + object_object_id) "
                        "required for relationship assertions."
                    )
                }
            )
        if instance.entity_cluster_id:
            raise ValidationError(
                {
                    "entity_cluster": (
                        "entity_cluster must be empty for relationship assertions."
                    )
                }
            )
        if not instance.source_id:
            raise ValidationError(
                {
                    "source": (
                        "Primary DataSource is required for relationship assertions."
                    ),
                }
            )
    elif has_object_side:
        raise ValidationError(
            {
                "object_content_type": (
                    "object_content_type/object_object_id only allowed when "
                    "asserted_property starts with relationship."
                )
            }
        )
