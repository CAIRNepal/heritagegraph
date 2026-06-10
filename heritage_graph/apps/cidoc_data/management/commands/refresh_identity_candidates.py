"""Populate IdentityResolutionCandidate rows from label-based blocking heuristics (US4)."""

from __future__ import annotations

from collections import defaultdict

from apps.cidoc_data.identity_validation import labels_are_similar, normalize_label
from apps.cidoc_data.identity_services import active_memberships_for_subject, entity_display_title
from apps.cidoc_data.identity_validation import assertable_model_names
from apps.cidoc_data.management.commands.bootstrap_identity_clusters import CLUSTERABLE_MODELS
from apps.cidoc_data.models import IdentityResolutionCandidate
from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.core.management.base import BaseCommand


def _queue_pair(
    *,
    left_ct: ContentType,
    left_id: int,
    right_ct: ContentType,
    right_id: int,
    signal_scores: dict,
    dry: bool,
) -> str:
    """Return 'created', 'skipped', or 'dry'."""
    left_id, right_id = (
        (left_id, right_id) if left_id <= right_id else (right_id, left_id)
    )
    left_ct, right_ct = (
        (left_ct, right_ct) if left_id <= right_id else (right_ct, left_ct)
    )
    exists = IdentityResolutionCandidate.objects.filter(
        left_content_type=left_ct,
        left_object_id=left_id,
        right_content_type=right_ct,
        right_object_id=right_id,
        status="open",
    ).exists()
    if exists:
        return "skipped"
    if dry:
        return "dry"
    IdentityResolutionCandidate.objects.create(
        left_content_type=left_ct,
        left_object_id=left_id,
        right_content_type=right_ct,
        right_object_id=right_id,
        signal_scores=signal_scores,
        status="open",
        notes="",
    )
    return "created"


class Command(BaseCommand):
    help = (
        "Seed IdentityResolutionCandidate rows from same-type label similarity "
        "(exact normalized name + labels_are_similar heuristic)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print counts only; do not write to the database.",
        )
        parser.add_argument(
            "--type-scope",
            default="",
            help="Limit to one ContentType.model (e.g. location).",
        )
        parser.add_argument(
            "--auto-merge",
            action="store_true",
            help="After seeding candidates, run merge_similar_identity_clusters.",
        )
        parser.add_argument(
            "--rebuild-rdf",
            action="store_true",
            help="With --auto-merge, run rdf_rebuild afterward (bulk dedup).",
        )
        parser.add_argument(
            "--label-contains",
            default="",
            help="With --auto-merge, limit merges to clusters matching this substring.",
        )

    def handle(self, *args, **options):
        dry: bool = options["dry_run"]
        type_filter = (options["type_scope"] or "").strip().lower()
        created = 0
        skipped = 0
        dry_count = 0

        for app_label, model_name in CLUSTERABLE_MODELS:
            Model = apps.get_model(app_label, model_name)
            ct = ContentType.objects.get_for_model(Model, for_concrete_model=True)
            if ct.model not in assertable_model_names():
                continue
            if type_filter and ct.model != type_filter:
                continue

            rows: list[tuple[int, str, object]] = []
            for obj in Model.objects.all().iterator(chunk_size=400):
                label = entity_display_title(obj)
                if not normalize_label(label):
                    continue
                mem = active_memberships_for_subject(ct, obj.pk).first()
                if not mem or not mem.entity_cluster_id:
                    continue
                rows.append((obj.pk, label, mem.entity_cluster_id))

            # Exact normalized label → different clusters
            by_norm: dict[str, list[tuple[int, object]]] = defaultdict(list)
            for oid, label, cid in rows:
                by_norm[normalize_label(label)].append((oid, cid))

            for norm_key, entries in by_norm.items():
                clusters = {cid for _, cid in entries}
                if len(clusters) < 2:
                    continue
                by_c: dict[object, list[int]] = defaultdict(list)
                for oid, cid in entries:
                    by_c[cid].append(oid)
                cids = list(by_c.keys())
                for i in range(len(cids)):
                    for j in range(i + 1, len(cids)):
                        oa = by_c[cids[i]][0]
                        ob = by_c[cids[j]][0]
                        result = _queue_pair(
                            left_ct=ct,
                            left_id=oa,
                            right_ct=ct,
                            right_id=ob,
                            signal_scores={
                                "rule": "same_normalized_name",
                                "model": ct.model,
                                "normalized": norm_key,
                            },
                            dry=dry,
                        )
                        if result == "created":
                            created += 1
                        elif result == "skipped":
                            skipped += 1
                        else:
                            dry_count += 1

            # Similar labels across different clusters (O(n²) within type; small corpus)
            for i in range(len(rows)):
                oa, la, ca = rows[i]
                for j in range(i + 1, len(rows)):
                    ob, lb, cb = rows[j]
                    if ca == cb:
                        continue
                    if not labels_are_similar(la, lb):
                        continue
                    if normalize_label(la) == normalize_label(lb):
                        continue  # handled above
                    result = _queue_pair(
                        left_ct=ct,
                        left_id=oa,
                        right_ct=ct,
                        right_id=ob,
                        signal_scores={
                            "rule": "similar_label",
                            "model": ct.model,
                            "left_label": la,
                            "right_label": lb,
                        },
                        dry=dry,
                    )
                    if result == "created":
                        created += 1
                    elif result == "skipped":
                        skipped += 1
                    else:
                        dry_count += 1

        msg = (
            f"refresh_identity_candidates: created={created} "
            f"skipped_existing={skipped} dry_would_create={dry_count} dry_run={dry}"
        )
        self.stdout.write(self.style.SUCCESS(msg))

        if options.get("auto_merge"):
            merge_kwargs: dict = {"dry_run": dry}
            type_scope = (options.get("type_scope") or "").strip()
            label_contains = (options.get("label_contains") or "").strip()
            if type_scope:
                merge_kwargs["type_scope"] = type_scope
            if label_contains:
                merge_kwargs["label_contains"] = label_contains
            call_command("merge_similar_identity_clusters", **merge_kwargs)
            if options.get("rebuild_rdf") and not dry:
                call_command("rdf_rebuild")
