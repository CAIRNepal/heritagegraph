"""Streaming N-Quads parser and in-memory subject index."""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

_IRI_RE = re.compile(r"<([^>]*)>")
_BLANK_RE = re.compile(r"(_:[\w\-.:]+)")


@dataclass(frozen=True, slots=True)
class Term:
    kind: str  # "iri" | "literal" | "blank"
    value: str
    datatype: str | None = None
    lang: str | None = None


@dataclass(frozen=True, slots=True)
class Quad:
    s: Term
    p: Term
    o: Term
    g: Term | None = None


@dataclass
class NqIndex:
    """Subject → list of (predicate IRI, object Term, graph IRI|None)."""

    by_subject: dict[str, list[tuple[str, Term, str | None]]] = field(
        default_factory=lambda: defaultdict(list)
    )
    type_subjects: dict[str, set[str]] = field(
        default_factory=lambda: defaultdict(set)
    )
    sha256: str = ""
    quad_count: int = 0
    parse_errors: int = 0

    def objects(self, subject: str, predicate: str) -> list[Term]:
        return [o for p, o, _g in self.by_subject.get(subject, ()) if p == predicate]

    def first_iri(self, subject: str, predicate: str) -> str | None:
        for o in self.objects(subject, predicate):
            if o.kind == "iri":
                return o.value
        return None

    def first_literal(self, subject: str, predicate: str) -> Term | None:
        for o in self.objects(subject, predicate):
            if o.kind == "literal":
                return o
        return None

    def literals(self, subject: str, predicate: str) -> list[Term]:
        return [o for o in self.objects(subject, predicate) if o.kind == "literal"]


def _scan_term(body: str, pos: int) -> tuple[Term, int]:
    """Scan one RDF term starting at ``pos``; return (term, new_pos)."""
    while pos < len(body) and body[pos].isspace():
        pos += 1
    if pos >= len(body):
        raise ValueError("Expected term, found end of line")

    if body[pos] == "<":
        m = _IRI_RE.match(body, pos)
        if not m:
            raise ValueError(f"Bad IRI at {body[pos:pos+40]!r}")
        return Term("iri", m.group(1)), m.end()

    if body.startswith("_:", pos):
        m = _BLANK_RE.match(body, pos)
        if not m:
            raise ValueError(f"Bad blank node at {body[pos:pos+40]!r}")
        return Term("blank", m.group(1)), m.end()

    if body[pos] == '"':
        i = pos + 1
        buf: list[str] = []
        while i < len(body):
            ch = body[i]
            if ch == "\\" and i + 1 < len(body):
                nxt = body[i + 1]
                escapes = {'"': '"', "\\": "\\", "n": "\n", "r": "\r", "t": "\t"}
                buf.append(escapes.get(nxt, nxt))
                i += 2
                continue
            if ch == '"':
                break
            buf.append(ch)
            i += 1
        else:
            raise ValueError(f"Unterminated literal at {body[pos:pos+40]!r}")
        lex = "".join(buf)
        i += 1  # past closing quote
        lang = None
        datatype = None
        if i < len(body) and body[i] == "@":
            j = i + 1
            while j < len(body) and (body[j].isalnum() or body[j] == "-"):
                j += 1
            lang = body[i + 1 : j]
            i = j
        elif i + 1 < len(body) and body[i : i + 2] == "^^":
            i += 2
            if i >= len(body) or body[i] != "<":
                raise ValueError(f"Bad datatype IRI at {body[i:i+40]!r}")
            m = _IRI_RE.match(body, i)
            if not m:
                raise ValueError(f"Bad datatype IRI at {body[i:i+40]!r}")
            datatype = m.group(1)
            i = m.end()
        return Term("literal", lex, datatype=datatype, lang=lang), i

    raise ValueError(f"Unrecognized term at {body[pos:pos+40]!r}")


