"""Named graph partitions for the HeritageGraph knowledge graph."""

from __future__ import annotations

from enum import Enum

from django.conf import settings


class GraphPartition(str, Enum):
    """Logical graph layers in Oxigraph."""

    PUBLIC = "public"
    SCHEMA = "schema"
    DOCUMENT = "document"
    PROVENANCE = "prov"
    ASSERTION = "assertion"
    SNAPSHOT = "snapshot"
    INFERRED = "inferred"
    INGEST = "ingest"
    # External bulk imports (e.g. Yale LUX) — link via skos:exactMatch, never merge into PUBLIC.
    IMPORTED = "imported"
    ALIGNMENT = "alignment"

    def uri(self, *, suffix: str = "") -> str | None:
        """Resolve the named graph IRI for this partition."""
        if self is GraphPartition.PUBLIC:
            raw = getattr(settings, "RDF_PUBLIC_GRAPH_URI", None)
            if raw is None:
                return "https://w3id.org/heritagegraph/graph/public"
            text = str(raw).strip()
            return text or None

        if self is GraphPartition.SCHEMA:
            return str(
                getattr(
                    settings,
                    "RDF_SCHEMA_GRAPH_URI",
                    "https://w3id.org/heritagegraph/graph/schema",
                )
            ).strip() or None

        if self is GraphPartition.DOCUMENT:
            base = str(
                getattr(
                    settings,
                    "RDF_DOCUMENT_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/graph/document/",
                )
            ).rstrip("/")
            if not suffix:
                return base
            return f"{base}/{suffix}"

        if self is GraphPartition.PROVENANCE:
            base = str(
                getattr(
                    settings,
                    "RDF_PROVENANCE_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/graph/prov/",
                )
            ).rstrip("/")
            if not suffix:
                return base
            return f"{base}/{suffix}"

        if self is GraphPartition.ASSERTION:
            base = str(
                getattr(
                    settings,
                    "RDF_ASSERTION_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/graph/assertion/",
                )
            ).rstrip("/")
            if not suffix:
                return base
            return f"{base}/{suffix}"

        if self is GraphPartition.SNAPSHOT:
            base = str(
                getattr(
                    settings,
                    "RDF_SNAPSHOT_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/graph/snapshot/",
                )
            ).rstrip("/")
            if not suffix:
                return base
            return f"{base}/{suffix}"

        if self is GraphPartition.INFERRED:
            return str(
                getattr(
                    settings,
                    "RDF_INFERRED_GRAPH_URI",
                    "https://w3id.org/heritagegraph/graph/inferred",
                )
            ).strip() or None

        if self is GraphPartition.INGEST:
            return str(
                getattr(
                    settings,
                    "RDF_INGEST_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/graph/ingest/",
                )
            ).rstrip("/") + (f"/{suffix}" if suffix else "")

        if self is GraphPartition.IMPORTED:
            base = str(
                getattr(
                    settings,
                    "RDF_IMPORTED_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/imported/",
                )
            ).rstrip("/")
            if not suffix:
                return base
            return f"{base}/{suffix}"

        if self is GraphPartition.ALIGNMENT:
            base = str(
                getattr(
                    settings,
                    "RDF_ALIGNMENT_GRAPH_BASE_URI",
                    "https://w3id.org/heritagegraph/alignment/",
                )
            ).rstrip("/")
            if not suffix:
                return base
            return f"{base}/{suffix}"

        return None
