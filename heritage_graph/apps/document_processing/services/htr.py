from __future__ import annotations

from django.core.files import File

from ..models import UploadedDocument
from .raster_ocr import extract_raster_ocr


def extract_handwritten(
    *, document: UploadedDocument, django_file: File
) -> str:
    """
    v1: Handwriting is routed through the same Tesseract path as other raster OCR.

    TrOCR and model-heavy paths remain optional/behind the OCR worker build.
    """
    return extract_raster_ocr(
        document=document, django_file=django_file, source_label="htr_v1_raster"
    )
