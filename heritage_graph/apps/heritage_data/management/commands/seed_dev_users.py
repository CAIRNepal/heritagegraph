"""Seed development users for DEBUG-gated email-only dev login."""

from apps.heritage_data.models import UserProfile
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

DEV_USERS = [
    "dev@heritagegraph.local",
    "reviewer@heritagegraph.local",
    "moderator@heritagegraph.local",
]


class Command(BaseCommand):
    help = "Create test users for HERITAGEGRAPH_DEV_AUTH email-only login."

    def handle(self, *args, **options):
        for email in DEV_USERS:
            user, created = User.objects.get_or_create(email=email)
            UserProfile.objects.get_or_create(user=user)
            verb = "Created" if created else "Exists"
            self.stdout.write(f"{verb}: {email} (username={user.username})")

        self.stdout.write(
            self.style.SUCCESS(
                "Dev users ready. Sign in at /auth/login with Dev sign-in when "
                "HERITAGEGRAPH_DEV_AUTH=true and DEBUG=True."
            )
        )
