"""N-Triples line formatting for RDF dumps."""

from __future__ import annotations


def format_nt_line(subject: str, predicate: str, obj: str) -> str:
    if obj.startswith("http://") or obj.startswith("https://"):
        return f"<{subject}> <{predicate}> <{obj}> ."
    escaped = obj.replace("\\", "\\\\").replace('"', '\\"')
    return f'<{subject}> <{predicate}> "{escaped}" .'
