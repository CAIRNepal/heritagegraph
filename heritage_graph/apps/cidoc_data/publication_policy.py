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


def has_publishable_label(instance: Any) -> bool:
    """True when a row carries a name that can identify it to a reader.

    ``label_for_instance`` falls back to the primary key when ``name`` and
    ``title`` are both empty, so a contentless row still projects an
    ``rdfs:label`` — publishing as a bare digit or a stray keystroke ("S",
    "L"). Public consumers cannot tell those apart from real heritage: they
    render as nodes in the graph, cards in the Museum, and pins on the Atlas.
    Require a real name instead of trusting the fallback.

    Abstains (returns True) for objects that expose no label field at all —
    there is nothing to judge, and status remains the only gate.
    """
    attrs = [attr for attr in ("name", "title") if hasattr(instance, attr)]
    if not attrs:
        return True
    return any(
        (value := getattr(instance, attr, None)) and len(str(value).strip()) >= 2
        for attr in attrs
    )


def is_published_for_rdf(instance: Any) -> bool:
    """True when a CIDOC MetaData row may appear in graph/public and discovery.

    Canonical ``None`` (legacy curated corpus — reviewed seed data with no
    workflow status) publishes; every withheld state and any unknown raw
    value does not. An approved status is necessary but not sufficient — a row
    with no identifying label is withheld regardless of who approved it.
    """
    canonical = to_canonical_status(getattr(instance, "status", None))
    if canonical in _WITHHELD_CANONICAL:
        return False
    return has_publishable_label(instance)


def is_curated_assertion(assertion: Any) -> bool:
    """True when an accepted assertion may project an edge into graph/public."""
    if getattr(assertion, "reconciliation_status", None) != "accepted":
        return False
    tag = (getattr(assertion, "contributed_by", None) or "").strip()
    return tag not in TEST_ASSERTION_CONTRIBUTORS


def unpublished_resource_iris() -> set[str]:
    """Resource IRIs excluded from scope=reviewed.

    Mirrors :func:`is_published_for_rdf` so the read path and the projection
    agree: explicitly withheld statuses, plus any row without an identifying
    label (which must never surface even when its status says approved).
    """
    from apps.cidoc_data.models import MetaData
    from apps.cidoc_data.rdf_publish import resource_uri_for_instance
    from django.apps import apps as django_apps

    out: set[str] = set()
    for model in django_apps.get_app_config("cidoc_data").get_models():
        if not issubclass(model, MetaData) or model is MetaData or model._meta.abstract:
            continue
        rows = model.objects.filter(status__in=WITHHELD_STATUSES).only("id")
        out.update(resource_uri_for_instance(o) for o in rows)

        field_names = {f.name for f in model._meta.get_fields()}
        label_fields = [f for f in ("name", "title") if f in field_names]
        if not label_fields:
            continue
        for row in model.objects.exclude(status__in=WITHHELD_STATUSES).only(
            "id", *label_fields
        ):
            if not has_publishable_label(row):
                out.add(resource_uri_for_instance(row))
    return out
