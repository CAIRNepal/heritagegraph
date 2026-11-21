from __future__ import annotations

import csv
import io
from typing import Any


def parse_tabular_file(*, content: bytes, filename: str, max_rows: int = 5000) -> tuple[list[dict[str, Any]], list[str]]:
    """
    Parse CSV or XLSX into row dicts (header -> cell string).

    Returns (rows, validation_messages).
    """
    errors: list[str] = []
    fn = (filename or "").lower()

    if fn.endswith(".csv"):
        return _parse_csv(content, max_rows=max_rows)

    if fn.endswith(".xlsx"):
        try:
            import openpyxl  # type: ignore[import-untyped]
        except ImportError:
            return [], ["Excel parsing requires openpyxl on the server."]
        return _parse_xlsx(content, max_rows=max_rows, errors_out=errors)

    return [], ["Unsupported tabular format. Upload CSV or .xlsx."]


def _parse_csv(content: bytes, *, max_rows: int) -> tuple[list[dict[str, Any]], list[str]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    if reader.fieldnames is None:
        return [], ["CSV has no header row."]
    for i, row in enumerate(reader):
        if i >= max_rows:
            break
        clean = {str(k).strip(): ("" if v is None else str(v).strip()) for k, v in row.items() if k}
        rows.append(clean)
    return rows, []


def _parse_xlsx(
    content: bytes,
    *,
    max_rows: int,
    errors_out: list[str],
) -> tuple[list[dict[str, Any]], list[str]]:
    import openpyxl  # type: ignore[import-untyped]

    wb = openpyxl.load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        wb.close()
        return [], ["Spreadsheet is empty."]
    headers = [("" if c is None else str(c).strip()) for c in header_row]
    if not any(headers):
        wb.close()
        return [], ["Spreadsheet has no headers."]
    out: list[dict[str, Any]] = []
    for i, data_row in enumerate(rows_iter):
        if i >= max_rows:
            break
        cells = list(data_row) + [None] * max(0, len(headers) - len(data_row))
        row_dict = {}
        for h, cell in zip(headers, cells[: len(headers)]):
            if not h:
                continue
            row_dict[h] = "" if cell is None else str(cell).strip()
        if any(v for v in row_dict.values()):
            out.append(row_dict)
    wb.close()
    return out, errors_out
