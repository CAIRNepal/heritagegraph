from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from apps.cidoc_data.models import (
    ArchitecturalStructure,
    IconographicObject,
    KumariRetirement,
    KumariSelection,
    KumariTenure,
    Person,
    PersonRevision,
    SyncreticRelationship,
)

@receiver(post_save, sender=Person)
def create_person_revision(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    PersonRevision.objects.create(
        person=instance,
        snapshot={
            "title": instance.title,
            "description": instance.description,
            "name": instance.name,
            "aliases": instance.aliases,
            "birth_date": instance.birth_date,
            "death_date": instance.death_date,
            "occupation": instance.occupation,
            "biography": instance.biography,
            "status": instance.status,
            "contributor": instance.contributor
        },
        user=instance.contributor, 
        action=action
    )


@receiver(post_save, sender=Person)
def sync_person_to_graph(sender, instance, **kwargs):
    try:
        from apps.graph.client import graph_client
        from apps.graph.serializers import person_to_triples, triples_to_nt

        _uri, triples = person_to_triples(instance)
        graph_client.insert_data(triples_to_nt(triples))
    except Exception:
        # Graph sync must never break the main DB write path.
        pass


@receiver(post_save, sender=ArchitecturalStructure)
def sync_structure_to_graph(sender, instance, **kwargs):
    try:
        from apps.graph.client import graph_client
        from apps.graph.serializers import architectural_structure_to_triples, triples_to_nt

        _uri, triples = architectural_structure_to_triples(instance)
        graph_client.insert_data(triples_to_nt(triples))
    except Exception:
        # Graph sync must never break the main DB write path.
        pass


def _backfill_entityrefs_for_instance(instance):
    """Scoped EntityRef backfill for a single saved instance."""
    try:
        from apps.cidoc_data.relation_backrefs import (
            CIDOC_RELATION_BACKREFS,
            DOMAIN_KEY_TO_TARGET_MODEL,
            _parse_relation_ids,
        )
        from apps.cidoc_data.models import EntityRef
        from django.contrib.contenttypes.models import ContentType

        model_cls = instance.__class__
        from_ct = ContentType.objects.get_for_model(model_cls)

        for backref_model, field_name, multivalued, ref_domain in CIDOC_RELATION_BACKREFS:
            if backref_model is not model_cls:
                continue
            to_model = DOMAIN_KEY_TO_TARGET_MODEL.get(ref_domain)
            if not to_model:
                continue
            to_ct = ContentType.objects.get_for_model(to_model)
            raw = getattr(instance, field_name, None)
            for tid in _parse_relation_ids(raw, multivalued):
                EntityRef.objects.get_or_create(
                    from_content_type=from_ct,
                    from_object_id=instance.pk,
                    predicate=field_name,
                    to_content_type=to_ct,
                    to_object_id=tid,
                )
    except Exception:
        pass


@receiver(post_save, sender=KumariTenure)
def sync_entityrefs_kumari_tenure(sender, instance, **kwargs):
    _backfill_entityrefs_for_instance(instance)


@receiver(post_save, sender=KumariSelection)
def sync_entityrefs_kumari_selection(sender, instance, **kwargs):
    _backfill_entityrefs_for_instance(instance)


@receiver(post_save, sender=KumariRetirement)
def sync_entityrefs_kumari_retirement(sender, instance, **kwargs):
    _backfill_entityrefs_for_instance(instance)


@receiver(post_save, sender=IconographicObject)
def sync_entityrefs_iconographic_object(sender, instance, **kwargs):
    _backfill_entityrefs_for_instance(instance)


@receiver(post_save, sender=SyncreticRelationship)
def sync_entityrefs_syncretic_relationship(sender, instance, **kwargs):
    _backfill_entityrefs_for_instance(instance)
