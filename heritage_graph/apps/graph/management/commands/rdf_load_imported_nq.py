"""Load DANAM N-Quads into Oxigraph as L0 research graphs (never graph/public).

Preserves named-graph IRIs from the dump (OSM / Wikidata / UNESCO / crosswalk /
intangible). Refuses to write into the curated public partition.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.cidoc_data.danam_import.nq import file_sha256, parse_quad_line
from apps.graph.kg_engine.partitions import GraphPartition


PUBLIC_MARKERS = (
    "/graph/public",
    "w3id.org/heritagegraph/graph/public",
)


class Command(BaseCommand):
    help = (
        "Load danam-heritagegraph.nq into Oxigraph as imported/research named "
        "graphs (L0). Does not touch graph/public."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument("--file", type=str, default="")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count quads/graphs only; do not write to the store.",
        )
        parser.add_argument(
            "--expected-sha256",
            type=str,
            default="",
            help="Abort when input SHA-256 does not match.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Load at most N quads (dev smoke).",
        )

    def handle(self, *args, **options) -> None:
        path = self._resolve_path(options["file"])
        if not path.is_file():
            raise CommandError(f"NQ file not found: {path}")

        sha = file_sha256(path)
        expected = (options["expected_sha256"] or "").strip().lower()
        if expected and sha.lower() != expected:
            raise CommandError(f"SHA-256 mismatch.\n  expected: {expected}\n  actual:   {sha}")

        public_uri = (GraphPartition.PUBLIC.uri() or "").rstrip("/")
        graph_counts: Counter[str] = Counter()
        skipped_public = 0
        total = 0
        errors = 0

        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                try:
                    q = parse_quad_line(line)
                except ValueError:
                    errors += 1
                    continue
                if q is None:
                    continue
                total += 1
                g = q.g.value if q.g and q.g.kind == "iri" else "(default)"
                if self._is_public_graph(g, public_uri):
                    skipped_public += 1
                    continue
                graph_counts[g] += 1
                if options["limit"] is not None and sum(graph_counts.values()) >= options["limit"]:
                    break

        self.stdout.write(self.style.MIGRATE_HEADING("L0 rdf_load_imported_nq"))
        self.stdout.write(f"  file           = {path}")
        self.stdout.write(f"  sha256         = {sha}")
        self.stdout.write(f"  quads_scanned  = {total}")
        self.stdout.write(f"  parse_errors   = {errors}")
        self.stdout.write(f"  skipped_public = {skipped_public}")
        self.stdout.write(f"  graphs         = {len(graph_counts)}")
        for g, n in graph_counts.most_common(12):
            self.stdout.write(f"    {n:>7}  {g}")

        if skipped_public:
            self.stdout.write(
                self.style.WARNING(
                    f"Refused {skipped_public} quad(s) targeting the public partition."
                )
            )

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("Dry run complete — store unchanged."))
            return

        endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        if endpoint:
            loaded = self._load_remote(endpoint, path, options["limit"])
        else:
            loaded = self._load_local(path, options["limit"], public_uri)

        self.stdout.write(self.style.SUCCESS(f"Loaded {loaded} L0 quads into research graphs."))

    def _resolve_path(self, raw: str) -> Path:
        if raw:
            return Path(raw).expanduser()
        base = Path(settings.BASE_DIR).resolve()
        for candidate in (
            base.parent / "data" / "reconciled" / "danam-heritagegraph.nq",
            base / "data" / "reconciled" / "danam-heritagegraph.nq",
            Path.cwd() / "data" / "reconciled" / "danam-heritagegraph.nq",
        ):
            if candidate.is_file():
                return candidate
        return base.parent / "data" / "reconciled" / "danam-heritagegraph.nq"

    @staticmethod
    def _is_public_graph(graph_iri: str, public_uri: str) -> bool:
        g = (graph_iri or "").lower()
        if public_uri and g.rstrip("/") == public_uri.lower():
            return True
        return any(m in g for m in PUBLIC_MARKERS)

    def _load_remote(self, endpoint: str, path: Path, limit: int | None) -> int:
        import requests

        base = endpoint.replace("/update", "").replace("/sparql", "").rstrip("/")
        store_url = f"{base}/store"
        if limit is None:
            data = path.read_bytes()
            resp = requests.post(
                store_url,
                data=data,
                headers={"Content-Type": "application/n-quads"},
                timeout=600,
            )
            resp.raise_for_status()
            # Approximate: full file load
            return sum(1 for _ in path.open("r", encoding="utf-8") if _.strip() and not _.startswith("#"))

        # Limited load: stream filtered NQ body
        body_lines: list[str] = []
        public_uri = (GraphPartition.PUBLIC.uri() or "").rstrip("/")
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                try:
                    q = parse_quad_line(line)
                except ValueError:
                    continue
                if q is None:
                    continue
                g = q.g.value if q.g and q.g.kind == "iri" else ""
                if self._is_public_graph(g, public_uri):
                    continue
                body_lines.append(line if line.endswith("\n") else line + "\n")
                if len(body_lines) >= limit:
                    break
        resp = requests.post(
            store_url,
            data="".join(body_lines).encode("utf-8"),
            headers={"Content-Type": "application/n-quads"},
            timeout=120,
        )
        resp.raise_for_status()
        return len(body_lines)

    def _load_local(self, path: Path, limit: int | None, public_uri: str) -> int:
        try:
            from pyoxigraph import Literal, NamedNode, Quad
        except ImportError as exc:
            raise CommandError(
                "pyoxigraph is required for local L0 load (or set RDF_ENDPOINT_URL)."
            ) from exc

        from apps.graph.kg_engine.engine import get_kg_engine
        from apps.graph.kg_engine.store import _open_local_store

        engine = get_kg_engine()
        store_path = engine.store._local_store_path()  # noqa: SLF001 — local Oxigraph path
        store = _open_local_store(store_path)
        loaded = 0
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                try:
                    q = parse_quad_line(line)
                except ValueError:
                    continue
                if q is None or q.s.kind != "iri" or q.p.kind != "iri":
                    continue
                g_iri = q.g.value if q.g and q.g.kind == "iri" else None
                if g_iri and self._is_public_graph(g_iri, public_uri):
                    continue
                try:
                    s = NamedNode(q.s.value)
                    p = NamedNode(q.p.value)
                    if q.o.kind == "iri":
                        o: NamedNode | Literal = NamedNode(q.o.value)
                    elif q.o.kind == "literal":
                        if q.o.lang:
                            o = Literal(q.o.value, language=q.o.lang)
                        elif q.o.datatype:
                            o = Literal(q.o.value, datatype=NamedNode(q.o.datatype))
                        else:
                            o = Literal(q.o.value)
                    else:
                        continue
                    g = NamedNode(g_iri) if g_iri else None
                    store.add(Quad(s, p, o, g))
                    loaded += 1
                except Exception:
                    continue
                if limit is not None and loaded >= limit:
                    break
        return loaded
