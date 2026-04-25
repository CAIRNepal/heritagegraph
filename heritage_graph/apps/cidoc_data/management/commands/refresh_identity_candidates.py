"""Populate IdentityResolutionCandidate rows from simple name-based heuristics (US4)."""

from __future__ import annotations

from collections import defaultdict

from apps.cidoc_data.identity_services import active_memberships_for_subject
from apps.cidoc_data.models import IdentityResolutionCandidate, Location, Person
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand


def _norm(s: str | None) -> str:
    return (s or "").strip().casefold()


class Command(BaseCommand):
    help = "Seed IdentityResolutionCandidate rows from same-name cross-cluster pairs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print counts only; do not write to the database.",
        )

    def handle(self, *args, **options):
        dry: bool = options["dry_run"]
        created = 0
        skipped = 0

        for model in (Person, Location):
            ct = ContentType.objects.get_for_model(model)
            by_name: dict[str, list[tuple[int, object]]] = defaultdict(list)
            for obj in model.objects.all().only("id", "name").iterator(chunk_size=800):
                key = _norm(getattr(obj, "name", None) or "")
                if not key:
                    continue
                m = active_memberships_for_subject(ct, obj.pk).first()
                if not m or not m.entity_cluster_id:
                    continue
                by_name[key].append((obj.pk, m.entity_cluster_id))

            for rows in by_name.values():
                clusters = {cid for _, cid in rows}
                if len(clusters) < 2:
                    continue
                by_c: dict[object, list[int]] = defaultdict(list)
                for oid, cid in rows:
                    by_c[cid].append(oid)
                cids = list(by_c.keys())
                for i in range(len(cids)):
                    for j in range(i + 1, len(cids)):
                        oa = by_c[cids[i]][0]
                        ob = by_c[cids[j]][0]
                        left_id, right_id = (oa, ob) if oa < ob else (ob, oa)
                        exists = IdentityResolutionCandidate.objects.filter(
                            left_content_type=ct,
                            left_object_id=left_id,
                            right_content_type=ct,
                            right_object_id=right_id,
                            status="open",
                        ).exists()
                        if exists:
                            skipped += 1
                            continue
                        if dry:
                            created += 1
                            continue
                        IdentityResolutionCandidate.objects.create(
                            left_content_type=ct,
                            left_object_id=left_id,
                            right_content_type=ct,
                            right_object_id=right_id,
                            signal_scores={
                                "rule": "same_normalized_name",
                                "model": ct.model,
                            },
                            status="open",
                            notes="",
                        )
                        created += 1

        msg = (
            f"refresh_identity_candidates: created={created} "
            f"skipped_existing={skipped} dry_run={dry}"
        )
        self.stdout.write(self.style.SUCCESS(msg))
