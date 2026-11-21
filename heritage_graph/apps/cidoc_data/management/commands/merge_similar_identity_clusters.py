"""Merge entity clusters whose canonical labels denote the same referent (substring heuristic)."""

from __future__ import annotations

from apps.cidoc_data.identity_services import active_memberships_for_subject, merge_clusters
from apps.cidoc_data.models import EntityCluster
from apps.cidoc_data.identity_validation import labels_are_auto_mergeable
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        "Merge EntityCluster rows within the same type_scope when canonical labels "
        "are similar (e.g. 'Pashupatinath' vs 'Pashupatinath Temple')."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print planned merges without writing.",
        )
        parser.add_argument(
            "--type-scope",
            default="",
            help="Limit to one type_scope (e.g. location).",
        )
        parser.add_argument(
            "--label-contains",
            default="",
            help="Only clusters whose canonical_label contains this substring (case-insensitive).",
        )

    def handle(self, *args, **options) -> None:
        dry: bool = options["dry_run"]
        type_scope = (options["type_scope"] or "").strip()
        label_filter = (options["label_contains"] or "").strip().casefold()

        User = get_user_model()
        actor = User.objects.filter(is_superuser=True).first()
        if actor is None:
            actor = User.objects.filter(is_staff=True).first()
        if actor is None and not dry:
            actor, _ = User.objects.get_or_create(
                username="system-identity-merge",
                defaults={
                    "is_staff": True,
                    "is_superuser": True,
                    "email": "system-identity-merge@localhost",
                },
            )

        qs = EntityCluster.objects.filter(merged_into__isnull=True).order_by(
            "type_scope",
            "canonical_label",
        )
        if type_scope:
            qs = qs.filter(type_scope=type_scope)
        if label_filter:
            qs = qs.filter(canonical_label__icontains=label_filter)

        clusters = list(qs)
        merged_count = 0

        by_scope: dict[str, list[EntityCluster]] = {}
        for c in clusters:
            by_scope.setdefault(c.type_scope, []).append(c)

        for scope, group in by_scope.items():
            used: set = set()
            for i, target in enumerate(group):
                if target.id in used:
                    continue
                for source in group[i + 1 :]:
                    if source.id in used:
                        continue
                    if not labels_are_auto_mergeable(
                        target.canonical_label,
                        source.canonical_label,
                    ):
                        continue
                    # Prefer shorter canonical label as merge target (cleaner hub name)
                    if len(source.canonical_label) < len(target.canonical_label):
                        target, source = source, target

                    self.stdout.write(
                        f"{'[dry-run] ' if dry else ''}Merge {scope}: "
                        f"'{source.canonical_label}' ({source.id}) "
                        f"→ '{target.canonical_label}' ({target.id})"
                    )
                    if dry:
                        merged_count += 1
                        used.add(source.id)
                        continue
                    try:
                        with transaction.atomic():
                            merge_clusters(
                                actor=actor,
                                target=target,
                                source=source,
                                reason=(
                                    "Auto-merge similar canonical labels "
                                    "(merge_similar_identity_clusters)"
                                ),
                                expected_version=target.version,
                                lock_override=False,
                                is_expert_curator=True,
                            )
                        merged_count += 1
                        used.add(source.id)
                        target.refresh_from_db()
                    except Exception as exc:
                        self.stderr.write(
                            self.style.WARNING(
                                f"Skipped merge {source.id} → {target.id}: {exc}"
                            )
                        )

        self.stdout.write(
            self.style.SUCCESS(
                f"merge_similar_identity_clusters: merged={merged_count} dry_run={dry}"
            )
        )
