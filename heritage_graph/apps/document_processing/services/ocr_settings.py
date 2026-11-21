from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class OcrRuntimeSettings:
    enabled: bool
    confidence_threshold: float
    max_pages: int
    max_file_bytes: int
    max_vision_calls: int
    max_runs_per_project_per_day: int
    tesseract_cmd: str | None


def get_ocr_settings() -> OcrRuntimeSettings:
    return OcrRuntimeSettings(
        enabled=bool(getattr(settings, "OCR_ENABLED", True)),
        confidence_threshold=float(getattr(settings, "OCR_CONFIDENCE_THRESHOLD", 0.6)),
        max_pages=int(getattr(settings, "OCR_MAX_PAGES_PER_DOCUMENT", 100)),
        max_file_bytes=int(getattr(settings, "OCR_MAX_FILE_BYTES", 25 * 1024 * 1024)),
        max_vision_calls=int(getattr(settings, "OCR_CLAUDE_VISION_MAX_CALLS_PER_DOCUMENT", 1)),
        max_runs_per_project_per_day=int(
            getattr(settings, "OCR_MAX_RUNS_PER_PROJECT_PER_DAY", 10)
        ),
        tesseract_cmd=(getattr(settings, "TESSERACT_PATH", None) or None),
    )
