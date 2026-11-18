"""Registry slots that have no column on the record.

The contribute forms are projected from the LinkML registry, but a record is a
Django row, and most registry slots -- every link to another record, and some
plain values -- have no column on it. The serializer used to drop them without
a word: a contributor linked a deity to its tradition, the request returned
201, and the link was gone.

They are kept now, in two steps:

1. On submit, ``split_registry_extras`` takes them out of the payload and
   checks them. A link must name an existing record of the slot's target type.
   A key that is neither a serializer field nor a registry slot is rejected
   rather than dropped. The checked values travel in the record's revision
   (``_links`` / ``_values``), so the reviewer sees exactly what was proposed.

2. On accept, ``apply_revision_extras`` turns them into ``HeritageAssertion``
   rows -- ``relationship.<slot>`` edges for links, slot assertions for values
   -- citing the record's source and the contributor's stated confidence. The
   RDF signals then project them like any other accepted assertion.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from django.contrib.contenttypes.models import ContentType

logger = logging.getLogger(__name__)

# Keys the form sends that are about the submission rather than a slot.
SUBMISSION_KEYS = frozenset({"source_kind", "confidence"})

CONFIDENCE_VALUES = ("certain", "likely", "uncertain", "speculative")


def _registry_classes() -> dict[str, Any]:
    from .linkml_loader import get_effective_registry_payload

    return get_effective_registry_payload().get("classes") or {}


def registry_fields_for_model(model) -> dict[str, dict]:
    """Registry slots offered on the model's contribute form, by key."""
    from .cidoc_registry_keys import registry_class_key_for_model

    key = registry_class_key_for_model(model)
    entry = _registry_classes().get(key or "") or {}
    return {f["key"]: f for f in entry.get("fields") or [] if f.get("key")}


@lru_cache(maxsize=1)
def _models_by_endpoint() -> dict[str, Any]:
    from .urls import router

    out = {}
    for prefix, viewset, _basename in router.registry:
        model = getattr(getattr(viewset, "queryset", None), "model", None)
        if model is not None:
            out[prefix.strip("/")] = model
    return out


def model_for_endpoint(endpoint: str | None):
    """`/cidoc/traditions/` → the model behind that route, or None."""
    if not endpoint:
        return None
    return _models_by_endpoint().get(endpoint.strip("/").split("/")[-1])


def _ids(value: Any) -> list[str]:
    """The form posts one id, a comma-joined list, a list, or {id: ...}."""
    if isinstance(value, dict):
        value = value.get("id", "")
    items = value if isinstance(value, (list, tuple)) else str(value).split(",")
    out = []
    for item in items:
        if isinstance(item, dict):
            item = item.get("id", "")
        item = str(item).strip()
        if item and item not in out:
            out.append(item)
    return out


def split_registry_extras(serializer, data) -> tuple[dict, dict, dict]:
    """Separate slots the serializer cannot store from the payload.

    Returns ``(payload, extras, errors)``. ``payload`` is what the serializer
    should validate; ``extras`` is ``{"links": [...], "values": {...},
    "source_kind": ..., "confidence": ...}``; ``errors`` maps rejected keys
    to messages.
    """
    if not hasattr(data, "items"):
        return data, {}, {}
    model = serializer.Meta.model
    slots = registry_fields_for_model(model)
    known = set(serializer.fields)
    payload: dict = {}
    links: list[dict] = []
    values: dict[str, Any] = {}
    errors: dict[str, str] = {}
    extras: dict[str, Any] = {}

    for key, value in data.items():
        if key in known:
            payload[key] = value
            continue
        if key in SUBMISSION_KEYS:
            text = str(value or "").strip()
            if key == "confidence" and text and text not in CONFIDENCE_VALUES:
                errors[key] = f"Must be one of: {', '.join(CONFIDENCE_VALUES)}."
            elif text:
                extras[key] = text
            continue
        slot = slots.get(key)
        if slot is None:
            errors[key] = "Not a field of this record type."
            continue
        if value in (None, "", [], {}):
            continue
        target_model = (
            model_for_endpoint(slot.get("relationEndpoint"))
            if slot.get("type") == "relation"
            else None
        )
        if target_model is None:
            # Plain values, and links whose range has no record type of its
            # own (Actor, TimeSpan, ...): the form takes these as text.
            text = (
                ", ".join(str(v) for v in value)
                if isinstance(value, (list, tuple))
                else str(value)
            ).strip()
            if text:
                values[key] = text
            continue
        ids = _ids(value)
        if not slot.get("multivalued") and len(ids) > 1:
            errors[key] = "Takes a single record."
            continue
        found = _existing_pks(target_model, ids)
        missing = [i for i in ids if i not in found]
        if missing:
            errors[key] = (
                f"No {target_model._meta.verbose_name} with id {', '.join(missing)}."
            )
            continue
        ct = ContentType.objects.get_for_model(target_model)
        for target_id in ids:
            links.append(
                {"slot": key, "target": f"{ct.app_label}.{ct.model}", "id": target_id}
            )

    if links:
        extras["links"] = links
    if values:
        extras["values"] = values
    return payload, extras, errors


