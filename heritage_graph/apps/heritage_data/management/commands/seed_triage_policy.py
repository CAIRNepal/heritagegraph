"""Seed default TriagePolicy row (spec 006)."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.heritage_data.models import TriagePolicy
from apps.heritage_data.services.triage_scoring import DEFAULT_TIER_ORDER_BEST_TO_WORST


class Command(BaseCommand):
    help = "Create or refresh the active TriagePolicy with spec default weights and tier order."

    def handle(self, *args, **options):
        TriagePolicy.objects.update(is_active=False)
        row = TriagePolicy.objects.order_by("-updated_at").first()
        if row:
            row.is_active = True
            row.w_age = Decimal("2.500")
            row.w_flags = Decimal("1.500")
            row.w_conflict = Decimal("3.000")
            row.w_source = Decimal("1.000")
            row.s_max_days = 30
            row.f_max_flags = 10
            row.tier_rank_json = list(DEFAULT_TIER_ORDER_BEST_TO_WORST)
            row.save()
        else:
            row = TriagePolicy.objects.create(
                is_active=True,
                w_age=Decimal("2.500"),
                w_flags=Decimal("1.500"),
                w_conflict=Decimal("3.000"),
                w_source=Decimal("1.000"),
                s_max_days=30,
                f_max_flags=10,
                tier_rank_json=list(DEFAULT_TIER_ORDER_BEST_TO_WORST),
            )
        self.stdout.write(self.style.SUCCESS(f"TriagePolicy active row ok: {row.id}"))
