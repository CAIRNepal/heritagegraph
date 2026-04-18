from __future__ import annotations

import os
import tempfile

import pdfplumber
from django.core.files import File

from ..models import UploadedDocument
from .ocr_settings import get_ocr_settings
from .persistence import append_ocr_result, upsert_page


def extract_pdf_digital(*, document: UploadedDocument, django_file: File) -> str:
    s = get_ocr_settings()
    name = django_file.name or "upload.pdf"
    try:
        django_file.seek(0)
    except Exception:
        pass

    text_parts: list[str] = []
    with django_file.open("rb") as f, tempfile.NamedTemporaryFile(
        delete=False, suffix=os.path.splitext(name)[1]
    ) as tmp:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            if not chunk:
                break
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        with pdfplumber.open(tmp_path) as pdf:
            for i, page in enumerate(pdf.pages[: s.max_pages], start=1):
                t = (page.extract_text() or "").strip()
                text_parts.append(t)
                page_obj = upsert_page(
                    document=document,
                    page_number=i,
                    raw_text=t,
                    page_confidence=0.95 if t else 0.0,
                )
                append_ocr_result(
                    page=page_obj,
                    engine="pdfplumber",
                    text=t,
                    confidence=0.95 if t else 0.0,
                    metadata={"page": i, "method": "pdfplumber_text"},
                )
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    return "\n\n".join([p for p in text_parts if p])
