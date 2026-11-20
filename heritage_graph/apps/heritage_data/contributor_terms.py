"""What a contributor agrees to, and the record that they did.

Contributions are published under CC BY 4.0, attributed to the contributor's
username, and kept with their full revision history. A contributor accepts that
once, before their first contribution; the version and time are stored on
their profile, and a new version of the terms asks again.

The wording here is a draft for the institution to approve (see
documentation/research/ETHICS_AND_CONSENT.md §3).
"""

from __future__ import annotations

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

# Bump when the terms change materially; everyone is asked again.
TERMS_VERSION = "2026-11-18"

TERMS = (
    "What you contribute is published openly under the Creative Commons "
    "Attribution 4.0 licence (CC BY 4.0), so anyone may reuse it with credit.",
    "Your contributions are attributed to your username, publicly and "
    "permanently, together with their revision history and review decisions.",
    "You confirm that you have the right to share what you submit, and that "
    "sharing it respects the wishes of the community it comes from.",
    "You can leave the public leaderboard at any time. If you stop "
    "contributing, you can ask for your username to be replaced by a pseudonym "
    "on everything you contributed.",
)


def required() -> bool:
    return bool(getattr(settings, "CONTRIBUTOR_TERMS_REQUIRED", True))


def _profile(user):
    from .models import UserProfile

    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def has_accepted(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    return _profile(user).contributor_terms_version == TERMS_VERSION


def accept(user) -> None:
    profile = _profile(user)
    profile.contributor_terms_version = TERMS_VERSION
    profile.contributor_terms_accepted_at = timezone.now()
    profile.save(
        update_fields=["contributor_terms_version", "contributor_terms_accepted_at"]
    )


def require_accepted(user) -> None:
    """Refuse a contribution from someone who has not accepted the current terms."""
    if required() and not has_accepted(user):
        raise PermissionDenied(
            {
                "detail": "Please accept the contributor terms before contributing.",
                "code": "contributor_terms_required",
                "terms_version": TERMS_VERSION,
            }
        )


def status_for(user) -> dict:
    profile = _profile(user)
    return {
        "terms_version": TERMS_VERSION,
        "terms": list(TERMS),
        "accepted": profile.contributor_terms_version == TERMS_VERSION,
        "accepted_version": profile.contributor_terms_version or None,
        "accepted_at": profile.contributor_terms_accepted_at,
        "show_on_leaderboard": profile.show_on_leaderboard,
    }
