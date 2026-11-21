from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from ..models import DocumentPage, OCRResult, UploadedDocument


@transaction.atomic
def upsert_page(
    *,
    document: UploadedDocument,
    page_number: int,
    raw_text: str,
    page_confidence: float,
) -> DocumentPage:
    page, _created = DocumentPage.objects.update_or_create(
        document=document,
        page_number=page_number,
        defaults={
            "raw_text": raw_text,
            "confidence": Decimal(str(page_confidence)),
        },
    )
    return page


@transaction.atomic
def append_ocr_result(
    *,
    page: DocumentPage,
    engine: str,
    text: str,
    confidence: float,
    metadata: dict | None = None,
) -> OCRResult:
    return OCRResult.objects.create(
        page=page,
        engine=engine,
        text=text,
        confidence=Decimal(str(confidence)),
        metadata=metadata or {},
    )
