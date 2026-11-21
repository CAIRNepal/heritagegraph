"""Public selectors for the anonymous discovery feed.

Shared by the ``/cidoc/discovery/`` endpoint and the AI assistant's retrieval
corpus (``apps.assistant.services.retrieval``). These live outside ``views.py``
so the publication gate has exactly one owner: previously the assistant
imported three underscore-prefixed names out of the view module, which meant a
presentation-layer edit silently changed what the chatbot was allowed to say.

Everything here is strictly the published catalog. There is no owner or staff
widening, because callers include unauthenticated surfaces and the LLM.
"""

from __future__ import annotations

from apps.cidoc_data.list_visibility import published_metadata_q
from apps.cidoc_data.models import (
    Deity,
    Festival,
    Guthi,
    Monument,
    Person,
    RitualEvent,
)
from apps.cidoc_data.publication_policy import is_published_for_rdf
from apps.cidoc_data.serializers import _get_cultural_entity_id
from django.db.models import Q

# Public landing tabs → model + searchable fields (icontains).
DISCOVERY_TYPE_MAP = {
    "monuments": (Monument, ["name", "description", "note", "location_name"]),
    "festivals": (
        Festival,
        ["name", "description", "note", "location_name", "route_description"],
    ),
    "deities": (
        Deity,
        ["name", "description", "note", "alternate_names", "religious_tradition"],
    ),
    "persons": (
        Person,
        ["name", "description", "aliases", "occupation", "biography"],
    ),
    "guthis": (
        Guthi,
        ["name", "description", "note", "location", "managed_structures"],
    ),
    "rituals": (
        RitualEvent,
        [
            "name",
            "description",
            "note",
            "location_name",
            "performed_by",
            "route_description",
        ],
    ),
}


def discovery_record_name(instance):
    name = getattr(instance, "name", None)
    if name and str(name).strip():
        return str(name).strip()
    title = getattr(instance, "title", None)
    if title and str(title).strip():
        return str(title).strip()
    return str(instance.pk)


def discovery_summary(instance):
    for attr in ("description", "biography", "note", "route_description"):
        val = getattr(instance, attr, None)
        if val and str(val).strip():
            s = str(val).strip()
            return f"{s[:277]}…" if len(s) > 280 else s
    return ""


def discovery_location_hint(instance):
    for attr in ("location_name", "location", "start_place"):
        val = getattr(instance, attr, None)
        if val and str(val).strip():
            return str(val).strip()[:200]
    return ""


def discovery_is_published(instance):
    return is_published_for_rdf(instance)


def discovery_row(instance, resource_key):
    return {
        "id": str(instance.pk),
        "resource": resource_key,
        "type": instance.__class__.__name__,
        "name": discovery_record_name(instance),
        "summary": discovery_summary(instance),
        "location_hint": discovery_location_hint(instance),
        "cultural_entity_id": _get_cultural_entity_id(instance),
        "status": (getattr(instance, "status", None) or "").strip(),
        "is_published": discovery_is_published(instance),
        "has_media": False,
    }


def filtered_discovery_queryset(model, fields, q):
    """Published rows matching *q* across *fields*, newest first.

    Strictly the published catalog — this backs both the anonymous landing
    feed and the assistant's grounding corpus, so an ungated queryset here
    lets the chatbot quote and cite claims a curator has rejected.
    """
    qs = model.objects.filter(published_metadata_q()).order_by("-id")
    q = (q or "").strip()
    if not q:
        return qs
    q_filter = Q()
    for field in fields:
        q_filter |= Q(**{f"{field}__icontains": q})
    return qs.filter(q_filter).distinct()
