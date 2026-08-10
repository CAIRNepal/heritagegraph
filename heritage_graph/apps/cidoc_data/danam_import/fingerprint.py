"""Corpus + ontology fingerprinting for Nature-grade reproducibility."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apps.cidoc_data.danam_import.constants import (
    CRM_E53_PLACE,
    CRMINF_I2_BELIEF,
    STRUCTURE_RDF_TYPES,
)
from apps.cidoc_data.danam_import.nq import build_full_index, file_sha256, parse_quad_line


@dataclass
class CorpusFingerprint:
    generated_at: str
    nq_path: str
    nq_sha256: str
    nq_bytes: int
    quad_count: int
    parse_errors: int
    type_counts: dict[str, int] = field(default_factory=dict)
    graph_counts: dict[str, int] = field(default_factory=dict)
    ontology_files: dict[str, str] = field(default_factory=dict)
    schema_version: str = ""
    registry_core_hash: str = ""
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def write_json(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(self.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def _sha256_file(path: Path) -> str:
    return file_sha256(path)


def _repo_root(base_dir: Path) -> Path:
    # settings.BASE_DIR is heritage_graph/
    return base_dir.resolve().parent


def fingerprint_corpus(
    nq_path: Path,
    *,
    base_dir: Path | None = None,
) -> CorpusFingerprint:
    """Hash the NQ dump, ontology artifacts, and live LinkML schema_version."""
    nq_path = nq_path.resolve()
    index = build_full_index(nq_path)

    type_counts = {
        t: len(subjects) for t, subjects in sorted(index.type_subjects.items())
    }
    # Highlight research-critical types even if zero
    for required in (
        *STRUCTURE_RDF_TYPES,
        CRM_E53_PLACE,
        CRMINF_I2_BELIEF,
    ):
        type_counts.setdefault(required, 0)

    graph_counts: Counter[str] = Counter()
    with nq_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                q = parse_quad_line(line)
            except ValueError:
                continue
            if q is None:
                continue
            g = q.g.value if q.g and q.g.kind == "iri" else "(default)"
            graph_counts[g] += 1

    ontology_files: dict[str, str] = {}
    notes: list[str] = []
    root = _repo_root(base_dir) if base_dir else nq_path.parents[2]
    for rel in (
        "ontology/HeritageGraph.yaml",
        "ontology/HeritageGraph.ttl",
        "ontology/heritagegraph-crm-bridge.ttl",
        "ontology/shapes/generated-heritagegraph-minimal-shacl.ttl",
        "data/reconcile_crosswalk.json",
    ):
        path = root / rel
        if path.is_file():
            ontology_files[rel] = _sha256_file(path)
        else:
            notes.append(f"missing optional artifact: {rel}")

    schema_version = ""
    core_hash = ""
    try:
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload

        payload = get_effective_registry_payload() or {}
        schema_version = str(payload.get("schema_version") or "")
        core_hash = str(payload.get("core_hash") or schema_version)
    except Exception as exc:  # noqa: BLE001
        notes.append(f"schema_version unavailable: {exc}")

    return CorpusFingerprint(
        generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        nq_path=str(nq_path),
        nq_sha256=index.sha256,
        nq_bytes=nq_path.stat().st_size,
        quad_count=index.quad_count,
        parse_errors=index.parse_errors,
        type_counts={k: type_counts[k] for k in sorted(type_counts, key=lambda x: -type_counts[x])},
        graph_counts=dict(graph_counts.most_common()),
        ontology_files=ontology_files,
        schema_version=schema_version,
        registry_core_hash=core_hash,
        notes=notes,
    )


def reject_predicate_audit(nq_path: Path, *, sample_limit: int = 40) -> dict[str, Any]:
    """Count predicates in the NQ that L1 does not materialize (audit trail)."""
    from apps.cidoc_data.danam_import.licenses import L1_CONSUMED_PREDICATES

    counts: Counter[str] = Counter()
    samples: dict[str, str] = {}
    with nq_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                q = parse_quad_line(line)
            except ValueError:
                continue
            if q is None or q.p.kind != "iri":
                continue
            pred = q.p.value
            if pred in L1_CONSUMED_PREDICATES:
                continue
            counts[pred] += 1
            if pred not in samples and len(samples) < sample_limit:
                samples[pred] = line.strip()[:240]
    return {
        "unmapped_predicate_count": len(counts),
        "unmapped_quad_count": int(sum(counts.values())),
        "predicates": dict(counts.most_common()),
        "samples": samples,
        "note": (
            "Unmapped predicates remain in L0 research graphs; they are not "
            "silently deleted — L1 only materializes L1_CONSUMED_PREDICATES."
        ),
    }
