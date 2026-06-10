"""
Management command to set up platform role groups.

Usage:
    python manage.py setup_roles                       # Create groups only
    python manage.py setup_roles --assign-superuser    # Also give superusers moderator + expert_curator
"""

from apps.heritage_data.models import ReviewerRole
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

User = get_user_model()

GROUPS = [
    {
        "name": "Contributors",
        "description": "Users who can submit cultural heritage contributions",
    },
    {
        "name": "Reviewers",
        "description": "Users who can review contributions and resolve conflicts",
    },
    {
        "name": "Moderators",
        "description": "Users with full curation access including reviewer dashboard",
    },
]


class Command(BaseCommand):
    help = "Create Contributor, Reviewer, and Moderator groups, and optionally assign roles."

    def add_arguments(self, parser):
        parser.add_argument(
            "--assign-superuser",
            action="store_true",
            help="Assign Moderator group + expert_curator ReviewerRole to every superuser",
        )

    def handle(self, *args, **options):
        for g in GROUPS:
            group, created = Group.objects.get_or_create(name=g["name"])
            verb = "Created" if created else "Already exists"
            self.stdout.write(f"  {verb}: group '{group.name}'")

        contributors_group = Group.objects.get(name="Contributors")
        all_users = User.objects.all()
        for user in all_users:
            user.groups.add(contributors_group)
        self.stdout.write(
            self.style.SUCCESS(
                f"  Added {all_users.count()} users to Contributors group"
            )
        )

        if options["assign_superuser"]:
            reviewers_group = Group.objects.get(name="Reviewers")
            moderators_group = Group.objects.get(name="Moderators")
            superusers = User.objects.filter(is_superuser=True)
            for su in superusers:
                su.groups.add(reviewers_group, moderators_group)
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
                    f"  Assigned moderator + reviewer roles to {superusers.count()} superuser(s)"
                )
            )

        self.stdout.write(self.style.SUCCESS("\nDone! Roles are set up."))
