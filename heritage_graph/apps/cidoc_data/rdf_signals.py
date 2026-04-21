"""
RDF / triplestore projection hooks (MR3).

Wire Celery tasks here when Oxigraph or another store is enabled.
"""

from __future__ import annotations

from django.conf import settings


def rdf_sync_enabled() -> bool:
    return bool(getattr(settings, "RDF_SYNC_ENABLED", False))


def queue_entity_projection(*_args: object, **_kwargs: object) -> None:
    """Enqueue async RDF materialization (stub)."""
    if not rdf_sync_enabled():
        return
