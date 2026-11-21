"""Queryset visibility for public CIDOC list/retrieve (knowledge tables, discovery)."""

from __future__ import annotations

from apps.cidoc_data.publication_policy import PUBLISHED_STATUSES
from django.db.models import Q, QuerySet


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in ("1", "true", "yes")


def published_metadata_q() -> Q:
    """Rows visible in the public heritage catalog (legacy null/empty = published)."""
    return (
        Q(status__in=PUBLISHED_STATUSES)
        | Q(status__isnull=True)
        | Q(status="")
    )


def apply_cidoc_list_visibility(queryset: QuerySet, request) -> QuerySet:
    """
    List API rules for MetaData-backed ViewSets:
    - Default: published catalog only (no pending/rejected leakage).
    - ?status=<workflow>: explicit filter; withheld rows only for owner or staff.
    - ?mine=1: authenticated contributor's rows (any status).
    - Staff + ?all=1: full table (curation).
    """
    user = getattr(request, "user", None)
    is_staff = bool(user and user.is_authenticated and user.is_staff)
    is_auth = bool(user and user.is_authenticated)
    username = getattr(user, "username", None) if is_auth else None

    if is_staff and _is_truthy(request.query_params.get("all")):
        status = (request.query_params.get("status") or "").strip()
        if status:
            return queryset.filter(status=status)
        return queryset

    if _is_truthy(request.query_params.get("mine")) and is_auth and username:
        return queryset.filter(contributor=username)

    status = (request.query_params.get("status") or "").strip()
    if status:
        qs = queryset.filter(status=status)
        # Any explicitly requested non-published status is private: owner or
        # staff only. Anonymous callers get nothing — previously a missing
        # username skipped the owner filter and leaked every pending row.
        if status not in PUBLISHED_STATUSES and not is_staff:
            if not username:
                return queryset.none()
            qs = qs.filter(contributor=username)
        return qs

    return queryset.filter(published_metadata_q())


def apply_cidoc_retrieve_visibility(queryset: QuerySet, request) -> QuerySet:
    """Retrieve: published rows, or own withheld rows, or staff."""
    user = getattr(request, "user", None)
    is_staff = bool(user and user.is_authenticated and user.is_staff)
    is_auth = bool(user and user.is_authenticated)
    username = getattr(user, "username", None) if is_auth else None

    if is_staff:
        return queryset

    if is_auth and username:
        return queryset.filter(published_metadata_q() | Q(contributor=username))

    return queryset.filter(published_metadata_q())
