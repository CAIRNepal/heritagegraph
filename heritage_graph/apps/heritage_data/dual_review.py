"""Two independent reviewers for culturally sensitive records.

One curator could publish anything. For records about caste, guthi membership
and the Kumari, and for anything a contributor or curator has marked with a
CARE tier or label, acceptance now needs two different reviewers, neither of
them the contributor. The first accept is recorded and the record stays in
review; the second publishes it.
"""

from __future__ import annotations

# Record types whose content is sensitive by nature (Django model names).
SENSITIVE_RECORD_TYPES = frozenset(
    {"CasteGroup", "Guthi", "KumariSelection", "KumariTenure", "KumariRetirement"}
)

# Links that make a claim about a person's caste or guthi membership.
SENSITIVE_LINK_SLOTS = frozenset(
    {"belongs_to_caste", "has_membership", "member_of_group", "member_of"}
)

REQUIRED_APPROVALS = 2
ACCEPT_VERDICTS = ("accept", "accept_with_edits")


class AwaitingSecondReview(Exception):
    """The record is sensitive and has fewer than two independent approvals."""

    def __init__(self, approvals: list[str]):
        self.approvals = approvals
        super().__init__(
            f"Approval recorded ({len(approvals)} of {REQUIRED_APPROVALS}). This "
            "record is culturally sensitive: a second reviewer must also accept "
            "it before it is published."
        )


def reasons(cidoc, data: dict | None) -> list[str]:
    """Why a record needs two reviewers; empty when it does not."""
    out = []
    if cidoc is not None and type(cidoc).__name__ in SENSITIVE_RECORD_TYPES:
        out.append(f"{type(cidoc)._meta.verbose_name} records")
    tier = getattr(cidoc, "access_tier", "public") if cidoc is not None else "public"
    if tier and tier != "public":
        out.append(f"access tier “{tier}”")
    if cidoc is not None and getattr(cidoc, "care_labels", None):
        out.append("CARE labels")
    slots = {link.get("slot") for link in (data or {}).get("_links") or []}
    if slots & SENSITIVE_LINK_SLOTS:
        out.append("caste or guthi membership links")
    return out


def approvals(entity, revision) -> list[str]:
    """Distinct reviewers (not the contributor) who accepted this revision."""
    from .models import ReviewDecision

    if revision is None:
        return []
    rows = (
        ReviewDecision.objects.filter(
            entity=entity, revision_reviewed=revision, verdict__in=ACCEPT_VERDICTS
        )
        .exclude(reviewer_id=entity.contributor_id)
        .values_list("reviewer__username", flat=True)
    )
    return sorted(set(rows))


def require_independent_approvals(entity, cidoc, data, revision, editor) -> None:
    """Raise AwaitingSecondReview unless a sensitive record has two approvals."""
    if not reasons(cidoc, data):
        return
    names = set(approvals(entity, revision))
    if editor is not None and editor.pk != entity.contributor_id:
        names.add(editor.username)
    if len(names) < REQUIRED_APPROVALS:
        raise AwaitingSecondReview(sorted(names))


def status_for(entity) -> dict:
    """For the review page: are two reviewers needed, and who has approved."""
    from apps.heritage_data.models import _resolve_linked_cidoc_instance

    revision = entity.current_revision or entity.get_latest_revision()
    data = (
        revision.data
        if revision is not None and isinstance(revision.data, dict)
        else {}
    )
    why = reasons(_resolve_linked_cidoc_instance(entity), data)
    return {
        "required": bool(why),
        "reasons": why,
        "needed": REQUIRED_APPROVALS if why else 1,
        "approvals": approvals(entity, revision) if why else [],
    }