def _existing_pks(model, ids: list[str]) -> set[str]:
    """Which of ``ids`` name a row of ``model`` (malformed ids name none)."""
    from django.core.exceptions import ValidationError

    if model._meta.pk.get_internal_type() in (
        "AutoField",
        "BigAutoField",
        "IntegerField",
        "BigIntegerField",
    ):
        ids = [i for i in ids if i.isdigit()]
    try:
        rows = model._default_manager.filter(pk__in=ids).values_list("pk", flat=True)
        return {str(pk) for pk in rows}
    except (ValidationError, ValueError):
        return set()


def revision_extras(extras: dict) -> dict:
    """The keys a revision carries for :func:`apply_revision_extras`."""
    out = {}
    if extras.get("links"):
        out["_links"] = extras["links"]
    if extras.get("values"):
        out["_values"] = extras["values"]
    if extras.get("source_kind"):
        out["_source_kind"] = extras["source_kind"]
    if extras.get("confidence"):
        out["_confidence"] = extras["confidence"]
    return out


class MissingEvidence(ValueError):
    """An accepted record must say where its information came from."""


def require_evidence(instance) -> None:
    if getattr(instance, "source_id", None):
        return
    if (getattr(instance, "source_citation", "") or "").strip():
        return
    raise MissingEvidence(
        "This record names no source. Ask the contributor for one (Request "
        "changes) before accepting: a book, inscription, interview, site "
        "visit or personal knowledge."
    )


def _record_source(instance, data: dict, contributor):
    """The DataSource the record's assertions cite, registering one if needed.

    A citation typed on the form becomes a DataSource of the kind the
    contributor chose, so links and values carry a PROV entity rather than a
    bare string. Without a kind there is nothing honest to register.
    """
    from .models import SOURCE_CATEGORY_CHOICES, DataSource

    if instance.source_id:
        return instance.source
    citation = (getattr(instance, "source_citation", "") or "").strip()
    kind = data.get("_source_kind")
    if not citation or kind not in dict(SOURCE_CATEGORY_CHOICES):
        return None
    source = DataSource.objects.create(
        name=citation[:300],
        source_type=kind,
        citation=citation,
        contributed_by=contributor,
        note="Registered from a contribution's source citation on acceptance.",
    )
    instance.source = source
    instance.save(update_fields=["source"])
    return source


