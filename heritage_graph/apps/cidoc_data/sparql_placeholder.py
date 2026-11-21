"""
MR3 — SPARQL endpoint placeholder.

Expose a read-only SPARQL service once Oxigraph (or Fuseki) is deployed; keep
Django as system of record and project triples asynchronously.
"""

from __future__ import annotations

# Future: URL patterns under /api/v1/sparql/ proxying to the triplestore.
