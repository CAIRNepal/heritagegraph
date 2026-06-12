"""Curation gate for RDF publication — single source of truth (read + write paths)."""

from __future__ import annotations

from typing import Any

from apps.cidoc_data.canonical_status import (
    UNKNOWN_STATUS,
    CanonicalStatus,
    to_canonical_status,
)

# Explicit publish states (after moderator/reviewer approval).
# Kept as raw-value sets for query filters; semantics come from canonical_status.
PUBLISHED_STATUSES = frozenset({"accepted", "merged", "published"})

# Withheld from graph/public and public discovery.
WITHHELD_STATUSES = frozenset(
    {"pending_review", "draft", "rejected", "pending_revision", "superseded"}
)

# Canonical states withheld from the public surface. Unknown raw values are
# withheld too (default-deny): only the explicit publish states and the
# legacy-null curated corpus may reach browse and graph/public.
_WITHHELD_CANONICAL = frozenset(
    {
        CanonicalStatus.DRAFT,
        CanonicalStatus.PENDING_REVIEW,
        CanonicalStatus.REJECTED,
        CanonicalStatus.SUPERSEDED,
        UNKNOWN_STATUS,
    }
)

# Test/bootstrap assertions — kept in Postgres for dev but not merged into PUBLIC.
TEST_ASSERTION_CONTRIBUTORS = frozenset(
    {
        "test-seed",
        "kg-e2e-test",
        "bootstrap_identity_clusters",
        "kg_e2e_test",
    }
)


def is_published_for_rdf(instance: Any) -> bool:
    """True when a CIDOC MetaData row may appear in graph/public and discovery.

    Canonical ``None`` (legacy curated corpus — reviewed seed data with no
    workflow status) publishes; every withheld state and any unknown raw
    value does not.
    """
    canonical = to_canonical_status(getattr(instance, "status", None))
    return canonical not in _WITHHELD_CANONICAL


def is_curated_assertion(assertion: Any) -> bool:
    """True when an accepted assertion may project an edge into graph/public."""
    if getattr(assertion, "reconciliation_status", None) != "accepted":
        return False
    tag = (getattr(assertion, "contributed_by", None) or "").strip()
    return tag not in TEST_ASSERTION_CONTRIBUTORS


def unpublished_resource_iris() -> set[str]:
    """Resource IRIs excluded from scope=reviewed (explicitly withheld statuses only)."""
    from apps.cidoc_data.models import MetaData
    from apps.cidoc_data.rdf_publish import resource_uri_for_instance
    from django.apps import apps as django_apps

    out: set[str] = set()
    for model in django_apps.get_app_config("cidoc_data").get_models():
        if not issubclass(model, MetaData) or model is MetaData or model._meta.abstract:
            continue
        rows = model.objects.filter(status__in=WITHHELD_STATUSES).only("id")
        out.update(resource_uri_for_instance(o) for o in rows)
    return out
