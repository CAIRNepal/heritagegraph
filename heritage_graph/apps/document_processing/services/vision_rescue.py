from __future__ import annotations

import base64
import io
import os
import tempfile

import anthropic
from django.core.files import File
from pdf2image import convert_from_path

from ..models import UploadedDocument
from .ocr_settings import get_ocr_settings
from .persistence import append_ocr_result, upsert_page
from .raster_ocr import ocr_pil_image


def _read_api_key() -> str | None:
    return (os.environ.get("ANTHROPIC_API_KEY") or "").strip() or None


def run_vision_rescue(*, document: UploadedDocument, django_file: File) -> str:
    s = get_ocr_settings()
    if document.claude_vision_invocations >= s.max_vision_calls:
        raise RuntimeError("Vision rescue call cap reached for this document.")

    api_key = _read_api_key()
    if not api_key:
        raise RuntimeError("Vision rescue is not configured (missing ANTHROPIC_API_KEY).")

    name = (django_file.name or "upload").lower()
    try:
        django_file.seek(0)
    except Exception:
        pass

    with django_file.open("rb") as f:
        raw = f.read()
    if len(raw) > s.max_file_bytes:
        raise ValueError("File is too large to process (server limit).")

    pil = None
    if name.endswith(".pdf"):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(raw)
            pdf_path = tmp.name
        try:
            pages = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=200, fmt="png")
            if not pages:
                raise RuntimeError("Could not rasterize PDF for vision rescue.")
            pil = pages[0]
        finally:
            try:
                os.remove(pdf_path)
            except OSError:
                pass
    else:
        from PIL import Image

        pil = Image.open(io.BytesIO(raw)).convert("RGB")

    # If Tesseract is available, do a local pass for cheap text to warm-start the model prompt.
    local_text, _local_conf = ocr_pil_image(pil=pil) if pil is not None else ("", 0.0)

    buf = io.BytesIO()
    if pil is None:
        raise RuntimeError("No image available for vision rescue.")
    pil.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1200,
        temperature=0.2,
        system=(
            "You are helping digitize a heritage document image. Transcribe visible text. "
            "If you cannot read it, return an empty string. Do not guess modern names. "
            "Return plain text only."
        ),
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"OCR pre-pass (may be empty):\n{local_text}\n\nTranscribe the page text.",
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64,
                        },
                    },
                ],
            }
        ],
    )
    # Extract text from the first text block
    out = ""
    for block in message.content or []:
        btype = getattr(block, "type", None)
        if btype == "text":
            out += getattr(block, "text", "") or ""
    out = (out or "").strip()

    document.claude_vision_invocations = document.claude_vision_invocations + 1
    document.save(update_fields=["claude_vision_invocations", "updated_at"])

    page_obj = upsert_page(
        document=document, page_number=1, raw_text=out, page_confidence=0.6 if out else 0.1
    )
    append_ocr_result(
        page=page_obj,
        engine="claude_vision",
        text=out,
        confidence=0.75 if out else 0.1,
        metadata={"model": "claude-3-5-sonnet-20241022", "prepass": local_text[:500]},
    )
    return out
