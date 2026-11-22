# ruff: noqa: E501 -- the README template holds Markdown table rows, which cannot wrap.
"""Assemble a versioned dataset deposit (for Zenodo) from the published graph.

The deposit is everything a reader needs to check a paper's figures without the
running platform:

    data/heritagegraph-public.nq        published records and links (graph/public)
    data/heritagegraph-beliefs.nq       per-assertion belief + provenance graphs
    ontology/                           LinkML, OWL, CRM bridge, SHACL shapes
    reports/provenance-audit.json       audit_provenance measurement
    reports/shacl-conformance.json      shacl_conformance summary (+ full .ttl)
    reports/kg-quality.json             kg_quality_report
    reports/competency-queries.json     run_competency_queries
    manifest.json                       version, commit, counts, SHA-256 per file
    SHA256SUMS                          the same checksums, for `shasum -c`
    README.md, LICENSE-DATA, zenodo.json

RDF is written by the triplestore's own serialiser (pyoxigraph locally, the
Graph Store endpoint remotely), so datatypes, language tags and escaping are
exact. Only graph/public and the belief graphs are included: non-public CARE
tiers never enter graph/public, so they are not in the deposit either.

``--check DIR`` re-verifies a built deposit's checksums.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from datetime import date
from pathlib import Path

from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.rdf_serialize import dump_graph_ntriples, ntriples_to_nquads
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

REPO_ROOT = Path(settings.BASE_DIR).parent
ONTOLOGY_FILES = (
    "ontology/HeritageGraph.yaml",
    "ontology/HeritageGraph.ttl",
    "ontology/heritagegraph-crm-bridge.ttl",
    "ontology/shapes/generated-heritagegraph-minimal-shacl.ttl",
)


def _graphs_under(base: str) -> list[str]:
    rows = get_kg_engine().store.select(
        "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } } ORDER BY ?g"
    )
    return [r["g"] for r in rows if r.get("g", "").startswith(base)]


def _dump_nquads(graph_uris: list[str]) -> bytes:
    """Exact N-Quads for the given named graphs, from the store's serialiser."""
    return b"".join(ntriples_to_nquads(dump_graph_ntriples(g), g) for g in graph_uris)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _git_commit() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=no"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        return out.stdout.strip() + ("-dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return None


def _ontology_version() -> str | None:
    for line in (REPO_ROOT / "ontology/HeritageGraph.yaml").read_text().splitlines():
        if line.startswith("version:"):
            return line.split(":", 1)[1].strip()
    return None


README = """# HeritageGraph dataset, version {version}

A snapshot of the HeritageGraph knowledge graph of Nepalese cultural heritage,
built on {generated} from commit `{commit}` with ontology version {ontology}.

## Contents

| File | What it is |
| --- | --- |
| `data/heritagegraph-public.nq` | Published records and their links (named graph `{public_graph}`): {public_triples} quads |
| `data/heritagegraph-beliefs.nq` | One belief graph and one provenance graph per accepted assertion (CRMinf I2 Belief, PROV-O): {belief_triples} quads in {belief_graphs} graphs |
| `ontology/` | The LinkML schema, OWL TBox, CIDOC-CRM alignment and generated SHACL shapes |
| `reports/` | Provenance audit, SHACL conformance, quality metrics and competency-question results for this snapshot |
| `manifest.json`, `SHA256SUMS` | Checksums of every file (`shasum -a 256 -c SHA256SUMS`) |

## What is and is not included

- Only records that passed review and name a source are published; at build
  time {records_sourced} of {records_published} published records cite one, and
  {claims_sourced} of {claims} accepted claims cite a registered source.
- Records with a non-public CARE access tier never enter the public graph and
  are not in this deposit.
- Every link carries its source and the confidence its contributor stated, in
  the belief and provenance graphs.
- Images are not included: records reference Wikimedia Commons files by URL,
  with the licence and author each file page states.

## Licences

- HeritageGraph contributions and this compilation: CC BY 4.0 (`LICENSE-DATA`).
- Records imported from Wikidata: CC0 1.0; each cites its Wikidata item and revision.
- Ontology: CC BY 4.0. Software (separate deposit): MIT.

## Reproducing the reports

From the HeritageGraph repository at the commit above:

    manage.py audit_provenance --json
    manage.py shacl_conformance --output-dir reports/
    manage.py run_competency_queries --output reports/competency-queries.json
    manage.py kg_quality_report
"""


