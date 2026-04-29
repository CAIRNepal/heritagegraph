from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class Namespaces:
    hg: str
    hgr: str
    rdf: str = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    rdfs: str = "http://www.w3.org/2000/01/rdf-schema#"
    crm: str = "http://www.cidoc-crm.org/cidoc-crm/"
    prov: str = "http://www.w3.org/ns/prov#"
    xsd: str = "http://www.w3.org/2001/XMLSchema#"
    owl: str = "http://www.w3.org/2002/07/owl#"


NS = Namespaces(
    hg=getattr(settings, "HERITAGE_NAMESPACE", "https://w3id.org/heritagegraph/"),
    hgr=getattr(settings, "HERITAGE_RESOURCE_NS", "https://w3id.org/heritagegraph/resource/"),
)


_slug_re = re.compile(r"[^a-z0-9_]+")


def slugify_fragment(value: str) -> str:
    value = (value or "").strip().lower()
    value = value.replace("/", "_").replace("\\", "_").replace(" ", "_")
    value = _slug_re.sub("_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "unknown"


def iri(value: str) -> str:
    return f"<{value}>"


def literal(value: str, *, lang: str | None = None, datatype_iri: str | None = None) -> str:
    escaped = (value or "").replace("\\", "\\\\").replace('"', '\\"')
    if lang:
        return f"\"{escaped}\"@{lang}"
    if datatype_iri:
        return f"\"{escaped}\"^^<{datatype_iri}>"
    return f"\"{escaped}\""

