"""Replace a contributor's name with a stable pseudonym on everything they did.

The erasure path promised in the contributor terms. Contributions stay — they
are reviewed, versioned and may be cited — but who made them is withdrawn:

* the account's username becomes ``contributor-<hash>``;
* every text attribution (records' ``contributor``, assertions'
  ``contributed_by`` / ``attributed_to_agent``) naming the old username or
  email is rewritten to the pseudonym;
* profile details are cleared and the account leaves the leaderboard;
* touched records and assertions are re-projected, so provenance in the graph
  names the pseudonym too (agent IRIs are minted from the name).

``--deactivate`` also disables sign-in and clears the email. ``--dry-run``
reports what would change.
"""

from __future__ import annotations

import hashlib

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

PROFILE_FIELDS_TO_CLEAR = (
    "first_name",
    "middle_name",
    "last_name",
    "biography",
    "area_of_expertise",
    "country",
    "organization",
    "position",
    "university_school",
)


def pseudonym_for(user) -> str:
    digest = hashlib.sha256(f"heritagegraph-contributor:{user.pk}".encode()).hexdigest()
    return f"contributor-{digest[:10]}"


class Command(BaseCommand):
    help = "Pseudonymize a contributor's attribution everywhere."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("--deactivate", action="store_true")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        from apps.cidoc_data.models import HeritageAssertion, MetaData

        User = get_user_model()
        user = User.objects.filter(username=opts["username"]).first()
        if user is None:
            raise CommandError(f"No user {opts['username']!r}")
        alias = pseudonym_for(user)
        names = {n for n in (user.username, user.email) if n}

        records = []
        for model in apps.get_app_config("cidoc_data").get_models():
            if (
                issubclass(model, MetaData)
                and model is not MetaData
                and not model._meta.abstract
            ):
                records.extend(model.objects.filter(contributor__in=names))
        assertions = list(
            HeritageAssertion.objects.filter(
                Q(contributed_by__in=names) | Q(attributed_to_agent__in=names)
            )
        )
        self.stdout.write(
            f"{user.username} -> {alias}: {len(records)} records, "
            f"{len(assertions)} assertions"
        )
        if opts["dry_run"]:
            return

        with transaction.atomic():
            for record in records:
                record.contributor = alias
                record.save(update_fields=["contributor"])  # signals re-project
            for ha in assertions:
                if ha.contributed_by in names:
                    ha.contributed_by = alias
                if ha.attributed_to_agent in names:
                    ha.attributed_to_agent = alias
                ha.save(
                    update_fields=[
                        "contributed_by",
                        "attributed_to_agent",
                        "updated_at",
                    ]
                )
            user.username = alias
            user.first_name = user.last_name = ""
            if opts["deactivate"]:
                user.is_active = False
                user.email = ""
            user.save()
            profile = getattr(user, "profile", None)
            if profile is not None:
                for field in PROFILE_FIELDS_TO_CLEAR:
                    setattr(profile, field, "")
                profile.email = "" if opts["deactivate"] else profile.email
                profile.social_links = {}
                profile.website_link = None
                profile.avatar_url = None
                profile.profile_image = None
                profile.show_on_leaderboard = False
                profile.save()
        self.stdout.write(self.style.SUCCESS(f"done; the contributor is now {alias}"))
