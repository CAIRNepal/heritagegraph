from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from apps.cidoc_data.models import Person, PersonRevision

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
