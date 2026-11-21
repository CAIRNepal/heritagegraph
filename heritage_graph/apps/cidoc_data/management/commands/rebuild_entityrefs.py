"""Populate EntityRef rows from legacy CharField relation columns."""

from apps.cidoc_data.relation_backrefs import backfill_entityrefs_from_legacy_columns
from django.core.management.base import BaseCommand, CommandError


def _check_consistency():
    """
    Return list of (model, field, instance_pk, raw_value) tuples where the CharField
    value contains non-empty relation IDs that have no matching EntityRef row.
    """
    from apps.cidoc_data.models import EntityRef
    from apps.cidoc_data.relation_backrefs import (
        CIDOC_RELATION_BACKREFS,
        DOMAIN_KEY_TO_TARGET_MODEL,
        _parse_relation_ids,
    )
    from django.contrib.contenttypes.models import ContentType

    missing = []
    for model_cls, field_name, multivalued, ref_domain in CIDOC_RELATION_BACKREFS:
        to_model = DOMAIN_KEY_TO_TARGET_MODEL.get(ref_domain)
        if not to_model:
            continue
        from_ct = ContentType.objects.get_for_model(model_cls)
        to_ct = ContentType.objects.get_for_model(to_model)
        for obj in model_cls.objects.all().iterator():
            raw = getattr(obj, field_name, None)
            for tid in _parse_relation_ids(raw, multivalued):
                exists = EntityRef.objects.filter(
                    from_content_type=from_ct,
                    from_object_id=obj.pk,
                    predicate=field_name,
                    to_content_type=to_ct,
                    to_object_id=tid,
                ).exists()
                if not exists:
                    missing.append((model_cls.__name__, field_name, obj.pk, raw))
    return missing


class Command(BaseCommand):
    help = "Rebuild cidoc_data.EntityRef edges from CIDOC_RELATION_BACKREFS CharField columns."

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Exit 1 if any CharField relation values lack a matching EntityRef row (CI mode).",
        )

    def handle(self, *args, **options):
        if options["check"]:
            missing = _check_consistency()
            if missing:
                self.stderr.write(
                    self.style.ERROR(
                        f"EntityRef inconsistencies found: {len(missing)} missing edge(s)."
                    )
                )
                for model, field, pk, raw in missing[:20]:
                    self.stderr.write(f"  {model}.{field} pk={pk} raw={raw!r}")
                raise CommandError("Run `make entityrefs` to fix.")
            self.stdout.write(self.style.SUCCESS("OK: all CharField relation values have EntityRef rows."))
            return

        n = backfill_entityrefs_from_legacy_columns()
        self.stdout.write(self.style.SUCCESS(f"EntityRef rows created (new): {n}"))
