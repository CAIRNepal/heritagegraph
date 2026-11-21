"""DANAM corpus L1 materializer (N-Quads → Postgres CIDOC).

See ``documentation/research/DANAM_CORPUS_INTEGRATION_REPORT.md``.
"""

from .materialize import ImportReport, run_import

__all__ = ["ImportReport", "run_import"]
