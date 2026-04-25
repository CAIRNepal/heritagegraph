"""Validation helpers for identity.same_referent membership assertions."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from .identity_constants import IDENTITY_SAME_REFERENT_PROPERTY


def validate_membership_assertion(instance) -> None:
    """Raise ValidationError when identity membership rows violate invariants."""
    if instance.asserted_property != IDENTITY_SAME_REFERENT_PROPERTY:
        if instance.entity_cluster_id:
            raise ValidationError(
                {
                    "entity_cluster": (
                        "Empty entity_cluster unless asserted_property is "
                        "identity.same_referent."
                    )
                }
            )
        return

    if instance.entity_cluster_id is None:
        raise ValidationError(
            {"entity_cluster": "Required for identity.same_referent assertions."}
        )
    if not instance.content_type_id or not instance.object_id:
        raise ValidationError(
            {
                "content_type": (
                    "Subject entity (content_type + object_id) required for membership."
                )
            }
        )

    cluster = instance.entity_cluster
    if instance.content_type.model != cluster.type_scope:
        raise ValidationError(
            {
                "entity_cluster": (
                    f"Cluster type_scope {cluster.type_scope!r} does not match "
                    f"subject model {instance.content_type.model!r}."
                )
            }
        )


def assertable_model_names() -> frozenset[str]:
    """ContentType.model strings for identity bootstrap (GenericRelation loop)."""
    return frozenset(
        {
            "architecturalstructure",
            "ritualevent",
            "festival",
            "iconographicobject",
            "monument",
            "deity",
            "guthi",
            "person",
            "location",
            "event",
            "historicalperiod",
            "tradition",
            "source",
            "kumaritenure",
            "kumariselection",
            "kumariretirement",
            "syncreticrelationship",
            "castegroup",
            "calendarsystem",
        }
    )