def apply_revision_extras(instance, data: dict, *, contributor, reviewer) -> int:
    """Turn an accepted revision's links and values into accepted assertions.

    Idempotent: re-accepting the same revision does not duplicate edges.
    Returns the number of assertions created.
    """
    from .models import DataSource, HeritageAssertion

    links = data.get("_links") or []
    values = data.get("_values") or {}
    if not links and not values:
        return 0
    source = _record_source(instance, data, contributor)
    if source is None and any(not ln["target"].endswith(".datasource") for ln in links):
        raise MissingEvidence(
            "Links to other records must cite a registered source. Pick one "
            "on the form, or give the citation and its kind."
        )
    confidence = data.get("_confidence") or "uncertain"
    s_ct = ContentType.objects.get_for_model(instance, for_concrete_model=True)
    username = getattr(contributor, "username", "") or ""
    common = {
        "source": source,
        "source_citation": (getattr(instance, "source_citation", "") or ""),
        "confidence": confidence,
        "reconciliation_status": "accepted",
        "contributed_by": username,
        "attributed_to_agent": username,
    }
    note = f"Submitted on the contribute form; accepted by {reviewer}."
    created = 0
    for link in links:
        app_label, model_name = link["target"].split(".", 1)
        o_ct = ContentType.objects.get_by_natural_key(app_label, model_name)
        target = o_ct.model_class()._default_manager.filter(pk=link["id"]).first()
        if target is None:
            logger.warning(
                "Link target %s %s no longer exists", link["target"], link["id"]
            )
            continue
        if isinstance(target, DataSource):
            # "Documented in" a source is a citation, not an edge between two
            # records: the assertion names the slot and cites that source.
            exists = HeritageAssertion.objects.filter(
                content_type=s_ct,
                object_id=instance.pk,
                asserted_property=link["slot"],
                source=target,
            ).exists()
            if not exists:
                ha = HeritageAssertion(
                    content_type=s_ct,
                    object_id=instance.pk,
                    asserted_property=link["slot"],
                    asserted_value=target.name,
                    assertion_content=note,
                    **{**common, "source": target},
                )
                ha.full_clean()
                ha.save()
                created += 1
            continue
        prop = f"relationship.{link['slot']}"
        exists = HeritageAssertion.objects.filter(
            content_type=s_ct,
            object_id=instance.pk,
            object_content_type=o_ct,
            object_object_id=target.pk,
            asserted_property=prop,
        ).exists()
        if exists:
            continue
        ha = HeritageAssertion(
            content_type=s_ct,
            object_id=instance.pk,
            object_content_type=o_ct,
            object_object_id=target.pk,
            asserted_property=prop,
            asserted_value="",
            assertion_content=note,
            **common,
        )
        ha.full_clean()
        ha.save()
        created += 1
    for slot, value in values.items():
        exists = HeritageAssertion.objects.filter(
            content_type=s_ct,
            object_id=instance.pk,
            asserted_property=slot,
            asserted_value=value,
        ).exists()
        if exists:
            continue
        ha = HeritageAssertion(
            content_type=s_ct,
            object_id=instance.pk,
            asserted_property=slot,
            asserted_value=value,
            assertion_content=note,
            **common,
        )
        ha.full_clean()
        ha.save()
        created += 1
    return created


def _existing_uuid(value) -> str | None:
    import uuid

    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        return None


def describe_revision_extras(entity, data: dict) -> dict:
    """What a reviewer needs to judge a revision's links: names, not ids."""
    from .models import SOURCE_CATEGORY_CHOICES, DataSource

    ct = getattr(entity, "cidoc_content_type", None)
    model = ct.model_class() if ct is not None else None
    slots = registry_fields_for_model(model) if model is not None else {}
    links = []
    for link in data.get("_links") or []:
        app_label, model_name = link["target"].split(".", 1)
        try:
            target_ct = ContentType.objects.get_by_natural_key(app_label, model_name)
            target = (
                target_ct.model_class()._default_manager.filter(pk=link["id"]).first()
            )
        except Exception:
            target = None
        links.append(
            {
                "slot": link["slot"],
                "label": (slots.get(link["slot"]) or {}).get("label") or link["slot"],
                "target_id": link["id"],
                "target_type": str(target_ct.model_class()._meta.verbose_name).title()
                if target is not None
                else model_name,
                "target_label": (
                    getattr(target, "name", None)
                    or getattr(target, "title", None)
                    or str(target)
                )
                if target is not None
                else None,
                "target_status": getattr(target, "status", None)
                if target is not None
                else "missing",
            }
        )
    values = [
        {"slot": k, "label": (slots.get(k) or {}).get("label") or k, "value": v}
        for k, v in (data.get("_values") or {}).items()
    ]
    source = None
    raw = data.get("source")
    source_id = raw.get("id") if isinstance(raw, dict) else raw
    if source_id:
        ds = DataSource.objects.filter(pk=_existing_uuid(source_id)).first()
        if ds is not None:
            source = {
                "id": str(ds.pk),
                "name": ds.name,
                "kind": ds.get_source_type_display(),
            }
    return {
        "links": links,
        "values": values,
        "source": source,
        "source_citation": data.get("source_citation") or "",
        "source_kind": dict(SOURCE_CATEGORY_CHOICES).get(
            data.get("_source_kind") or "", ""
        ),
        "confidence": data.get("_confidence") or "",
    }
