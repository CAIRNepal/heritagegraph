"""Canonical contribution-status vocabulary (single source of truth).

Three model families historically used three different status vocabularies:

- CIDOC ``MetaData`` rows:     pending_review / accepted / merged / published …
- ``CulturalEntity`` wrappers: draft / pending_review / accepted / rejected /
  pending_revision …
- ``PublicContribution`` (QR): pending / approved / incorporated / rejected

This module defines ONE canonical enum and maps every legacy raw value onto
it. Database values are kept as-is; translation happens at the boundary
(serializers, publication policy, review guards) via :func:`to_canonical_status`.

This module must stay import-leaf (no app imports) so both ``cidoc_data`` and
``heritage_data`` can use it without circular imports.
"""

from __future__ import annotations

import logging

from django.db import models

logger = logging.getLogger(__name__)


class CanonicalStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING_REVIEW = "pending_review", "Pending Review"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"


# Raw (stored) value -> canonical value. ``None``/empty maps to None and means
# "legacy curated corpus": reviewed seed data that predates the workflow and
# is treated as published.
RAW_TO_CANONICAL: dict[str, str] = {
    "draft": CanonicalStatus.DRAFT,
    # Everything awaiting a reviewer decision is one canonical state.
    "pending": CanonicalStatus.PENDING_REVIEW,
    "pending_review": CanonicalStatus.PENDING_REVIEW,
    "pending_revision": CanonicalStatus.PENDING_REVIEW,
    # Every flavour of "a reviewer said yes" is one canonical state.
    "accepted": CanonicalStatus.ACCEPTED,
    "approved": CanonicalStatus.ACCEPTED,
    "incorporated": CanonicalStatus.ACCEPTED,
    "merged": CanonicalStatus.ACCEPTED,
    "published": CanonicalStatus.ACCEPTED,
    "rejected": CanonicalStatus.REJECTED,
    "superseded": CanonicalStatus.SUPERSEDED,
}


# Sentinel for raw values outside the known vocabulary. Unknown is NOT the
# same as legacy-null: a typo'd or future status must never silently publish.
UNKNOWN_STATUS = "unknown"


def to_canonical_status(raw: object) -> str | None:
    """Map any stored status value to the canonical vocabulary.

    Returns ``None`` only for null/blank (the legacy curated corpus, which is
    reviewed seed data and publishes). Unrecognised values return
    :data:`UNKNOWN_STATUS`, which the publication gate withholds (default-deny)
    and which logs a warning so the bad value gets noticed and fixed.
    """
    if raw is None:
        return None
    text = str(raw).strip().lower()
    if not text:
        return None
    canonical = RAW_TO_CANONICAL.get(text)
    if canonical is None:
        logger.warning(
            "Unknown contribution status %r; withholding from publication", raw
        )
        return UNKNOWN_STATUS
    return canonical


# Reviewer/contributor workflow as an explicit state machine. ``None`` (legacy
# curated) rows enter the workflow the first time someone edits them.
ALLOWED_TRANSITIONS: dict[str | None, frozenset[str]] = {
    None: frozenset({CanonicalStatus.PENDING_REVIEW}),
    # A curator may moderate a draft directly without a resubmission round-trip.
    CanonicalStatus.DRAFT: frozenset(
        {
            CanonicalStatus.PENDING_REVIEW,
            CanonicalStatus.ACCEPTED,
            CanonicalStatus.REJECTED,
        }
    ),
    CanonicalStatus.PENDING_REVIEW: frozenset(
        {CanonicalStatus.ACCEPTED, CanonicalStatus.REJECTED}
    ),
    CanonicalStatus.ACCEPTED: frozenset(
        # Re-review of an edit, replacement by a merged duplicate, or an
        # explicit curator withdrawal of published content.
        {
            CanonicalStatus.PENDING_REVIEW,
            CanonicalStatus.SUPERSEDED,
            CanonicalStatus.REJECTED,
        }
    ),
    # Resubmission, or a curator reversing an erroneous rejection.
    CanonicalStatus.REJECTED: frozenset(
        {CanonicalStatus.PENDING_REVIEW, CanonicalStatus.ACCEPTED}
    ),
    CanonicalStatus.SUPERSEDED: frozenset(),
    # Recovery path: a curator may moderate a row whose stored status is
    # outside the vocabulary (it is withheld until they do).
    UNKNOWN_STATUS: frozenset(
        {
            CanonicalStatus.PENDING_REVIEW,
            CanonicalStatus.ACCEPTED,
            CanonicalStatus.REJECTED,
        }
    ),
}


def can_transition(raw_old: object, raw_new: object) -> bool:
    """True when moving between the two (raw) statuses is a legal workflow step."""
    old = to_canonical_status(raw_old)
    new = to_canonical_status(raw_new)
    if new is None:
        return False
    if old == new:
        return True
    return new in ALLOWED_TRANSITIONS.get(old, frozenset())
