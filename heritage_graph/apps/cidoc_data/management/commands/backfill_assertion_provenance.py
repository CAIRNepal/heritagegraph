"""Backfill provenance (agent + source) on accepted relationship assertions.

Every published edge should be attributable: who/what asserted it and from where.
This records the *true* origin of assertions that predate provenance capture —
derived from the existing ``contributed_by`` field, never invented. Test-seed
edges are labelled as non-scholarly so a reviewer can distinguish them. Idempotent
(only fills blanks).

Usage:
  python manage.py backfill_assertion_provenance            # apply
  python manage.py backfill_assertion_provenance --dry-run  # report only
"""

from __future__ import annotations

from apps.cidoc_data.models import HeritageAssertion
from django.core.management.base import BaseCommand

# Honest origin descriptions keyed by the existing contributed_by tag.
_SOURCE_BY_ORIGIN = {
    "test-seed": "HeritageGraph test-seed corpus (non-scholarly; remove before publication).",
    "seed_db": "HeritageGraph seed reference corpus.",
}
_DEFAULT_SOURCE = "HeritageGraph contribution (origin recorded from contributor)."
_DEFAULT_AGENT = "heritagegraph-import"


class Command(BaseCommand):
    help = "Backfill agent + source provenance on accepted relationship assertions."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report counts only.")

    def handle(self, *args, **options):
        qs = HeritageAssertion.objects.filter(
            asserted_property__startswith="relationship.",
            reconciliation_status="accepted",
        )
        agent_filled = source_filled = 0
        for a in qs.iterator():
            changed = False
            if not (a.attributed_to_agent or "").strip():
                a.attributed_to_agent = (a.contributed_by or "").strip() or _DEFAULT_AGENT
                agent_filled += 1
                changed = True
            has_source = bool(a.source_id) or bool((a.source_citation or "").strip())
            if not has_source:
                origin = (a.contributed_by or "").strip()
                a.source_citation = _SOURCE_BY_ORIGIN.get(origin, _DEFAULT_SOURCE)
                source_filled += 1
                changed = True
            if changed and not options["dry_run"]:
                a.save(update_fields=["attributed_to_agent", "source_citation"])

        verb = "Would fill" if options["dry_run"] else "Filled"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} agent on {agent_filled} and source on {source_filled} accepted assertion(s)."
            )
        )
