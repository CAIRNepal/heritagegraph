"""Seed RelationshipPredicate rows for knowledge graph proposals (007)."""

from django.core.management.base import BaseCommand

from apps.cidoc_data.models import RelationshipPredicate

PRESETS: tuple[tuple[str, str, str, int], ...] = (
    ("ruled", "Ruled", "Subject ruled or governed the object (e.g. person → place).", 10),
    ("founded", "Founded", "Subject founded or instituted the object.", 20),
    ("member_of", "Member of", "Subject was or is a member of the object group.", 30),
    ("same_as", "Same as", "Subject is asserted same referent as object (non-identity workflow).", 40),
    ("authored", "Authored", "Subject authored the documentary source object.", 50),
    ("transcribed_by", "Transcribed by", "Object manuscript was transcribed by subject agent.", 60),
    ("located_in", "Located in", "Subject is located within the object place.", 70),
)


class Command(BaseCommand):
    help = "Create or update active RelationshipPredicate vocabulary rows."

    def handle(self, *args, **options):
        for code, label, description, sort_order in PRESETS:
            RelationshipPredicate.objects.update_or_create(
                code=code,
                defaults={
                    "label": label,
                    "description": description,
                    "sort_order": sort_order,
                    "active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS("Relationship predicates seeded."))