class Command(BaseCommand):
    help = "Assemble a versioned dataset deposit from the published graph."

    def add_arguments(self, parser):
        parser.add_argument("--output-dir", type=Path, help="Directory to create.")
        parser.add_argument("--dataset-version", help="Dataset version, e.g. 1.0.0.")
        parser.add_argument(
            "--check", type=Path, help="Verify an existing deposit's checksums."
        )

    def handle(self, *args, **opts):
        if opts["check"]:
            return self._check(opts["check"])
        out, version = opts["output_dir"], opts["dataset_version"]
        if not out or not version:
            raise CommandError("--output-dir and --dataset-version are required")
        if out.exists() and any(out.iterdir()):
            raise CommandError(f"{out} is not empty")
        (out / "data").mkdir(parents=True, exist_ok=True)
        (out / "reports").mkdir()
        (out / "ontology").mkdir()

        public_graph = GraphPartition.PUBLIC.uri()
        belief_graphs = _graphs_under(GraphPartition.ASSERTION.uri()) + _graphs_under(
            GraphPartition.PROVENANCE.uri()
        )
        public = _dump_nquads([public_graph])
        beliefs = _dump_nquads(belief_graphs)
        (out / "data/heritagegraph-public.nq").write_bytes(public)
        (out / "data/heritagegraph-beliefs.nq").write_bytes(beliefs)

        for rel in ONTOLOGY_FILES:
            shutil.copy2(REPO_ROOT / rel, out / "ontology" / Path(rel).name)
        shutil.copy2(REPO_ROOT / "LICENSE-DATA", out / "LICENSE-DATA")

        from apps.cidoc_data.management.commands.audit_provenance import measure
        from apps.graph.kg_engine.quality import build_quality_report
        from apps.graph.management.commands.shacl_conformance import run as shacl_run

        audit = measure()
        shacl, shacl_ttl = shacl_run()
        quality = build_quality_report(get_kg_engine())
        (out / "reports/provenance-audit.json").write_text(
            json.dumps(audit, indent=2) + "\n"
        )
        (out / "reports/shacl-conformance.json").write_text(
            json.dumps(shacl, indent=2) + "\n"
        )
        (out / "reports/shacl-conformance-report.ttl").write_text(shacl_ttl)
        (out / "reports/kg-quality.json").write_text(
            json.dumps(quality, indent=2, default=str) + "\n"
        )
        from apps.graph.management.commands.run_competency_queries import (
            run as run_competency,
        )

        (out / "reports/competency-queries.json").write_text(
            json.dumps(run_competency(), indent=2) + "\n"
        )

        facts = {
            "version": version,
            "generated": date.today().isoformat(),
            "commit": _git_commit() or "unknown",
            "ontology": _ontology_version() or "unknown",
            "public_graph": public_graph,
            "public_triples": public.count(b"\n"),
            "belief_triples": beliefs.count(b"\n"),
            "belief_graphs": len(belief_graphs),
            "records_published": audit["records"]["published"],
            "records_sourced": audit["records"]["with_source"],
            "claims": audit["claims"]["accepted"],
            "claims_sourced": audit["claims"]["with_registered_source"],
        }
        (out / "README.md").write_text(README.format(**facts))

        software = json.loads((REPO_ROOT / ".zenodo.json").read_text())
        zenodo = {
            "title": f"HeritageGraph dataset {version}",
            "upload_type": "dataset",
            "access_right": "open",
            "license": "cc-by-4.0",
            "version": version,
            "creators": software.get("creators", []),
            "keywords": software.get("keywords", []),
            "description": (
                "Snapshot of the HeritageGraph knowledge graph of Nepalese cultural "
                "heritage: reviewed, source-backed records and links in CIDOC-CRM, "
                "with per-assertion provenance. See README.md."
            ),
            "related_identifiers": [
                {
                    "relation": "isSupplementTo",
                    "identifier": "https://github.com/CAIRNepal/heritagegraph",
                    "scheme": "url",
                }
            ],
        }
        (out / "zenodo.json").write_text(json.dumps(zenodo, indent=2) + "\n")

        files = sorted(p for p in out.rglob("*") if p.is_file())
        sums = {str(p.relative_to(out)): _sha256(p) for p in files}
        manifest = {**facts, "files": sums}
        (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        (out / "SHA256SUMS").write_text(
            "".join(f"{h}  {rel}\n" for rel, h in sums.items())
        )
        self.stdout.write(
            f"deposit {version} in {out}: {facts['public_triples']} public quads, "
            f"{facts['belief_triples']} belief quads, {len(sums)} files checksummed"
        )
        if not shacl["conforms"]:
            self.stdout.write(
                "note: the SHACL report records violations; see reports/ and "
                "documentation/research/NATURE_KG_RIGOR.md#shacl-conformance"
            )

    def _check(self, root: Path):
        bad = []
        for line in (root / "SHA256SUMS").read_text().splitlines():
            digest, rel = line.split("  ", 1)
            path = root / rel
            if not path.is_file() or _sha256(path) != digest:
                bad.append(rel)
        if bad:
            raise CommandError(f"checksum mismatch: {', '.join(bad)}")
        self.stdout.write(f"all checksums match in {root}")
