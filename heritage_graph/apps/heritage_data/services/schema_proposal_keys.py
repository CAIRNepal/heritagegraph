"""Extract collision keys from proposal YAML for overlap checks."""

from __future__ import annotations

import yaml


def extract_conflict_keys(yaml_text: str) -> list[str]:
    if not (yaml_text or "").strip():
        return []
    try:
        doc = yaml.safe_load(yaml_text)
    except yaml.YAMLError:
        return []
    if not isinstance(doc, dict):
        return []
    keys: list[str] = []
    if isinstance(doc.get("classes"), dict):
        for cname, body in doc["classes"].items():
            keys.append(f"class:{cname}")
            if isinstance(body, dict):
                for slot in body.get("slots") or []:
                    keys.append(f"slot:{cname}.{slot}")
                attrs = body.get("attributes")
                if isinstance(attrs, dict):
                    for an in attrs:
                        keys.append(f"attr:{cname}.{an}")
    if isinstance(doc.get("enums"), dict):
        for en in doc["enums"]:
            keys.append(f"enum:{en}")
    return sorted(set(keys))
