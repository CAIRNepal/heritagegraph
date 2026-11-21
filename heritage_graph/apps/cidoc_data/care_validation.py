"""CARE / Traditional Knowledge label validation for metadata fields."""

from __future__ import annotations

# Known TK Label URI prefixes (Local Contexts). Extend as partnerships grow.
TK_LABEL_URI_PREFIXES = (
    "https://localcontexts.org/labels/",
    "http://localcontexts.org/labels/",
)

ACCESS_TIER_SENSITIVE = "sensitive_indigenous"


def validate_care_labels(labels: list | None) -> list[str]:
    """Return error messages for invalid care_labels entries."""
    if not labels:
        return []
    if not isinstance(labels, list):
        return ["care_labels must be a JSON array of label URI strings."]
    errors: list[str] = []
    for item in labels:
        s = str(item).strip()
        if not s:
            errors.append("care_labels entries must be non-empty strings.")
            continue
        if not s.startswith("http"):
            errors.append(f"care_labels entry must be a URI: {s!r}")
            continue
        if not any(s.startswith(p) for p in TK_LABEL_URI_PREFIXES):
            errors.append(
                f"care_labels URI should use a known TK Label namespace: {s}"
            )
    return errors


def validate_access_tier_for_publication(access_tier: str) -> bool:
    """Sensitive indigenous tier must not be exported to public LOD dumps."""
    return (access_tier or "public") != ACCESS_TIER_SENSITIVE
