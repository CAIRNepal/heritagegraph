"""Transactional outbox for failed knowledge graph writes."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def triples_to_payload(triples: list[Any]) -> list[dict]:
    out: list[dict] = []
    for t in triples:
        row = {"subj": t.subj, "pred": t.pred, "obj_uri": t.obj_uri}
        if t.literal:
            row["literal"] = list(t.literal)
        out.append(row)
    return out


def payload_to_triples(payload: list[dict]) -> list[Any]:
    from apps.cidoc_data.rdf_entity_projection import _Triple

    triples: list[_Triple] = []
    for row in payload:
        lit = row.get("literal")
        triples.append(
            _Triple(
                row["subj"],
                row["pred"],
                row.get("obj_uri"),
                tuple(lit) if lit else None,
            )
        )
    return triples


def enqueue_replace_slot(
    *,
    subject_uri: str,
    graph_uri: str | None,
    managed_predicate_iris: set[str],
    triples: list[Any],
    error: str,
) -> None:
    if not _outbox_enabled():
        return
    try:
        from apps.graph.models import RDFSyncOutbox

        RDFSyncOutbox.objects.create(
            subject_uri=subject_uri[:512],
            operation=RDFSyncOutbox.Operation.REPLACE_SLOT,
            graph_uri=(graph_uri or "")[:512],
            payload={
                "managed": sorted(managed_predicate_iris),
                "triples": triples_to_payload(triples),
            },
            last_error=(error or "")[:8000],
        )
    except Exception:
        logger.exception("Failed to enqueue RDF sync outbox row")


def enqueue_delete_subject(*, subject_uri: str, graph_uri: str | None, error: str) -> None:
    if not _outbox_enabled():
        return
    try:
        from apps.graph.models import RDFSyncOutbox

        RDFSyncOutbox.objects.create(
            subject_uri=subject_uri[:512],
            operation=RDFSyncOutbox.Operation.DELETE_SUBJECT,
            graph_uri=(graph_uri or "")[:512],
            payload={},
            last_error=(error or "")[:8000],
        )
    except Exception:
        logger.exception("Failed to enqueue RDF DELETE outbox row")


def enqueue_insert_nt(*, graph_uri: str | None, ntriples: str, error: str) -> None:
    if not _outbox_enabled():
        return
    try:
        from apps.graph.models import RDFSyncOutbox

        RDFSyncOutbox.objects.create(
            subject_uri="",
            operation=RDFSyncOutbox.Operation.INSERT_NT,
            graph_uri=(graph_uri or "")[:512],
            payload={"ntriples": ntriples},
            last_error=(error or "")[:8000],
        )
    except Exception:
        logger.exception("Failed to enqueue RDF INSERT_NT outbox row")


def drain_pending(*, limit: int = 100) -> tuple[int, int]:
    """Retry outbox rows. Returns (success_count, failure_count)."""
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.models import RDFSyncOutbox

    ok = 0
    failed = 0
    engine = get_kg_engine()
    qs = RDFSyncOutbox.objects.filter(processed_at__isnull=True).order_by("created_at")[
        :limit
    ]
    for row in qs:
        row.attempts += 1
        try:
            success = _process_row(engine, row)
        except Exception as exc:
            row.last_error = str(exc)[:8000]
            row.save(update_fields=["attempts", "last_error"])
            failed += 1
            continue
        if success:
            from django.utils import timezone

            row.processed_at = timezone.now()
            row.save(update_fields=["attempts", "processed_at", "last_error"])
            ok += 1
        else:
            row.save(update_fields=["attempts", "last_error"])
            failed += 1
    return ok, failed


def _process_row(engine, row) -> bool:
    from apps.graph.kg_engine.engine import KnowledgeGraphEngine

    assert isinstance(engine, KnowledgeGraphEngine)
    if row.operation == row.Operation.REPLACE_SLOT:
        triples = payload_to_triples(row.payload.get("triples") or [])
        managed = set(row.payload.get("managed") or [])
        graph = row.graph_uri or None
        return engine._store_replace(
            subject_uri=row.subject_uri,
            triples=triples,
            managed_predicate_iris=managed,
            graph_uri=graph or None,
            skip_shacl=True,
        )
    if row.operation == row.Operation.INSERT_NT:
        return engine.store.insert_ntriples(
            row.payload.get("ntriples") or "",
            graph_uri=row.graph_uri or None,
        )
    if row.operation == row.Operation.DELETE_SUBJECT:
        return engine.store.delete_subject(
            subject_uri=row.subject_uri,
            graph_uri=row.graph_uri or None,
        )
    return False


def _outbox_enabled() -> bool:
    from django.conf import settings

    return bool(getattr(settings, "RDF_KG_OUTBOX_ENABLED", True))
