"""Validation helpers and label-matching heuristics for identity resolution."""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

from .identity_constants import IDENTITY_SAME_REFERENT_PROPERTY

# Minimum normalized length for unattended substring / auto-merge decisions.
MIN_DISTINCTIVE_LEN = 8


def normalize_label(label: str | None) -> str:
    """Fold case and strip non-alphanumeric for blocking comparisons."""
    return re.sub(r"[^a-z0-9]+", "", (label or "").casefold())


def _substring_variant(na: str, nb: str) -> bool:
    if len(na) < MIN_DISTINCTIVE_LEN and len(nb) < MIN_DISTINCTIVE_LEN:
        return False
    shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
    return len(shorter) >= MIN_DISTINCTIVE_LEN and shorter in longer


def labels_are_similar(a: str | None, b: str | None) -> bool:
    """Medium-confidence signal for reviewer queues."""
    na, nb = normalize_label(a), normalize_label(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    return _substring_variant(na, nb)


def labels_are_auto_mergeable(a: str | None, b: str | None) -> bool:
    """High-confidence signal for unattended cluster merges."""
    na, nb = normalize_label(a), normalize_label(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    return _substring_variant(na, nb)


def label_match_tier(submitted: str | None, candidate: str | None) -> str | None:
    """Return 'exact', 'similar', or None for a label pair."""
    if not submitted or not candidate:
        return None
    if normalize_label(submitted) == normalize_label(candidate):
        return "exact"
    if labels_are_similar(submitted, candidate):
        return "similar"
    return None


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
