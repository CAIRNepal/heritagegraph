"""L1 materialization: NQ index → Postgres CIDOC / HeritageAssertion / DataSource."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal

from django.contrib.contenttypes.models import ContentType
from django.db import transaction

from apps.cidoc_data.danam_import.constants import (
    CORPUS_DATA_SOURCES,
    CRM_E53_PLACE,
    CRM_P55,
    CRMINF_I2_BELIEF,
    DEFAULT_LOCATION_STATUS,
    DEFAULT_LOCATION_TYPE,
    GEO_AS_WKT,
    HG_ASSERTS_ABOUT,
    HG_CONFIDENCE_SCORE,
    HG_EXISTENCE_STATUS,
    IMPORT_CONTRIBUTOR,
    IMPORT_STATUS,
    OWL_SAME_AS,
    PREFERRED_LABEL_LANGS,
    PROV_WAS_DERIVED_FROM,
    PROV_WAS_INFLUENCED_BY,
    RDF_TYPE,
    RDFS_LABEL,
    RDFS_SEE_ALSO,
    SKOS_ALT_LABEL,
    STRUCTURE_RDF_TYPES,
    STRUCTURE_TYPE_BY_RDF,
)
from apps.cidoc_data.danam_import.nq import NqIndex, Term, build_full_index
from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.models import (
    ArchitecturalStructure,
    DataSource,
    EntityCluster,
    HeritageAssertion,
    Location,
    LodExternalIdentity,
)

logger = logging.getLogger(__name__)

PassName = Literal["structures", "assertions", "all"]

_POINT_WKT_RE = re.compile(
    r"POINT\s*(?:Z\s*)?\(\s*([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)",
    re.IGNORECASE,
)


@dataclass
class ImportReport:
    sha256: str = ""
    input_path: str = ""
    pass_name: str = ""
    dry_run: bool = True
    limit: int | None = None
    quad_count: int = 0
    parse_errors: int = 0
    schema_version: str = ""
    ontology_pin: dict[str, str] = field(default_factory=dict)
    created: dict[str, int] = field(default_factory=dict)
    updated: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)
    failures: list[dict[str, str]] = field(default_factory=list)
    shacl_failures: list[dict[str, str]] = field(default_factory=list)
    reject_audit: dict[str, Any] = field(default_factory=dict)
    data_sources: dict[str, str] = field(default_factory=dict)
    samples: list[dict[str, Any]] = field(default_factory=list)
    license_matrix: dict[str, dict[str, str]] = field(default_factory=dict)

    def bump(self, bucket: dict[str, int], key: str, n: int = 1) -> None:
        bucket[key] = bucket.get(key, 0) + n

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def write_json(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(self.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def _truncate(value: str, max_len: int) -> str:
    value = (value or "").strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 1].rstrip() + "…"


def _pick_label(index: NqIndex, subject: str) -> str:
    labels = index.literals(subject, RDFS_LABEL)
    if not labels:
        labels = index.literals(subject, SKOS_ALT_LABEL)
    if not labels:
        return ""
    by_lang = {((t.lang or "").split("-")[0].lower()): t.value for t in labels}
    for lang in PREFERRED_LABEL_LANGS:
        if lang in by_lang and by_lang[lang].strip():
            return by_lang[lang].strip()
    # Prefer untagged / first non-empty
    for t in labels:
        if t.value.strip():
            return t.value.strip()
    return ""


def _parse_wkt_point(wkt: str) -> str | None:
    """Return CharField ``point`` as ``\"lat,lon\"`` (platform convention).

    GeoSPARQL WKT is ``POINT(lon lat)``. HeritageGraph's non-GIS ``point``
    CharField is lat-first (see ``_wkt_from_point_column`` / contribute forms).
    Storing lon-first here swapped Atlas/Museum pins into the wrong hemisphere.
    """
    m = _POINT_WKT_RE.search(wkt or "")
    if not m:
        return None
    lon, lat = m.group(1), m.group(2)
    return f"{lat},{lon}"


def _existence_status(index: NqIndex, subject: str) -> str:
    lit = index.first_literal(subject, HG_EXISTENCE_STATUS)
    if not lit:
        return ""
    val = lit.value.strip()
    allowed = {
        "Extant",
        "PartiallyExtant",
        "Destroyed",
        "Lost",
        "Hypothetical",
        "Unknown",
    }
    return val if val in allowed else ""


def _structure_rdf_type(index: NqIndex, subject: str) -> str | None:
    for p, o, _g in index.by_subject.get(subject, ()):
        if p == RDF_TYPE and o.kind == "iri" and o.value in STRUCTURE_RDF_TYPES:
            return o.value
    return None


def _external_ids_for_subject(index: NqIndex, subject: str) -> dict[str, str]:
    ext: dict[str, str] = {"danam": subject}
    for o in index.objects(subject, OWL_SAME_AS):
        if o.kind == "iri" and "wikidata.org" in o.value:
            ext["wikidata"] = o.value
    for o in index.objects(subject, RDFS_SEE_ALSO):
        if o.kind == "iri" and "openstreetmap.org" in o.value:
            ext["openstreetmap"] = o.value
    return ext


def _confidence_from_score(score: Term | None) -> tuple[str, Decimal | None]:
    if score is None:
        return "likely", None
    try:
        num = Decimal(score.value)
    except (InvalidOperation, ValueError):
        return "likely", None
    if num >= Decimal("0.9"):
        level = "certain"
    elif num >= Decimal("0.7"):
        level = "likely"
    elif num >= Decimal("0.4"):
        level = "uncertain"
    else:
        level = "speculative"
    return level, num


def ensure_corpus_data_sources(
    *, dry_run: bool, report: ImportReport
) -> dict[str, DataSource | None]:
    """Upsert the four corpus DataSource rows; keyed by corpus source IRI."""
    out: dict[str, DataSource | None] = {}
    for iri, meta in CORPUS_DATA_SOURCES.items():
        existing = LodExternalIdentity.objects.filter(external_iri=iri).first()
        if existing and existing.content_type.model == "datasource":
            ds = DataSource.objects.filter(pk=existing.object_id).first()
            if ds:
                out[iri] = ds
                report.data_sources[iri] = str(ds.pk)
                continue
        by_name = DataSource.objects.filter(name=meta["name"]).first()
        if by_name:
            if not dry_run:
                _bind_identity(iri, by_name, report.sha256, "datasources")
            out[iri] = by_name
            report.data_sources[iri] = str(by_name.pk)
            report.bump(report.updated, "DataSource")
            continue
        if dry_run:
            report.bump(report.created, "DataSource")
            report.data_sources[iri] = "(dry-run)"
            out[iri] = None
            continue
        ds = DataSource.objects.create(
            name=meta["name"],
            source_type=meta["source_type"],
            url=meta.get("url", ""),
            citation=meta.get("citation", ""),
            note=(
                f"Bulk import seed; corpus IRI {iri}\n"
                f"license: {meta.get('license_short', '')} "
                f"<{meta.get('license_uri', '')}>\n"
                "CARE: community stewardship applies to living heritage rows; "
                "public SPARQL uses the CARE-aware proxy."
            ),
            ingest_status="ready",
            datacite_publisher="CAIR-Nepal",
            access_tier="public",
            care_labels=[],
        )
        _bind_identity(iri, ds, report.sha256, "datasources")
        out[iri] = ds
        report.data_sources[iri] = str(ds.pk)
        report.bump(report.created, "DataSource")
    return out


def _bind_identity(
    external_iri: str,
    instance: Any,
    sha256: str,
    import_pass: str,
) -> LodExternalIdentity:
    ct = ContentType.objects.get_for_model(instance, for_concrete_model=True)
    obj, _created = LodExternalIdentity.objects.update_or_create(
        external_iri=external_iri,
        defaults={
            "content_type": ct,
            "object_id": str(instance.pk),
            "source_batch_sha256": sha256,
            "import_pass": import_pass,
        },
    )
    return obj


def _resolve_identity(external_iri: str) -> tuple[Any, Any] | None:
    """Return (model_class, instance) or None."""
    row = LodExternalIdentity.objects.filter(external_iri=external_iri).first()
    if not row:
        return None
    model = row.content_type.model_class()
    if model is None:
        return None
    inst = model.objects.filter(pk=row.object_id).first()
    if inst is None:
        return None
    return model, inst


def _ensure_identity_cluster(
    instance: ArchitecturalStructure | Location,
    label: str,
    external_ids: dict[str, str],
    *,
    dry_run: bool,
) -> None:
    ct = ContentType.objects.get_for_model(instance, for_concrete_model=True)
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
    if dry_run:
        return
    if existing and existing.entity_cluster_id:
        cluster = existing.entity_cluster
        merged = dict(cluster.external_identifiers or {})
        merged.update(external_ids)
        if merged != (cluster.external_identifiers or {}):
            cluster.external_identifiers = merged
            if label and cluster.canonical_label != label[:500]:
                cluster.canonical_label = label[:500]
            cluster.save(update_fields=["external_identifiers", "canonical_label", "updated_at"])
        return
    cluster = EntityCluster.objects.create(
        canonical_label=_truncate(label, 500) or str(instance.pk),
        type_scope=ct.model,
        external_identifiers=external_ids,
        note="DANAM bulk import singleton cluster",
    )
    ha = HeritageAssertion(
        content_type=ct,
        object_id=instance.pk,
        asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
        asserted_value="",
        assertion_content="DANAM import singleton membership",
        entity_cluster=cluster,
        reconciliation_status="accepted",
        confidence="certain",
        contributed_by=IMPORT_CONTRIBUTOR,
    )
    ha.full_clean()
    ha.save()


def _upsert_location(
    index: NqIndex,
    place_iri: str,
    *,
    dry_run: bool,
    report: ImportReport,
) -> Location | None:
    resolved = _resolve_identity(place_iri)
    label = _pick_label(index, place_iri) or place_iri.rsplit("/", 1)[-1]
    label = _truncate(label, 200)
    wkt = index.first_literal(place_iri, GEO_AS_WKT)
    point = _parse_wkt_point(wkt.value) if wkt else None
    ext = _external_ids_for_subject(index, place_iri)

    if resolved and resolved[0] is Location:
        loc: Location = resolved[1]
        if dry_run:
            report.bump(report.updated, "Location")
            return loc
        changed = False
        if label and loc.name != label:
            loc.name = label
            changed = True
        if point and loc.point != point:
            loc.point = point
            changed = True
        if loc.status != IMPORT_STATUS:
            loc.status = IMPORT_STATUS
            changed = True
        if changed:
            loc.save()
            report.bump(report.updated, "Location")
        else:
            report.bump(report.skipped, "Location_unchanged")
        _bind_identity(place_iri, loc, report.sha256, "structures")
        _ensure_identity_cluster(loc, label, ext, dry_run=False)
        return loc

    if dry_run:
        report.bump(report.created, "Location")
        return None

    loc = Location.objects.create(
        name=label or "Unnamed place",
        type=DEFAULT_LOCATION_TYPE,
        current_status=DEFAULT_LOCATION_STATUS,
        description="",
        point=point or "",
        status=IMPORT_STATUS,
        contributor=IMPORT_CONTRIBUTOR,
        title=label,
    )
    _bind_identity(place_iri, loc, report.sha256, "structures")
    _ensure_identity_cluster(loc, label, ext, dry_run=False)
    report.bump(report.created, "Location")
    return loc


def _upsert_structure(
    index: NqIndex,
    subject: str,
    rdf_type: str,
    *,
    dry_run: bool,
    report: ImportReport,
    sources: dict[str, DataSource | None],
) -> ArchitecturalStructure | None:
    _model_name, structure_type = STRUCTURE_TYPE_BY_RDF[rdf_type]
    label = _pick_label(index, subject)
    if not label or len(label.strip()) < 2:
        report.bump(report.skipped, "structure_no_label")
        return None
    label = _truncate(label, 200)
    existence = _existence_status(index, subject)
    place_iri = index.first_iri(subject, CRM_P55)
    location = None
    point = ""
    if place_iri:
        location = _upsert_location(index, place_iri, dry_run=dry_run, report=report)
        wkt = index.first_literal(place_iri, GEO_AS_WKT)
        if wkt:
            point = _parse_wkt_point(wkt.value) or ""

    alt_labels = [
        t.value.strip()
        for t in index.literals(subject, SKOS_ALT_LABEL)
        if t.value.strip() and t.value.strip() != label
    ]
    note_parts = [
        f"DANAM external IRI: {subject}",
        f"batch_sha256: {report.sha256[:16]}…",
    ]
    if alt_labels:
        note_parts.append("altLabels: " + "; ".join(alt_labels[:5]))
    note = "\n".join(note_parts)
    ext = _external_ids_for_subject(index, subject)

    # Prefer wasInfluencedBy / wasDerivedFrom for primary source hint (on note)
    src_iri = index.first_iri(subject, PROV_WAS_INFLUENCED_BY) or index.first_iri(
        subject, PROV_WAS_DERIVED_FROM
    )
    if src_iri and src_iri in sources:
        note += f"\nsource: {src_iri}"

    resolved = _resolve_identity(subject)
    if resolved and resolved[0] is ArchitecturalStructure:
        obj: ArchitecturalStructure = resolved[1]
        if dry_run:
            report.bump(report.updated, "ArchitecturalStructure")
            if len(report.samples) < 8:
                report.samples.append(
                    {
                        "action": "update",
                        "external_iri": subject,
                        "name": label,
                        "structure_type": structure_type,
                        "pk": obj.pk,
                    }
                )
            return obj
        changed_fields: list[str] = []
        if obj.name != label:
            obj.name = label
            changed_fields.append("name")
        if obj.structure_type != structure_type:
            obj.structure_type = structure_type
            changed_fields.append("structure_type")
        if existence and obj.existence_status != existence:
            obj.existence_status = existence
            changed_fields.append("existence_status")
        if point and obj.point != point:
            obj.point = point
            changed_fields.append("point")
        if location and obj.has_current_location_id != location.pk:
            obj.has_current_location = location
            changed_fields.append("has_current_location")
        if obj.status != IMPORT_STATUS:
            obj.status = IMPORT_STATUS
            changed_fields.append("status")
        if obj.contributor != IMPORT_CONTRIBUTOR:
            obj.contributor = IMPORT_CONTRIBUTOR
            changed_fields.append("contributor")
        if note and (not obj.note or subject not in obj.note):
            obj.note = note
            changed_fields.append("note")
        if changed_fields:
            obj.save(update_fields=changed_fields)
            report.bump(report.updated, "ArchitecturalStructure")
        else:
            report.bump(report.skipped, "structure_unchanged")
        _bind_identity(subject, obj, report.sha256, "structures")
        _ensure_identity_cluster(obj, label, ext, dry_run=False)
        return obj

    if dry_run:
        report.bump(report.created, "ArchitecturalStructure")
        if len(report.samples) < 8:
            report.samples.append(
                {
                    "action": "create",
                    "external_iri": subject,
                    "name": label,
                    "structure_type": structure_type,
                    "existence_status": existence,
                    "place_iri": place_iri,
                    "point": point,
                }
            )
        return None

    obj = ArchitecturalStructure.objects.create(
        name=label,
        structure_type=structure_type,
        existence_status=existence,
        point=point or "",
        has_current_location=location,
        note=note,
        status=IMPORT_STATUS,
        contributor=IMPORT_CONTRIBUTOR,
        title=label,
        location_name=_truncate(label, 200),
    )
    _bind_identity(subject, obj, report.sha256, "structures")
    _ensure_identity_cluster(obj, label, ext, dry_run=False)
    report.bump(report.created, "ArchitecturalStructure")
    if len(report.samples) < 8:
        report.samples.append(
            {
                "action": "created",
                "external_iri": subject,
                "name": label,
                "pk": obj.pk,
            }
        )
    return obj


def pass_structures(
    index: NqIndex,
    *,
    dry_run: bool,
    limit: int | None,
    report: ImportReport,
) -> None:
    sources = ensure_corpus_data_sources(dry_run=dry_run, report=report)
    subjects: list[str] = []
    for rdf_type in STRUCTURE_RDF_TYPES:
        subjects.extend(sorted(index.type_subjects.get(rdf_type, ())))
    # Stable order; prefer OSM nodes then Wikidata then other
    subjects = sorted(set(subjects), key=lambda u: (0 if "/osm/" in u else 1 if "/wikidata/" in u else 2, u))
    if limit is not None:
        subjects = subjects[:limit]

    for subject in subjects:
        rdf_type = _structure_rdf_type(index, subject)
        if not rdf_type:
            report.bump(report.skipped, "structure_no_type")
            continue
        try:
            if dry_run:
                _upsert_structure(
                    index, subject, rdf_type, dry_run=True, report=report, sources=sources
                )
            else:
                with transaction.atomic():
                    _upsert_structure(
                        index,
                        subject,
                        rdf_type,
                        dry_run=False,
                        report=report,
                        sources=sources,
                    )
        except Exception as exc:  # noqa: BLE001 — collect per-row failures
            logger.exception("Failed structure %s", subject)
            report.failures.append({"iri": subject, "error": str(exc)[:500]})


def pass_assertions(
    index: NqIndex,
    *,
    dry_run: bool,
    limit: int | None,
    report: ImportReport,
) -> None:
    sources = ensure_corpus_data_sources(dry_run=dry_run, report=report)
    beliefs = sorted(index.type_subjects.get(CRMINF_I2_BELIEF, ()))
    # Prefer beliefs whose assertsAbout already has an L1 row (structures pass).
    resolved_first: list[str] = []
    unresolved: list[str] = []
    for belief_iri in beliefs:
        about = index.first_iri(belief_iri, HG_ASSERTS_ABOUT)
        if about and _resolve_identity(about):
            resolved_first.append(belief_iri)
        else:
            unresolved.append(belief_iri)
    beliefs = resolved_first + unresolved
    if limit is not None:
        beliefs = beliefs[:limit]

    for belief_iri in beliefs:
        about = index.first_iri(belief_iri, HG_ASSERTS_ABOUT)
        if not about:
            report.bump(report.skipped, "belief_no_about")
            continue
        resolved = _resolve_identity(about)
        if not resolved:
            report.bump(report.skipped, "belief_about_unresolved")
            continue
        model, about_obj = resolved
        ct = ContentType.objects.get_for_model(about_obj, for_concrete_model=True)
        score = index.first_literal(belief_iri, HG_CONFIDENCE_SCORE)
        confidence, score_dec = _confidence_from_score(score)
        src_iri = index.first_iri(belief_iri, PROV_WAS_DERIVED_FROM)
        source = sources.get(src_iri) if src_iri else None

        existing_map = LodExternalIdentity.objects.filter(external_iri=belief_iri).first()
        if existing_map and existing_map.content_type.model == "heritageassertion":
            if dry_run:
                report.bump(report.updated, "HeritageAssertion")
                continue
            ha = HeritageAssertion.objects.filter(pk=existing_map.object_id).first()
            if ha:
                ha.confidence = confidence
                if score_dec is not None:
                    ha.confidence_score = score_dec
                if source is not None:
                    ha.source = source
                ha.reconciliation_status = "accepted"
                ha.save()
                report.bump(report.updated, "HeritageAssertion")
                continue

        if dry_run:
            report.bump(report.created, "HeritageAssertion")
            if len(report.samples) < 12:
                report.samples.append(
                    {
                        "action": "create_assertion",
                        "belief_iri": belief_iri,
                        "about": about,
                        "about_model": model.__name__,
                        "confidence": confidence,
                    }
                )
            continue

        try:
            with transaction.atomic():
                ha = HeritageAssertion(
                    content_type=ct,
                    object_id=about_obj.pk,
                    asserted_property="imported.belief",
                    asserted_value=belief_iri,
                    assertion_content=(
                        f"CRMinf I2_Belief from DANAM corpus ({belief_iri})"
                    ),
                    source=source,
                    confidence=confidence,
                    confidence_score=score_dec,
                    reconciliation_status="accepted",
                    contributed_by=IMPORT_CONTRIBUTOR,
                    data_quality_note=f"batch_sha256={report.sha256[:16]}",
                )
                ha.full_clean()
                ha.save()
                _bind_identity(belief_iri, ha, report.sha256, "assertions")
                report.bump(report.created, "HeritageAssertion")
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed assertion %s", belief_iri)
            report.failures.append({"iri": belief_iri, "error": str(exc)[:500]})


def run_import(
    path: Path,
    *,
    pass_name: PassName = "structures",
    dry_run: bool = True,
    limit: int | None = None,
    include_reject_audit: bool = True,
) -> ImportReport:
    index = build_full_index(path)
    report = ImportReport(
        sha256=index.sha256,
        input_path=str(path.resolve()),
        pass_name=pass_name,
        dry_run=dry_run,
        limit=limit,
        quad_count=index.quad_count,
        parse_errors=index.parse_errors,
    )
    try:
        from apps.cidoc_data.danam_import.licenses import LICENSE_MATRIX
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        payload = get_effective_registry_payload() or {}
        report.schema_version = str(payload.get("schema_version") or "")
        report.license_matrix = dict(LICENSE_MATRIX)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not pin schema_version: %s", exc)

    try:
        from django.conf import settings

        from apps.cidoc_data.danam_import.nq import file_sha256 as _sha

        root = Path(settings.BASE_DIR).resolve().parent
        pins: dict[str, str] = {}
        for rel in (
            "ontology/HeritageGraph.yaml",
            "ontology/HeritageGraph.ttl",
            "ontology/heritagegraph-crm-bridge.ttl",
            "ontology/shapes/generated-heritagegraph-minimal-shacl.ttl",
        ):
            p = root / rel
            if p.is_file():
                pins[rel] = _sha(p)
        report.ontology_pin = pins
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not build ontology pin: %s", exc)

    if include_reject_audit and limit is None:
        # Full reject audit is expensive; skip when --limit (dev smoke).
        try:
            from apps.cidoc_data.danam_import.fingerprint import reject_predicate_audit

            report.reject_audit = reject_predicate_audit(path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Reject audit failed: %s", exc)
    elif include_reject_audit:
        report.reject_audit = {
            "skipped": True,
            "reason": "omit full reject audit when --limit is set; run corpus_fingerprint --reject-audit-json",
        }

    if pass_name in ("structures", "all"):
        pass_structures(index, dry_run=dry_run, limit=limit, report=report)
    if pass_name in ("assertions", "all"):
        # Assertions need structures first; limit applies per pass independently
        pass_assertions(index, dry_run=dry_run, limit=limit, report=report)
    return report
