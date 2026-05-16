"""
OntologyRegistry — single source of truth for class and property URIs.

Reads the project OWL file at startup. All mappers, SPARQL queries, and SHACL
shapes resolve names through this registry, so changing the ontology file is
the only thing that needs to happen when the ontology evolves.
"""
from __future__ import annotations

from pathlib import Path

from rdflib import Graph, URIRef
from rdflib.namespace import OWL, RDF

from app.core.config import settings


class OntologyRegistry:
    """
    Parses an OWL/Turtle ontology and indexes every owl:Class,
    owl:ObjectProperty, and owl:DatatypeProperty by its local name
    (the portion of the URI after the ontology namespace prefix).

    Usage:
        ont.cls("E22HumanMadeObject")   →  URIRef("https://cair-nepal.org/nchlodE22HumanMadeObject")
        ont.prop("has_time")            →  URIRef("https://cair-nepal.org/nchlodhas_time")
        ont.namespace                   →  "https://cair-nepal.org/nchlod"
        ont.sparql_prefix               →  "PREFIX nchlod: <https://cair-nepal.org/nchlod>"
    """

    def __init__(self, owl_path: str | Path) -> None:
        self._owl_path = Path(owl_path)
        self._g: Graph = Graph()
        self._ns: str = ""
        self._prefix: str = ""
        self._classes:    dict[str, URIRef] = {}
        self._properties: dict[str, URIRef] = {}
        self._load()

    # ── Public API ──────────────────────────────────────────────────────────

    @property
    def namespace(self) -> str:
        return self._ns

    @property
    def prefix_name(self) -> str:
        return self._prefix

    @property
    def sparql_prefix(self) -> str:
        return f"PREFIX {self._prefix}: <{self._ns}>"

    @property
    def jsonld_context(self) -> dict:
        """Auto-generate a minimal JSON-LD @context from the loaded ontology."""
        ctx: dict = {self._prefix: self._ns}
        for local, uri in self._classes.items():
            ctx[local] = {"@id": str(uri)}
        for local, uri in self._properties.items():
            ctx[local] = {"@id": str(uri)}
        return ctx

    def cls(self, local_name: str) -> URIRef:
        try:
            return self._classes[local_name]
        except KeyError:
            available = ", ".join(sorted(self._classes))
            raise KeyError(
                f"Class {local_name!r} not found in ontology. "
                f"Available: {available}"
            ) from None

    def prop(self, local_name: str) -> URIRef:
        try:
            return self._properties[local_name]
        except KeyError:
            available = ", ".join(sorted(self._properties))
            raise KeyError(
                f"Property {local_name!r} not found in ontology. "
                f"Available: {available}"
            ) from None

    def all_classes(self) -> dict[str, URIRef]:
        return dict(self._classes)

    def all_properties(self) -> dict[str, URIRef]:
        return dict(self._properties)

    def reload(self) -> None:
        """Hot-reload from the same OWL file (call after editing the ontology)."""
        self._classes.clear()
        self._properties.clear()
        self._g = Graph()
        self._load()

    # ── Private ─────────────────────────────────────────────────────────────

    def _load(self) -> None:
        raw = self._owl_path.read_bytes()
        # The file may be UTF-16 with embedded nulls — strip them before parsing
        text = raw.replace(b"\x00", b"").decode("utf-8", "ignore")
        self._raw_text = text
        self._g.parse(data=text, format="turtle")
        self._discover_namespace()
        self._build_index()

    def _discover_namespace(self) -> None:
        """
        Discover the ontology's own namespace by scanning @prefix declarations
        literally present in the file — NOT from rdflib's namespace manager,
        which includes hundreds of globally-registered default bindings.

        The first non-standard prefix whose namespace URI has the most
        owl:Class subjects is selected as the ontology namespace.
        """
        import re

        # Extract only prefixes declared in *this* file
        file_prefixes: dict[str, str] = {}
        for m in re.finditer(
            r'@prefix\s+(\w*):\s+<([^>]+)>', self._raw_text, re.IGNORECASE
        ):
            file_prefixes[m.group(1)] = m.group(2)

        # Prefixes that belong to imported vocabularies, not the ontology itself
        skip = {
            "owl", "rdf", "rdfs", "xsd", "skos", "dcterms", "dct", "dc",
            "crm", "crmsci", "crmdig", "crminf",
            "aat", "tgn", "wikidata", "dbo", "foaf", "rico",
            "prov", "pav", "geo", "time", "wgs84", "wgs",
            "linkml", "datacite", "oa", "schema", "sh", "xml",
            "qb", "void", "vann", "doap", "csvw", "odrl", "org",
            "sosa", "ssn", "prof", "dcat", "dcmitype", "dcam",
            "brick",
        }

        # Score each candidate by how many owl:Class subjects use its namespace
        best_prefix, best_ns, best_score = "", "", -1
        for pfx, ns in file_prefixes.items():
            if pfx in skip:
                continue
            score = sum(
                1
                for s in self._g.subjects(RDF.type, OWL.Class)
                if isinstance(s, URIRef) and str(s).startswith(ns)
            )
            if score > best_score:
                best_prefix, best_ns, best_score = pfx, ns, score

        self._prefix = best_prefix
        self._ns = best_ns or ""

    def _local(self, uri: URIRef) -> str:
        return str(uri)[len(self._ns):]

    def _build_index(self) -> None:
        for s in self._g.subjects(RDF.type, OWL.Class):
            if isinstance(s, URIRef) and str(s).startswith(self._ns):
                self._classes[self._local(s)] = s

        for ptype in (OWL.ObjectProperty, OWL.DatatypeProperty):
            for s in self._g.subjects(RDF.type, ptype):
                if isinstance(s, URIRef) and str(s).startswith(self._ns):
                    self._properties[self._local(s)] = s


# ── Module-level singleton (lazy) ──────────────────────────────────────────

_registry: OntologyRegistry | None = None


def get_registry() -> OntologyRegistry:
    global _registry
    if _registry is None:
        _registry = OntologyRegistry(settings.ontology_path)
    return _registry


def reload_registry() -> None:
    global _registry
    if _registry is not None:
        _registry.reload()
    else:
        _registry = OntologyRegistry(settings.ontology_path)


class _OntProxy:
    """Thin proxy so callers can write `ont.cls(...)` without caring about init order."""

    def cls(self, name: str) -> URIRef:
        return get_registry().cls(name)

    def prop(self, name: str) -> URIRef:
        return get_registry().prop(name)

    @property
    def namespace(self) -> str:
        return get_registry().namespace

    @property
    def prefix_name(self) -> str:
        return get_registry().prefix_name

    @property
    def sparql_prefix(self) -> str:
        return get_registry().sparql_prefix

    @property
    def jsonld_context(self) -> dict:
        return get_registry().jsonld_context


ont = _OntProxy()
