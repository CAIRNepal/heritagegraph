"""Publish schema extension proposals to HERITAGEGRAPH_SCHEMA_EXTENSION_PATH."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import yaml
from apps.heritage_data.services.schema_proposal_keys import extract_conflict_keys
from django.conf import settings
from django.db import transaction
from django.utils import timezone

if TYPE_CHECKING:
    from apps.heritage_data.models import SchemaExtensionProposal
    from django.contrib.auth.models import AbstractUser


def overlapping_active_proposals(*, keys: list[str], exclude_pk) -> bool:
    from apps.heritage_data.models import SchemaExtensionProposal

    if not keys:
        return False
    keyset = set(keys)
    qs = SchemaExtensionProposal.objects.filter(
        status__in=[
            SchemaExtensionProposal.STATUS_SUBMITTED,
            SchemaExtensionProposal.STATUS_APPROVED,
        ]
    ).exclude(pk=exclude_pk)
    for other in qs.iterator():
        other_keys = set(other.conflict_keys or [])
        if other_keys & keyset:
            return True
    return False


def append_audit(
    proposal,
    *,
    actor,
    action: str,
    from_status: str,
    to_status: str,
    comment: str = "",
    schema_version_snapshot: str = "",
) -> None:
    from apps.heritage_data.models import SchemaExtensionAuditEvent

    SchemaExtensionAuditEvent.objects.create(
        proposal=proposal,
        actor=actor,
        action=action,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
        schema_version_snapshot=schema_version_snapshot,
    )


@transaction.atomic
def publish_proposal(proposal: SchemaExtensionProposal, actor: AbstractUser) -> dict:
    from apps.cidoc_data.linkml_loader import (
        build_fresh_payload,
        invalidate_registry_cache,
    )

    raw = getattr(settings, "HERITAGEGRAPH_SCHEMA_EXTENSION_PATH", None) or ""
    if not str(raw).strip():
        raise ValueError(
            "HERITAGEGRAPH_SCHEMA_EXTENSION_PATH is not configured; cannot publish."
        )
    yaml.safe_load(proposal.proposed_yaml)  # validate YAML
    keys = extract_conflict_keys(proposal.proposed_yaml)
    if overlapping_active_proposals(keys=keys, exclude_pk=proposal.pk):
        raise ValueError("Another active proposal overlaps the same schema keys.")

    path = Path(raw).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(proposal.proposed_yaml, encoding="utf-8")
    tmp.replace(path)

    proposal.conflict_keys = keys
    proposal.save(update_fields=["conflict_keys", "updated_at"])

    invalidate_registry_cache()
    payload = build_fresh_payload()
    schema_version = payload.get("schema_version") or ""
    ext_hash = payload.get("extension_hash") or ""

    proposal.status = SchemaExtensionProposal.STATUS_PUBLISHED
    proposal.published_schema_version = schema_version
    proposal.published_extension_hash = ext_hash or ""
    proposal.resolved_at = timezone.now()
    proposal.save(
        update_fields=[
            "status",
            "published_schema_version",
            "published_extension_hash",
            "resolved_at",
            "updated_at",
        ]
    )

    append_audit(
        proposal,
        actor=actor,
        action="published",
        from_status=SchemaExtensionProposal.STATUS_APPROVED,
        to_status=SchemaExtensionProposal.STATUS_PUBLISHED,
        schema_version_snapshot=schema_version,
    )
    return {"schema_version": schema_version, "extension_hash": ext_hash}
