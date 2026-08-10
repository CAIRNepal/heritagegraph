"""Record a month-end snapshot of every contributor's standing.

The contributor dashboard reports rank movement between periods. That number is
only honest if there is an earlier measurement to subtract from, so this command
writes one row per contributor per closed month. Until it has run at least once,
`UserStats.rank_change` stays null and the dashboard says "no prior period"
rather than inventing a delta.

Intended cadence: once per month, shortly after the month closes.

    python manage.py snapshot_user_stats            # snapshot the last closed month
    python manage.py snapshot_user_stats --period 2026-07
    python manage.py snapshot_user_stats --dry-run
"""

from datetime import datetime, timedelta

from apps.heritage_data.models import UserStats, UserStatsSnapshot
from apps.heritage_data.signals import refresh_user_stats
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = "Write a month-end UserStatsSnapshot for every contributor."

    def add_arguments(self, parser):
        parser.add_argument(
            "--period",
            help=(
                "Month to snapshot as YYYY-MM. Defaults to the most recently "
                "closed month."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be written without touching the database.",
        )

    def handle(self, *args, **options):
        period = self._resolve_period(options.get("period"))
        dry_run = options["dry_run"]

        current_month_start = (
            timezone.now()
            .replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            .date()
        )
        if period >= current_month_start:
            raise CommandError(
                f"Refusing to snapshot {period:%Y-%m}: the month has not closed "
                "yet, so its figures are still moving."
            )

        users = User.objects.filter(stats__isnull=False).select_related("stats")
        written = 0
        skipped = 0

        for user in users.iterator():
            # Recompute first so the snapshot records current truth rather than
            # whatever was last cached.
            if not dry_run:
                refresh_user_stats(user)
                stats = UserStats.objects.get(user=user)
            else:
                stats = user.stats

            if UserStatsSnapshot.objects.filter(user=user, period=period).exists():
                skipped += 1
                continue

            if dry_run:
                written += 1
                continue

            with transaction.atomic():
                UserStatsSnapshot.objects.create(
                    user=user,
                    period=period,
                    total_submissions=stats.total_submissions,
                    contributor_rank=stats.contributor_rank,
                    approval_rate=stats.approval_rate,
                )
            written += 1

        verb = "Would write" if dry_run else "Wrote"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {written} snapshot(s) for {period:%Y-%m}; "
                f"{skipped} already existed."
            )
        )

    @staticmethod
    def _resolve_period(raw):
        if raw:
            try:
                return datetime.strptime(raw, "%Y-%m").date().replace(day=1)
            except ValueError as exc:
                raise CommandError(
                    f"--period must look like YYYY-MM (got {raw!r})."
                ) from exc

        this_month_start = timezone.now().replace(day=1).date()
        return (this_month_start - timedelta(days=1)).replace(day=1)
