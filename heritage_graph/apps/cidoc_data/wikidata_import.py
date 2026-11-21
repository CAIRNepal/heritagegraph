"""Import the frozen Wikidata snapshot (data/wikidata/heritage-snapshot.json).

Every row and edge carries its evidence: the record's `source` is the Wikidata
DataSource and `source_citation` names the item, revision and retrieval date;
every relationship is an accepted `relationship.<code>` assertion citing the
statement it came from. Re-running is idempotent: rows are keyed by their
Wikidata IRI through LodExternalIdentity.

Only statements with an unambiguous HeritageGraph reading become edges (see
EDGE_RULES). A statement that would need a guess -- "has part" from a district
to a temple, "part of" between two deities -- is skipped and counted, not
mapped onto the nearest predicate.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from apps.cidoc_data.edtf_field import validate_edtf
from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.models import (
    ArchitecturalStructure,
    DataSource,
    Deity,
    EntityCluster,
    Festival,
    HeritageAssertion,
    Location,
    LodExternalIdentity,
    Person,
    Tradition,
)
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction

logger = logging.getLogger(__name__)

CONTRIBUTOR = "wikidata_import"
WD = "http://www.wikidata.org/entity/"
DATA_SOURCE_IRI = "https://www.wikidata.org/"

MODELS = {
    "structure": ArchitecturalStructure,
    "location": Location,
    "festival": Festival,
    "deity": Deity,
    "tradition": Tradition,
    "person": Person,
}

# (subject key, Wikidata property, object key) -> HeritageGraph predicate code.
# Ontology slots where one fits; `located_in`, `dedicated_to` and
# `commissioned_by` are the codes the curated graph already uses for relations
# the ontology has no slot for.
EDGE_RULES: dict[tuple[str, str, str], str] = {
    ("structure", "P276", "location"): "has_current_location",
    ("structure", "P131", "location"): "has_current_location",
    ("structure", "P825", "deity"): "dedicated_to",
    ("structure", "P140", "tradition"): "has_religious_tradition",
    ("structure", "P1049", "tradition"): "has_religious_tradition",
    ("structure", "P361", "structure"): "is_component_of",
    ("structure", "P88", "person"): "commissioned_by",
    ("location", "P131", "location"): "located_in",
    ("location", "P706", "location"): "located_in",
    ("festival", "P276", "location"): "took_place_at",
    ("festival", "P276", "structure"): "took_place_at",
    ("festival", "P131", "location"): "took_place_at",
    ("festival", "P361", "festival"): "is_part_of_festival",
    ("festival", "P825", "deity"): "invokes_deity",
    ("deity", "P140", "tradition"): "has_religious_tradition",
    ("deity", "P1049", "tradition"): "has_religious_tradition",
}
# Single-valued slots take the first statement, preferring the earlier property.
SINGLE_VALUED = {"has_current_location", "took_place_at", "is_component_of"}
PROPERTY_PREFERENCE = ["P276", "P131", "P706"]

# A Nepali or Nepal Bhasa label must be in Devanagari; Wikidata carries a few
# Latin-script values under "ne" that are not labels at all.
DEVANAGARI_LANGS = {"ne", "new"}
DEVANAGARI = re.compile("[\u0900-\u097F]")

TEMPLE_CLASSES = {"Q44539", "Q842402", "Q5393308", "Q697295", "Q1088552"}
STUPA_CLASSES = {"Q180987"}


@dataclass
class ImportReport:
    created: dict[str, int] = field(default_factory=dict)
    updated: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)
    matched_existing: list[str] = field(default_factory=list)

    def bump(self, bucket: dict[str, int], key: str) -> None:
        bucket[key] = bucket.get(key, 0) + 1


def _citation(qid: str, ent: dict, retrieved: str) -> str:
    rev = ent.get("lastrevid")
    return (
        f"Wikidata {qid}"
        + (f" (revision {rev})" if rev else "")
        + f", retrieved {retrieved}, CC0 1.0."
    )


def _edtf_from_inception(inception: dict | None) -> str:
    """Year/month/day-precision Wikidata times only; coarser ones are not dates."""
    if not inception or inception.get("precision", 0) < 9:
        return ""
    time = inception["time"]
    if time.startswith("-"):
        return ""
    y, m, d = time.lstrip("+").split("T")[0].split("-")
    precision = inception["precision"]
    value = y if precision == 9 else (f"{y}-{m}" if precision == 10 else f"{y}-{m}-{d}")
    try:
        validate_edtf(value)
    except ValidationError:
        return ""
    return value


def _structure_type(ent: dict) -> str:
    classes = set(ent.get("instanceOf") or [])
    if classes & STUPA_CLASSES:
        return "Stupa"
    if classes & TEMPLE_CLASSES:
        return "Temple"
    return "Other"


def _point(ent: dict) -> str:
    c = ent.get("coord")
    return f"{c['lat']}, {c['lon']}" if c else ""


def _name(ent: dict) -> str:
    labels = ent.get("labels") or {}
    return (labels.get("en") or labels.get("ne") or "").strip()[:200]


def ensure_data_source(retrieved: str) -> DataSource:
    bound = LodExternalIdentity.objects.filter(external_iri=DATA_SOURCE_IRI).first()
    if bound:
        ds = DataSource.objects.filter(pk=bound.object_id).first()
        if ds:
            return ds
    ds, _ = DataSource.objects.get_or_create(
        name="Wikidata",
        defaults={
            "source_type": "web",
            "url": DATA_SOURCE_IRI,
            "citation": "Wikidata, the free knowledge base. Wikimedia Foundation. CC0 1.0.",
            "note": f"Frozen snapshot data/wikidata/heritage-snapshot.json, retrieved {retrieved}.",
            "ingest_status": "ready",
            "access_tier": "public",
            "care_labels": [],
        },
    )
    _bind(DATA_SOURCE_IRI, ds)
    return ds


def _bind(iri: str, instance: Any) -> None:
    ct = ContentType.objects.get_for_model(instance, for_concrete_model=True)
    LodExternalIdentity.objects.update_or_create(
        external_iri=iri,
        defaults={
            "content_type": ct,
            "object_id": str(instance.pk),
            "import_pass": CONTRIBUTOR,
        },
    )


def _resolve(iri: str) -> Any | None:
    row = LodExternalIdentity.objects.filter(external_iri=iri).first()
    if not row:
        return None
    model = row.content_type.model_class()
    return model.objects.filter(pk=row.object_id).first() if model else None


def _ensure_exact_match(instance: Any, label: str, iri: str) -> None:
    """skos:exactMatch through the record's identity cluster (the DANAM pattern).

    A curated record may already sit in a cluster (bootstrap_identity_clusters);
    the Wikidata IRI joins that cluster, because projection emits no exactMatch
    for a record in two clusters.
    """
    from apps.cidoc_data import identity_services

    ct = ContentType.objects.get_for_model(instance, for_concrete_model=True)
    cluster_ids = identity_services.cluster_distinct_ids_for_subject(
        ContentType.objects.get_for_model(instance.__class__, for_concrete_model=False),
        instance.pk,
    )
    if len(cluster_ids) == 1:
        cluster = EntityCluster.objects.get(pk=cluster_ids[0])
        ids = dict(cluster.external_identifiers or {})
        if ids.get("wikidata") != iri:
            ids["wikidata"] = iri
            cluster.external_identifiers = ids
            cluster.save(update_fields=["external_identifiers", "updated_at"])
        return
    existing = (
        HeritageAssertion.objects.filter(
            content_type=ct,
            object_id=instance.pk,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            entity_cluster__isnull=False,
            reconciliation_status="accepted",
            supersedes__isnull=True,
        )
        .select_related("entity_cluster")
        .first()
    )
    if existing:
        cluster = existing.entity_cluster
        ids = dict(cluster.external_identifiers or {})
        if ids.get("wikidata") != iri:
            ids["wikidata"] = iri
            cluster.external_identifiers = ids
            cluster.save(update_fields=["external_identifiers", "updated_at"])
        return
    cluster = EntityCluster.objects.create(
        canonical_label=label[:500] or str(instance.pk),
        type_scope=ct.model,
        external_identifiers={"wikidata": iri},
        note="Wikidata import singleton cluster",
    )
    ha = HeritageAssertion(
        content_type=ct,
        object_id=instance.pk,
        asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
        asserted_value="",
        assertion_content="Wikidata import singleton membership",
        entity_cluster=cluster,
        reconciliation_status="accepted",
        confidence="certain",
        contributed_by=CONTRIBUTOR,
    )
    ha.full_clean()
    ha.save()


def _fields_for(key: str, ent: dict, seed: dict) -> dict[str, Any]:
    desc = (ent.get("descriptions") or {}).get("en", "")
    if key == "structure":
        out = {"structure_type": _structure_type(ent), "note": desc}
        if ent.get("inception"):
            out["construction_date"] = _edtf_from_inception(ent["inception"])
        if ent.get("coord"):
            out["point"] = _point(ent)
        return out
    if key == "location":
        out = {"description": desc}
        if ent.get("coord"):
            out["point"] = _point(ent)
        return out
    if key == "tradition":
        return {"description": desc, "type": seed.get("type", "")}
    if key == "person":
        return {"biography": desc}
    return {"note": desc}  # festival, deity


def _enrich_curated(instance, labels: dict, media: list, qid: str, ent: dict, retrieved: str) -> bool:
    changed = []
    merged = {**labels, **(instance.labels or {})}
    if merged != (instance.labels or {}):
        instance.labels = merged
        changed.append("labels")
    if media and not instance.media:
        instance.media = media
        changed.append("media")
    note = f"Labels{' and image' if media else ''} added from {_citation(qid, ent, retrieved)}"
    citation = (instance.source_citation or "").strip()
    if changed and f"Wikidata {qid}" not in citation:
        instance.source_citation = f"{citation}\n{note}".strip()
        changed.append("source_citation")
    if changed:
        instance.save(update_fields=changed)
    return bool(changed)


def upsert_entities(
    snapshot: dict, seeds: dict[str, dict], source: DataSource, report: ImportReport
) -> dict[str, Any]:
    retrieved = snapshot["_provenance"]["retrieved"]
    media = snapshot.get("media", {})
    rows: dict[str, Any] = {}
    # Hand-picked seeds claim exact-name matches first: Wikidata has near
    # duplicates (two items labelled "Boudhanath"), and the curated record
    # belongs with the seed, not whichever duplicate sorts first.
    order = {"seed": 0, "sweep": 1, "neighbour": 2}
    entities = sorted(
        snapshot["entities"].items(),
        key=lambda kv: (order.get(kv[1].get("role"), 3), kv[0]),
    )
    for qid, ent in entities:
        key = ent.get("key")
        model = MODELS.get(key or "")
        name = _name(ent)
        if model is None:
            report.bump(report.skipped, f"entity:{key or 'unclassified'}")
            continue
        if not name:
            report.bump(report.skipped, "entity:no_label")
            continue
        iri = WD + qid
        fields = _fields_for(key, ent, seeds.get(qid, {}))
        labels = {
            k: v
            for k, v in (ent.get("labels") or {}).items()
            if v and (k not in DEVANAGARI_LANGS or DEVANAGARI.search(v))
        }
        image = media.get(ent.get("image") or "")
        evidence = {
            "status": "accepted",
            "contributor": CONTRIBUTOR,
            "source": source,
            "source_citation": _citation(qid, ent, retrieved),
            "labels": labels,
            "media": [image] if image else [],
        }

        instance = _resolve(iri)
        if instance is None:
            # An existing row of the same type and exact name is the same
            # subject: enrich it rather than create a duplicate. Rows already
            # bound to a Wikidata item are excluded -- Nepal has several
            # Manakamana and Bhadrakali temples, and a shared name must not
            # merge two items into one record.
            ct = ContentType.objects.get_for_model(model, for_concrete_model=True)
            bound = LodExternalIdentity.objects.filter(
                content_type=ct, external_iri__startswith=WD
            ).values_list("object_id", flat=True)
            candidates = model.objects.filter(name__iexact=name).exclude(
                pk__in=list(bound)
            )
            if candidates.count() == 1:
                instance = candidates.first()
                report.matched_existing.append(f"{key}:{name} <- {qid}")
            elif candidates.count() > 1:
                report.bump(report.skipped, "match:ambiguous_name_created_new")
        if instance is None:
            instance = model.objects.create(name=name, **fields, **evidence)
            report.bump(report.created, key)
        elif instance.contributor == CONTRIBUTOR:
            changed = []
            for attr, value in {**fields, **evidence}.items():
                if value not in ("", [], {}, None) and getattr(instance, attr, None) != value:
                    setattr(instance, attr, value)
                    changed.append(attr)
            if changed:
                instance.save(update_fields=changed)
                report.bump(report.updated, key)
        else:
            # A curated record keeps its own contributor, source, status and
            # text: those describe where *its* content came from. Only what
            # Wikidata supplies is added, and the citation says so.
            changed = _enrich_curated(instance, labels, evidence["media"], qid, ent, retrieved)
            if changed:
                report.bump(report.updated, key)
        _bind(iri, instance)
        _ensure_exact_match(instance, name, iri)
        rows[qid] = instance
    return rows


def upsert_edges(
    snapshot: dict, rows: dict[str, Any], source: DataSource, report: ImportReport
) -> None:
    retrieved = snapshot["_provenance"]["retrieved"]
    entities = snapshot["entities"]
    for qid, ent in entities.items():
        subject = rows.get(qid)
        if subject is None:
            continue
        s_key = ent["key"]
        claims = ent.get("claims") or {}
        used_single: set[str] = set()
        props = sorted(
            claims,
            key=lambda p: PROPERTY_PREFERENCE.index(p)
            if p in PROPERTY_PREFERENCE
            else 99,
        )
        for prop in props:
            for target in claims[prop]:
                obj = rows.get(target)
                if obj is None:
                    report.bump(report.skipped, "edge:target_not_imported")
                    continue
                code = EDGE_RULES.get((s_key, prop, entities[target]["key"]))
                if code is None:
                    report.bump(
                        report.skipped,
                        f"edge:no_rule:{s_key}-{prop}-{entities[target]['key']}",
                    )
                    continue
                if code in SINGLE_VALUED:
                    if code in used_single:
                        report.bump(report.skipped, f"edge:single_valued:{code}")
                        continue
                    used_single.add(code)
                _upsert_edge(
                    subject,
                    obj,
                    code,
                    prop,
                    qid,
                    target,
                    ent,
                    source,
                    retrieved,
                    report,
                )


def _upsert_edge(
    subject, obj, code, prop, qid, target, ent, source, retrieved, report
) -> None:
    s_ct = ContentType.objects.get_for_model(subject, for_concrete_model=True)
    o_ct = ContentType.objects.get_for_model(obj, for_concrete_model=True)
    prop_name = f"relationship.{code}"
    citation = (
        f"Wikidata {qid} {prop} {target}"
        + (f" (revision {ent['lastrevid']})" if ent.get("lastrevid") else "")
        + f", retrieved {retrieved}, CC0 1.0."
    )
    existing = HeritageAssertion.objects.filter(
        content_type=s_ct,
        object_id=subject.pk,
        object_content_type=o_ct,
        object_object_id=obj.pk,
        asserted_property=prop_name,
    ).first()
    if existing:
        report.bump(
            report.updated
            if existing.contributed_by == CONTRIBUTOR
            else report.skipped,
            "edge",
        )
        return
    ha = HeritageAssertion(
        content_type=s_ct,
        object_id=subject.pk,
        object_content_type=o_ct,
        object_object_id=obj.pk,
        asserted_property=prop_name,
        asserted_value="",
        assertion_content=f"From Wikidata statement {qid} {prop} {target}",
        source=source,
        source_citation=citation,
        confidence="likely",
        reconciliation_status="accepted",
        contributed_by=CONTRIBUTOR,
        attributed_to_agent=CONTRIBUTOR,
    )
    ha.full_clean()
    ha.save()
    report.bump(report.created, f"edge:{code}")


def run_import(snapshot_path: Path, seeds: dict[str, dict]) -> ImportReport:
    snapshot = json.loads(snapshot_path.read_text())
    report = ImportReport()
    with transaction.atomic():
        source = ensure_data_source(snapshot["_provenance"]["retrieved"])
        rows = upsert_entities(snapshot, seeds, source, report)
        upsert_edges(snapshot, rows, source, report)
    return report
