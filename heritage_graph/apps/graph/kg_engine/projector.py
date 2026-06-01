"""Build projection triplesets from Django models (registry-driven)."""

from __future__ import annotations

from typing import Any

from apps.graph.kg_engine.uris import (
    cultural_entity_uri,
    label_for_instance,
    resource_uri_for_instance,
)


def tripleset_for_metadata(instance: Any) -> tuple[list[Any], set[str], str]:
    from apps.cidoc_data.rdf_entity_projection import tripleset_for_metadata_instance

    uri = resource_uri_for_instance(instance)
    triples, managed = tripleset_for_metadata_instance(
        instance,
        resource_uri_fn=resource_uri_for_instance,
        label_fn=label_for_instance,
    )
    return triples, managed, uri


def tripleset_for_cultural_entity(entity: Any) -> tuple[list[Any], set[str], str]:
    from apps.cidoc_data.rdf_entity_projection import (
        RDF_TYPE_URI,
        _Triple,
        tripleset_for_metadata_instance,
    )
    from apps.graph.ontology_config import RDF_PREFIXES

    model_name = None
    cidoc_id = None
    try:
        from apps.heritage_data.models import Revision

        revision = (
            Revision.objects.filter(entity_id=entity.entity_id)
            .order_by("-revision_number")
            .first()
        )
        data = revision.data if revision and isinstance(revision.data, dict) else {}
        model_name = (data.get("_cidoc_model") or "").strip()
        cidoc_id = data.get("_cidoc_id")
    except Exception:
        pass

    uri = cultural_entity_uri(entity.entity_id)

    if model_name and cidoc_id is not None:
        try:
            from django.apps import apps as django_apps

            model = django_apps.get_model("cidoc_data", model_name)
            instance = model.objects.filter(pk=cidoc_id).first()
            if instance is not None:
                triples, managed = tripleset_for_metadata_instance(
                    instance,
                    resource_uri_fn=lambda _i: uri,
                    label_fn=lambda i: getattr(i, "name", None)
                    or getattr(i, "title", None)
                    or str(entity.entity_id),
                )
                return triples, managed, uri
        except Exception:
            pass

    label = (entity.name or str(entity.entity_id)).strip()
    type_uri = RDF_PREFIXES.get("heritageGraph", "https://w3id.org/heritagegraph/") + (
        entity.category or "Entity"
    )
    triples = [
        _Triple(uri, RDF_TYPE_URI, type_uri, None),
        _Triple(uri, RDF_PREFIXES["rdfs"] + "label", None, (label, "xsd:string")),
    ]
    managed = {RDF_TYPE_URI, RDF_PREFIXES["rdfs"] + "label"}
    if entity.description:
        triples.append(
            _Triple(
                uri,
                RDF_PREFIXES["rdfs"] + "comment",
                None,
                (entity.description[:2000], "xsd:string"),
            )
        )
        managed.add(RDF_PREFIXES["rdfs"] + "comment")
    return triples, managed, uri
