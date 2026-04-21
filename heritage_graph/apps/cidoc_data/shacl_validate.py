"""
SHACL validation hook (MR1).

When `pyshacl` and generated shapes are available, call `validate_data_graph`
before persisting RDF projections. Django ORM payloads are validated separately
via JSON Schema (`registry_jsonschema`); this module is for RDF-aligned checks.
"""

from __future__ import annotations

from typing import Any


def validate_shacl_if_enabled(_data_graph: Any, _shapes_graph: Any) -> None:
    """Placeholder: integrate pyshacl when SHACL artifacts are generated from LinkML."""
    try:
        import pyshacl  # noqa: F401
    except ImportError:
        return
