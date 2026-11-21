"""Celery tasks for contributor ``Project`` workspaces."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def suggest_entities_from_project_asset(asset_id: str) -> None:
    """
    OCR-complete hook for ontology linkage candidates.

    Wired for future NER → ontology alignment; persists an empty hint list until wired.
    """
    from django.db import transaction

    from .models import ProjectAsset

    try:
        ProjectAsset.objects.get(pk=asset_id)
    except ProjectAsset.DoesNotExist:
        return

    try:
        with transaction.atomic():
            ProjectAsset.objects.filter(pk=asset_id).update(entity_suggestions=[])
    except Exception as exc:
        logger.warning("Could not persist entity suggestions for asset %s: %s", asset_id, exc)
