from __future__ import annotations

from typing import Iterable

from apps.graph.rdf import NS, iri, literal, slugify_fragment


def triples_to_nt(triples: Iterable[tuple[str, str, str]]) -> str:
    return "\n".join(f"{iri(s)} {iri(p)} {o} ." for s, p, o in triples)


def person_to_triples(person) -> tuple[str, list[tuple[str, str, str]]]:
    """
    Convert a cidoc_data.Person row to RDF triples.

    Subject IRI is deterministic by UUID (stable even if the name changes).
    """
    subject = f"{NS.hgr}Person/{person.pk}"
    triples: list[tuple[str, str, str]] = [
        (subject, f"{NS.rdf}type", iri(f"{NS.crm}E21_Person")),
        (subject, f"{NS.rdf}type", iri(f"{NS.hg}Person")),
        (subject, f"{NS.rdfs}label", literal(str(person.name or ""), lang="en")),
    ]

    if getattr(person, "birth_date", None):
        triples.append(
            (
                subject,
                f"{NS.hg}birth_date",
                literal(str(person.birth_date), datatype_iri=f"{NS.xsd}string"),
            )
        )
    if getattr(person, "death_date", None):
        triples.append(
            (
                subject,
                f"{NS.hg}death_date",
                literal(str(person.death_date), datatype_iri=f"{NS.xsd}string"),
            )
        )
    if getattr(person, "occupation", None):
        triples.append((subject, f"{NS.hg}occupation", literal(str(person.occupation))))
    if getattr(person, "biography", None):
        triples.append((subject, f"{NS.crm}P3_has_note", literal(str(person.biography)[:2000])))

    contributor = getattr(person, "contributor", None)
    if contributor:
        agent = f"{NS.hgr}Agent/user_{contributor.pk}"
        triples.extend(
            [
                (subject, f"{NS.prov}wasAttributedTo", iri(agent)),
                (agent, f"{NS.rdf}type", iri(f"{NS.prov}Agent")),
                (agent, f"{NS.rdfs}label", literal(str(getattr(contributor, "username", "")))),
            ]
        )

    return subject, triples


def architectural_structure_to_triples(structure) -> tuple[str, list[tuple[str, str, str]]]:
    subject = f"{NS.hgr}Structure/{structure.pk}"
    name = getattr(structure, "name", None) or getattr(structure, "title", None) or ""
    triples: list[tuple[str, str, str]] = [
        (subject, f"{NS.rdf}type", iri(f"{NS.hg}ArchitecturalStructure")),
        (subject, f"{NS.rdfs}label", literal(str(name), lang="en")),
    ]
    description = getattr(structure, "description", None)
    if description:
        triples.append((subject, f"{NS.crm}P3_has_note", literal(str(description)[:2000])))

    # If registry-driven fields exist, emit them as literals for now.
    for attr in ("architectural_style", "condition", "status"):
        val = getattr(structure, attr, None)
        if val:
            pred = f"{NS.hg}{slugify_fragment(attr)}"
            triples.append((subject, pred, literal(str(val))))

    contributor = getattr(structure, "contributor", None)
    if contributor:
        agent = f"{NS.hgr}Agent/user_{contributor.pk}"
        triples.extend(
            [
                (subject, f"{NS.prov}wasAttributedTo", iri(agent)),
                (agent, f"{NS.rdf}type", iri(f"{NS.prov}Agent")),
                (agent, f"{NS.rdfs}label", literal(str(getattr(contributor, "username", "")))),
            ]
        )

    return subject, triples

