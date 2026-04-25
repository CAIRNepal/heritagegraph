"""Human-readable summary of a schema extension YAML fragment."""

from __future__ import annotations

from typing import Any

import yaml


def summarize_proposal_yaml(yaml_text: str) -> dict[str, Any]:
    if not (yaml_text or "").strip():
        return {"classes": [], "enums": [], "notes": "empty"}
    try:
        doc = yaml.safe_load(yaml_text)
    except yaml.YAMLError as exc:
        return {"error": "invalid_yaml", "detail": str(exc)}

    if not isinstance(doc, dict):
        return {"notes": "root_not_mapping", "raw_type": type(doc).__name__}

    classes = []
    enums = []
    if isinstance(doc.get("classes"), dict):
        for name, body in doc["classes"].items():
            slots = []
            if isinstance(body, dict) and isinstance(body.get("slots"), list):
                slots = body["slots"]
            elif isinstance(body, dict) and isinstance(body.get("attributes"), dict):
                slots = list(body["attributes"].keys())
            classes.append({"name": str(name), "slots": slots})
    if isinstance(doc.get("enums"), dict):
        for name, body in doc["enums"].items():
            vals = []
            if isinstance(body, dict) and isinstance(
                body.get("permissible_values"), dict
            ):
                vals = list(body["permissible_values"].keys())
            enums.append({"name": str(name), "values_sample": vals[:12]})

    return {
        "classes": classes[:50],
        "enums": enums[:50],
        "top_level_keys": sorted(doc.keys()),
    }
