from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass

import pdfplumber
from django.core.files import File

from .ocr_settings import OcrRuntimeSettings, get_ocr_settings


@dataclass(frozen=True)
class ClassificationResult:
    document_type: str
    confidence: float


def _is_pdf_name(name: str) -> bool:
    return name.lower().endswith(".pdf")


def _is_image_name(name: str) -> bool:
    lower = name.lower()
    return lower.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"))


def _pdf_text_ratio(file_path: str, max_pages: int) -> float:
    """
    Return 0..1 based on how much extractable text exists in the first N pages.
    This is a lightweight heuristic, not a perfect 'digital born' detector.
    """
    total_chars = 0
    nonempty_pages = 0
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text() or ""
            t = text.strip()
            if t:
                nonempty_pages += 1
            total_chars += len(t)
    # Normalize: 1 page with lots of text should already push ratio high
    if nonempty_pages == 0:
        return 0.0
    return min(1.0, (nonempty_pages / max(1, min(max_pages, nonempty_pages))) * min(1.0, total_chars / 2000.0))


def classify_media_file(*, django_file: File) -> ClassificationResult:
    s: OcrRuntimeSettings = get_ocr_settings()
    name = (django_file.name or "").lower()
    mime, _ = mimetypes.guess_type(name)
    if django_file:
        # Ensure we read from the beginning; Django File is sometimes already opened.
        try:
            django_file.seek(0)
        except Exception:
            pass

    tmp_path = None
    try:
        with django_file.open("rb") as f:
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(name)[1]) as tmp:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    if not chunk:
                        break
                    tmp.write(chunk)
                tmp_path = tmp.name

        if not tmp_path:
            return ClassificationResult(document_type="image_print", confidence=0.35)

        if _is_pdf_name(name) or (mime and mime == "application/pdf"):
            ratio = _pdf_text_ratio(tmp_path, max_pages=s.max_pages)
            if ratio >= 0.35:
                return ClassificationResult(document_type="pdf_digital", confidence=float(min(1.0, 0.5 + ratio)))
            return ClassificationResult(document_type="pdf_scanned", confidence=float(min(1.0, 0.5 + (1.0 - ratio) * 0.5)))

        if _is_image_name(name) or (mime and mime.startswith("image/")):
            # We cannot reliably distinguish handwriting vs inscription from filename alone; default to print path.
            return ClassificationResult(document_type="image_print", confidence=0.45)

        return ClassificationResult(document_type="image_print", confidence=0.3)
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
