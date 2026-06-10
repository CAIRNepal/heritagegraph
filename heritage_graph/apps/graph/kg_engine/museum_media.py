"""Museum narrative + imagery for live KG nodes (ORM + curated Wikimedia index).

Surfaces contributor ``note`` text, linked ``Media`` uploads, and — when no upload
exists — label-matched Wikimedia URLs from the frozen demo corpus (with stored
``imageCredits`` for honest attribution). Also emits ``schema:image`` / ``rdfs:comment``
triples for RDF projection.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from apps.cidoc_data.cidoc_registry_keys import (
    DJANGO_MODEL_TO_REGISTRY_CLASS_KEY,
    registry_class_key_for_model,
)
from apps.graph.ontology_config import RDF_PREFIXES

CRM = RDF_PREFIXES["crm"]
RDFS = RDF_PREFIXES["rdfs"]
SCHEMA_IMAGE = RDF_PREFIXES["schema"] + "image"

_REPO_ROOT = Path(__file__).resolve().parents[4]
_DEMO_CORPUS = _REPO_ROOT / "heritage_graph_ui" / "src" / "data" / "heritage-demo.json"

# Normalized label aliases → demo corpus label key
_LABEL_ALIASES: dict[str, str] = {
    "swayambhunath stupa": "swayambhunath",
    "swayambhu stupa": "swayambhunath",
    "boudhanath stupa": "boudhanath",
    "krishna mandir patan": "krishna mandir",
    "pashupatinath temple": "pashupatinath",
    "hanuman dhoka palace": "hanuman dhoka",
    "kathmandu durbar square": "kathmandu durbar square",
}


def _normalize_label(label: str | None) -> str:
    text = re.sub(r"\s+", " ", (label or "").strip().lower())
    text = re.sub(r"[^\w\s]", "", text)
    return _LABEL_ALIASES.get(text, text)


@dataclass
class MuseumMediaBundle:
    comment: str | None = None
    image_url: str | None = None
    images: list[str] = field(default_factory=list)
    image_credits: dict[str, dict[str, str]] = field(default_factory=dict)
    narrative_source: str | None = None  # orm_note | orm_media | demo_wikimedia
    image_source: str | None = None


def comment_from_instance(instance: Any) -> str | None:
    label = getattr(instance, "name", None) or getattr(instance, "title", None)
    note = getattr(instance, "note", None)
    if note and str(note).strip():
        return str(note).strip()[:4000]
    for attr in ("description", "abstract", "summary"):
        raw = getattr(instance, attr, None)
        if not raw or not str(raw).strip():
            continue
        text = str(raw).strip()
        if label and text.lower() == str(label).strip().lower():
            continue
        if len(text) < 120:
            continue
        return text[:4000]
    return None


def _absolute_media_url(file_field: Any) -> str | None:
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    from django.conf import settings

    base = (
        getattr(settings, "PUBLIC_API_BASE_URL", None)
        or getattr(settings, "SITE_URL", None)
        or "http://localhost:8000"
    )
    return f"{str(base).rstrip('/')}{url}"


@dataclass
class _DemoCorpusEntry:
    images: list[str]
    credits: dict[str, dict[str, str]]
    story_text: str | None = None
    description: str | None = None


@lru_cache(maxsize=1)
def _demo_corpus_index() -> dict[str, _DemoCorpusEntry]:
    """label (normalized) → frozen demo narrative + imagery."""
    index: dict[str, _DemoCorpusEntry] = {}
    if not _DEMO_CORPUS.is_file():
        return index
    try:
        raw = json.loads(_DEMO_CORPUS.read_text(encoding="utf-8"))
    except Exception:
        return index
    for item in raw.get("@graph") or []:
        if not item.get("nodeType"):
            continue
        label = _normalize_label(item.get("label"))
        if not label:
            continue
        urls: list[str] = []
        if item.get("imageUrl"):
            urls.append(str(item["imageUrl"]))
        for u in item.get("images") or []:
            if u and str(u) not in urls:
                urls.append(str(u))
        story = (item.get("storyText") or item.get("description") or "").strip() or None
        desc = (item.get("description") or "").strip() or None
        node_credits: dict[str, dict[str, str]] = {}
        raw_credits = item.get("imageCredits") or {}
        if isinstance(raw_credits, dict):
            for url, credit in raw_credits.items():
                if isinstance(credit, dict):
                    node_credits[str(url)] = {
                        k: str(v)
                        for k, v in credit.items()
                        if v is not None and str(v).strip()
                    }
        if not urls and not story:
            continue
        existing = index.get(label)
        if existing:
            for u in urls:
                if u not in existing.images:
                    existing.images.append(u)
            existing.credits.update(node_credits)
            if story and not existing.story_text:
                existing.story_text = story
            if desc and not existing.description:
                existing.description = desc
        else:
            index[label] = _DemoCorpusEntry(
                images=urls,
                credits=node_credits,
                story_text=story,
                description=desc,
            )
    return index


def _demo_entry_for_label(label: str | None) -> _DemoCorpusEntry | None:
    norm = _normalize_label(label)
    if not norm:
        return None
    index = _demo_corpus_index()
    hit = index.get(norm)
    if hit:
        return hit
    for demo_label, entry in index.items():
        if demo_label in norm or norm in demo_label:
            return entry
    return None


@lru_cache(maxsize=1)
def _cidoc_upload_media_index() -> dict[tuple[str, int], list[Any]]:
    """(registry_segment, cidoc_pk) → Media rows linked via CulturalEntity revisions."""
    from apps.heritage_data.models import Media, Revision

    index: dict[tuple[str, int], list[Any]] = {}
    for rev in Revision.objects.select_related("entity").only("entity_id", "data"):
        data = rev.data if isinstance(rev.data, dict) else {}
        model_name = data.get("_cidoc_model")
        cidoc_id = data.get("_cidoc_id")
        if not model_name or cidoc_id is None:
            continue
        try:
            from django.apps import apps

            model = apps.get_model("cidoc_data", str(model_name))
            segment = registry_class_key_for_model(model)
        except Exception:
            continue
        if not segment:
            continue
        key = (segment, int(cidoc_id))
        if key in index:
            continue
        media_rows = list(
            Media.objects.filter(
                cultural_entity_id=rev.entity_id,
                media_type="image",
            ).order_by("id")
        )
        if media_rows:
            index[key] = media_rows
    return index


def wikimedia_bundle_for_label(label: str | None) -> MuseumMediaBundle | None:
    entry = _demo_entry_for_label(label)
    if not entry or not entry.images:
        return None
    bundle = MuseumMediaBundle(
        comment=entry.story_text or entry.description,
        image_url=entry.images[0],
        images=list(entry.images),
        narrative_source="demo_corpus_label_match",
        image_source="demo_wikimedia_label_match",
    )
    for url in entry.images:
        if url in entry.credits:
            bundle.image_credits[url] = dict(entry.credits[url])
        else:
            bundle.image_credits[url] = {
                "source": "Wikimedia Commons",
                "license": "See file page",
                "descriptionUrl": url,
            }
    return bundle


def media_bundle_for_resource(
    segment: str,
    pk: int,
    *,
    label: str | None = None,
    instance: Any | None = None,
) -> MuseumMediaBundle:
    """Resolve narrative + imagery for one curated resource IRI."""
    bundle = MuseumMediaBundle()

    if instance is not None:
        note = comment_from_instance(instance)
        if note:
            bundle.comment = note
            bundle.narrative_source = "orm_note"

    upload_index = _cidoc_upload_media_index()
    uploads = upload_index.get((segment, pk)) or []
    for media in uploads:
        url = _absolute_media_url(media.file)
        if not url:
            continue
        if url not in bundle.images:
            bundle.images.append(url)
        bundle.image_credits[url] = {
            "source": "HeritageGraph contributor upload",
            "license": "See record provenance",
            "artist": getattr(media, "description", None) or "",
        }
    if bundle.images:
        bundle.image_url = bundle.images[0]
        bundle.image_source = "orm_media"

    if label:
        wiki = wikimedia_bundle_for_label(label)
        if wiki:
            if not bundle.comment and wiki.comment:
                bundle.comment = wiki.comment
                bundle.narrative_source = wiki.narrative_source
            if not bundle.images:
                bundle.image_url = wiki.image_url
                bundle.images = wiki.images
                bundle.image_credits.update(wiki.image_credits)
                bundle.image_source = wiki.image_source

    return bundle


def representation_triples_for_instance(
    instance: Any,
    subject_uri: str,
) -> tuple[list[tuple[str, str | None, tuple[str, str] | None]], set[str]]:
    """Return (triple tuples, managed predicates) for museum comment + schema:image."""
    from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model

    triples: list[tuple[str, str | None, tuple[str, str] | None]] = []
    managed: set[str] = set()

    note = comment_from_instance(instance)
    if note:
        triples.append((subject_uri, RDFS + "comment", (note[:4000], "xsd:string")))
        managed.add(RDFS + "comment")

    segment = registry_class_key_for_model(instance.__class__)
    pk = getattr(instance, "pk", None)
    label = getattr(instance, "name", None) or getattr(instance, "title", None)
    if segment and pk is not None:
        bundle = media_bundle_for_resource(
            segment,
            int(pk),
            label=str(label) if label else None,
            instance=instance,
        )
        for url in bundle.images[:8]:
            triples.append((subject_uri, SCHEMA_IMAGE, (url, "xsd:anyURI")))
        if bundle.images:
            managed.add(SCHEMA_IMAGE)

    return triples, managed


def registry_segment_for_model_name(model_name: str) -> str | None:
    return DJANGO_MODEL_TO_REGISTRY_CLASS_KEY.get(model_name)
