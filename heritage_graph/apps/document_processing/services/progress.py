from __future__ import annotations

import copy
from typing import Any

from ..models import UploadedDocument


def patch_processing_progress(document_id: str, patch: dict[str, Any]) -> None:
    doc = UploadedDocument.objects.only("processing_progress").get(pk=document_id)
    cur = copy.deepcopy(doc.processing_progress or {})
    cur.update(patch)
    doc.processing_progress = cur
    doc.save(update_fields=["processing_progress", "updated_at"])
