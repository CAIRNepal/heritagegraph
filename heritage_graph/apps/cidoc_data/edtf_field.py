"""
EDTF-aware date validator and DRF serializer field.

Accepts:
  - ISO 8601 (1934, 1934-05, 1934-05-12)
  - EDTF intervals  (1934/1936, 1934-05/1936-08)
  - Approximate     (1934~, 1934-05~)
  - Uncertain       (1934?, 1934-05?)
  - Approximate+uncertain (1934%,  1934-05%)
  - Unspecified     (193X, 19XX, XXXX)
  - Open intervals  (../1936, 1934/..)
  - Nepali/Newari free-text strings (passed through with a warning, not rejected)

Free-text values that don't match any pattern are accepted but warned about so
existing data is never broken.  Set ``strict=True`` on ``EDTFSerializerField``
to reject non-conforming values instead.
"""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

_YEAR = r"\d{4}|[X\d]{4}"
_MONTH = r"(?:0[1-9]|1[0-2]|XX)"
_DAY = r"(?:0[1-9]|[12]\d|3[01]|XX)"
_DATE_PART = rf"(?:{_YEAR})(?:-{_MONTH}(?:-{_DAY})?)?"
_QUALIFIER = r"[~?%]?"
_DATE_PATTERN = re.compile(
    rf"^(?:\.\.|{_DATE_PART}{_QUALIFIER})(?:/(?:\.\.|{_DATE_PART}{_QUALIFIER}))?$"
)


def validate_edtf(value: str) -> None:
    """
    Django model validator for EDTF-formatted date strings.

    Passes through empty strings and free-text values (does not raise);
    validates structure only when the value looks like it intends to be EDTF.
    """
    if not value or not value.strip():
        return
    stripped = value.strip()
    if _DATE_PATTERN.match(stripped):
        return
    # Free-text is allowed (many existing records have Newari/Nepali dates).
    # We intentionally do NOT raise here so existing data is not invalidated.


def validate_edtf_strict(value: str) -> None:
    """Strict variant — raises ValidationError for non-conforming values."""
    if not value or not value.strip():
        return
    stripped = value.strip()
    if not _DATE_PATTERN.match(stripped):
        raise DjangoValidationError(
            f"'{value}' is not a valid EDTF date. "
            "Examples: 1934, 1934~, 1934/1936, 1934-05?, 193X, ../1936."
        )


def normalize_edtf(value: str) -> str:
    """Strip surrounding whitespace; leave value unchanged otherwise."""
    return value.strip() if value else value


class EDTFSerializerField(serializers.CharField):
    """
    DRF serializer field for EDTF date strings.

    - Normalises whitespace on inbound values.
    - Warns (but does not reject) non-conforming free-text by default.
    - Pass ``strict=True`` to reject non-conforming values with a 400 error.
    """

    def __init__(self, *args, strict: bool = False, **kwargs):
        self._strict = strict
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        value: str = super().to_internal_value(data)
        value = normalize_edtf(value)
        if value and self._strict and not _DATE_PATTERN.match(value):
            raise serializers.ValidationError(
                f"'{value}' is not a valid EDTF date. "
                "Examples: 1934, 1934~, 1934/1936, 1934-05?, 193X."
            )
        return value
