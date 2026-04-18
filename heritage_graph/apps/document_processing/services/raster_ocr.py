from __future__ import annotations

import os
import tempfile
from io import BytesIO

from django.core.files import File
from PIL import Image
from pdf2image import convert_from_path, pdfinfo_from_path
import pytesseract

from ..models import UploadedDocument
from .ocr_settings import get_ocr_settings
from .persistence import append_ocr_result, upsert_page


def _set_tesseract_cmd() -> None:
    s = get_ocr_settings()
    if s.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = s.tesseract_cmd


def ocr_pil_image(*, pil: Image.Image) -> tuple[str, float]:
    _set_tesseract_cmd()
    s = get_ocr_settings()
    # Try Devanagari + English first, fall back to eng only if languages missing.
    configs = [
        ("deva+eng", "--oem 1 --psm 3 -l deva+eng"),
        ("eng", "--oem 1 --psm 3 -l eng"),
    ]
    last_err: Exception | None = None
    for _label, cfg in configs:
        try:
            text = pytesseract.image_to_string(pil, config=cfg) or ""
            # Confidence is an average of word confidences; may be 0 in some edge cases
            data = pytesseract.image_to_data(
                pil, config=cfg, output_type=pytesseract.Output.DICT
            )
            confs: list[float] = []
            for c in data.get("conf", []) or []:
                try:
                    if c in (-1, "-1", ""):
                        continue
                    f = float(c)
                    if f >= 0:
                        confs.append(f / 100.0)
                except Exception:
                    continue
            conf = sum(confs) / max(1, len(confs)) if confs else 0.35
            if conf < s.confidence_threshold:
                # not confident enough, try next
                if text.strip():
                    return text.strip(), float(min(1.0, max(conf, 0.1)))
            else:
                return text.strip(), float(min(1.0, max(conf, 0.0)))
        except pytesseract.TesseractNotFoundError as exc:
            last_err = exc
            break
        except Exception as exc:  # noqa: BLE001 - OCR engines are best-effort here
            last_err = exc
            continue
    if last_err:
        raise last_err
    return "", 0.0


def image_bytes_to_text(*, data: bytes) -> tuple[str, float]:
    pil = Image.open(BytesIO(data)).convert("RGB")
    return ocr_pil_image(pil=pil)


def extract_raster_ocr(
    *, document: UploadedDocument, django_file: File, source_label: str
) -> str:
    s = get_ocr_settings()
    name = (django_file.name or "").lower()
    try:
        django_file.seek(0)
    except Exception:
        pass

    with django_file.open("rb") as f:
        raw = f.read()
    if len(raw) > s.max_file_bytes:
        raise ValueError("File is too large to process (server limit).")

    if name.endswith(".pdf"):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(raw)
            pdf_path = tmp.name
        try:
            info = pdfinfo_from_path(pdf_path, user_pw=None, use_poppler=True)
            page_count = int(info.get("Pages", 0) or 0) or 1
            if page_count > s.max_pages:
                raise ValueError("PDF has too many pages to process (server limit).")
            # Render pages; dpi impacts speed/quality
            pages = convert_from_path(
                pdf_path,
                first_page=1,
                last_page=s.max_pages,
                dpi=200,
                fmt="png",
            )
        finally:
            try:
                os.remove(pdf_path)
            except OSError:
                pass

        all_text: list[str] = []
        for i, pil in enumerate(pages, start=1):
            text, conf = ocr_pil_image(pil=pil)
            all_text.append(text)
            page_obj = upsert_page(
                document=document,
                page_number=i,
                raw_text=text,
                page_confidence=conf,
            )
            append_ocr_result(
                page=page_obj,
                engine="tesseract",
                text=text,
                confidence=conf,
                metadata={"source": source_label, "page": i},
            )
        return "\n\n".join([t for t in all_text if t.strip()])

    text, conf = image_bytes_to_text(data=raw)
    page_obj = upsert_page(
        document=document, page_number=1, raw_text=text, page_confidence=conf
    )
    append_ocr_result(
        page=page_obj,
        engine="tesseract",
        text=text,
        confidence=conf,
        metadata={"source": source_label, "image": name},
    )
    return text
