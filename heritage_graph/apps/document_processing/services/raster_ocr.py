from __future__ import annotations

import os
import tempfile
from io import BytesIO

import pytesseract
from django.core.files import File
from pdf2image import convert_from_path, pdfinfo_from_path
from PIL import Image

from ..models import UploadedDocument
from .ocr_settings import get_ocr_settings
from .persistence import append_ocr_result, upsert_page


def _blocks_from_tesseract_data(data: dict) -> list[dict]:
    """Merge Tesseract word boxes into line-level blocks (pixel bbox in raster space)."""
    texts = data.get("text") or []
    n = len(texts)
    if n == 0:
        return []

    line_groups: dict[tuple[int, int, int], list[int]] = {}
    for i in range(n):
        word = (texts[i] or "").strip()
        if not word:
            continue
        try:
            bn = int(data["block_num"][i])
            pn = int(data["par_num"][i])
            ln = int(data["line_num"][i])
        except (KeyError, IndexError, TypeError, ValueError):
            continue
        line_groups.setdefault((bn, pn, ln), []).append(i)

    blocks: list[dict] = []
    for _key in sorted(line_groups.keys()):
        indices = line_groups[_key]
        parts: list[str] = []
        xs1: list[float] = []
        ys1: list[float] = []
        xs2: list[float] = []
        ys2: list[float] = []
        confs: list[float] = []
        for i in indices:
            word = (texts[i] or "").strip()
            if not word:
                continue
            parts.append(word)
            try:
                left = float(data["left"][i])
                top = float(data["top"][i])
                w = float(data["width"][i])
                h = float(data["height"][i])
                raw_c = data["conf"][i]
                if raw_c in (-1, "-1", "", None):
                    continue
                cf = float(raw_c) / 100.0
                if cf >= 0:
                    confs.append(min(1.0, max(0.0, cf)))
            except (KeyError, IndexError, TypeError, ValueError):
                continue
            xs1.append(left)
            ys1.append(top)
            xs2.append(left + w)
            ys2.append(top + h)
        if not parts or not xs1:
            continue
        text_line = " ".join(parts)
        bbox = [min(xs1), min(ys1), max(xs2), max(ys2)]
        line_conf = sum(confs) / max(1, len(confs)) if confs else 0.35
        blocks.append(
            {
                "text": text_line,
                "bbox": bbox,
                "confidence": float(min(1.0, max(0.0, line_conf))),
            }
        )
    return blocks


def _set_tesseract_cmd() -> None:
    s = get_ocr_settings()
    if s.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = s.tesseract_cmd


def ocr_pil_image(*, pil: Image.Image) -> tuple[str, float, list[dict]]:
    """
    Run Tesseract on a PIL image.

    Returns (plain_text, mean_confidence, blocks) where each block is
    {text, bbox: [x1,y1,x2,y2], confidence} in image pixel coordinates.
    """
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
            blocks = _blocks_from_tesseract_data(data)
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
                    return (
                        text.strip(),
                        float(min(1.0, max(conf, 0.1))),
                        blocks,
                    )
            else:
                return text.strip(), float(min(1.0, max(conf, 0.0))), blocks
        except pytesseract.TesseractNotFoundError as exc:
            last_err = exc
            break
        except Exception as exc:  # noqa: BLE001 - OCR engines are best-effort here
            last_err = exc
            continue
    if last_err:
        raise last_err
    return "", 0.0, []


def image_bytes_to_text(*, data: bytes) -> tuple[str, float, list[dict]]:
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
            info = pdfinfo_from_path(pdf_path)
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
            text, conf, blocks = ocr_pil_image(pil=pil)
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
                metadata={
                    "source": source_label,
                    "page": i,
                    "blocks": blocks,
                    "image_width": pil.width,
                    "image_height": pil.height,
                },
            )
        return "\n\n".join([t for t in all_text if t.strip()])

    pil_single = Image.open(BytesIO(raw)).convert("RGB")
    text, conf, blocks = ocr_pil_image(pil=pil_single)
    page_obj = upsert_page(
        document=document, page_number=1, raw_text=text, page_confidence=conf
    )
    append_ocr_result(
        page=page_obj,
        engine="tesseract",
        text=text,
        confidence=conf,
        metadata={
            "source": source_label,
            "image": name,
            "blocks": blocks,
            "image_width": pil_single.width,
            "image_height": pil_single.height,
        },
    )
    return text