def parse_quad_line(line: str) -> Quad | None:
    """Parse one N-Quads statement; return None for blank/comment lines."""
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    body = stripped
    if body.endswith("."):
        body = body[:-1].rstrip()
    hash_at = body.find(" #")
    if hash_at != -1:
        body = body[:hash_at].rstrip()

    terms: list[Term] = []
    pos = 0
    while pos < len(body):
        while pos < len(body) and body[pos].isspace():
            pos += 1
        if pos >= len(body):
            break
        term, pos = _scan_term(body, pos)
        terms.append(term)

    if len(terms) == 3:
        return Quad(terms[0], terms[1], terms[2], None)
    if len(terms) == 4:
        return Quad(terms[0], terms[1], terms[2], terms[3])
    raise ValueError(f"Expected 3–4 terms, got {len(terms)}: {stripped[:160]}")


# Keep _parse_term for callers/tests that pass a single raw token.
def _parse_term(raw: str) -> Term:
    term, end = _scan_term(raw.strip(), 0)
    if end != len(raw.strip()):
        raise ValueError(f"Trailing junk in term: {raw[:80]}")
    return term


def iter_quads(path: Path) -> Iterator[Quad]:
    with path.open("r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            try:
                q = parse_quad_line(line)
            except ValueError as exc:
                raise ValueError(f"{path}:{lineno}: {exc}") from exc
            if q is not None:
                yield q


def file_sha256(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def build_index(
    path: Path,
    *,
    type_filter: frozenset[str] | None = None,
    keep_subjects: set[str] | None = None,
) -> NqIndex:
    """Index quads. If ``type_filter`` is set, keep subjects of those types plus
    any ``keep_subjects``, and all triples for those subjects (second pass).

    For a 31 MB file a full in-memory index is fine; type_filter still helps
    callers that only need structure/place/belief subjects.
    """
    sha = file_sha256(path)
    index = NqIndex(sha256=sha)

    # Pass 1: discover subjects of interest
    interesting: set[str] = set(keep_subjects or ())
    from .constants import RDF_TYPE

    with path.open("r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            try:
                q = parse_quad_line(line)
            except ValueError:
                index.parse_errors += 1
                continue
            if q is None or q.s.kind != "iri" or q.p.kind != "iri":
                continue
            index.quad_count += 1
            if q.p.value == RDF_TYPE and q.o.kind == "iri":
                index.type_subjects[q.o.value].add(q.s.value)
                if type_filter is None or q.o.value in type_filter:
                    interesting.add(q.s.value)

    if type_filter is None:
        interesting = set()
        for subjects in index.type_subjects.values():
            interesting |= subjects
        # Also keep subjects that appear even without type (rare)
        # Full index: second pass indexes everything
        interesting = None  # type: ignore[assignment]

    # Pass 2: collect triples for interesting subjects (or all)
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                q = parse_quad_line(line)
            except ValueError:
                continue
            if q is None or q.s.kind != "iri" or q.p.kind != "iri":
                continue
            if interesting is not None and q.s.value not in interesting:
                # Still keep object links that expand the frontier? For P55 /
                # assertsAbout we need place/structure subjects already typed.
                continue
            g = q.g.value if q.g and q.g.kind == "iri" else None
            index.by_subject[q.s.value].append((q.p.value, q.o, g))

    return index


def build_full_index(path: Path) -> NqIndex:
    """Load every IRI-subject triple into memory (suitable for this corpus size)."""
    sha = file_sha256(path)
    index = NqIndex(sha256=sha)
    from .constants import RDF_TYPE

    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                q = parse_quad_line(line)
            except ValueError:
                index.parse_errors += 1
                continue
            if q is None or q.s.kind != "iri" or q.p.kind != "iri":
                continue
            index.quad_count += 1
            g = q.g.value if q.g and q.g.kind == "iri" else None
            index.by_subject[q.s.value].append((q.p.value, q.o, g))
            if q.p.value == RDF_TYPE and q.o.kind == "iri":
                index.type_subjects[q.o.value].add(q.s.value)
    return index
