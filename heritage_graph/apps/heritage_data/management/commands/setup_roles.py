"""
Management command to set up Contributor and Reviewer roles/groups.

Usage:
    python manage.py setup_roles              # Create groups only
    python manage.py setup_roles --assign-superuser   # Also give superuser a reviewer role
"""

from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

from apps.heritage_data.models import ReviewerRole


GROUPS = [
    {
        "name": "Contributors",
        "description": "Users who can submit cultural heritage contributions",
    },
    {
        "name": "Reviewers",
        "description": "Users who can review and moderate contributions",
    },
]


class Command(BaseCommand):
    help = "Create Contributor and Reviewer groups, and optionally assign reviewer roles."

    def add_arguments(self, parser):
        parser.add_argument(
            "--assign-superuser",
            action="store_true",
            help="Assign an expert_curator ReviewerRole to every superuser",
        )

    def handle(self, *args, **options):
        # 1. Create groups
        for g in GROUPS:
            group, created = Group.objects.get_or_create(name=g["name"])
            verb = "Created" if created else "Already exists"
            self.stdout.write(f"  {verb}: group '{group.name}'")

        # 2. Add every existing user to the Contributors group
        contributors_group = Group.objects.get(name="Contributors")
        all_users = User.objects.all()
        for user in all_users:
            user.groups.add(contributors_group)
        self.stdout.write(
            self.style.SUCCESS(
                f"  Added {all_users.count()} users to Contributors group"
            )
        )

        # 3. Optionally make superusers expert curators
        if options["assign_superuser"]:
            reviewers_group = Group.objects.get(name="Reviewers")
            superusers = User.objects.filter(is_superuser=True)
            for su in superusers:
                su.groups.add(reviewers_group)
                role, created = ReviewerRole.objects.get_or_create(
                    user=su,
                    defaults={
                        "role": "expert_curator",
                        "is_active": True,
                        "expertise_areas": [],
                        "assigned_by": su,
                    },
                )
                verb = "Created" if created else "Already exists"
                self.stdout.write(
                    f"  {verb}: expert_curator role for '{su.username}'"
                )
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Assigned reviewer roles to {superusers.count()} superuser(s)"
                )
            )

        self.stdout.write(self.style.SUCCESS("\nDone! Roles are set up."))
