"""Measure, and optionally repair, the evidence behind the public graph.

Three kinds of published statement, counted separately because they mean
different things:

* records -- a published CIDOC row; evidence is ``source`` or ``source_citation``;
* claims -- accepted ``relationship.*`` and slot assertions; evidence is a
  registered DataSource;
* identity bookkeeping -- ``identity.*`` memberships written by clustering;
  they say which records are the same, not anything about heritage.

Repairs, each opt-in and none of them inventing evidence:

``--backfill-wikidata``
    Cluster memberships written by the Wikidata importer cite the Wikidata
    DataSource that the imported record itself cites.

``--withdraw`` (with ``--manifest PATH`` and ``--as USERNAME``)
    Unsourced records go back to review (status ``pending_review`` with a review
    wrapper, so curators can add a source and accept them again); unsourced
    claims go back to ``pending``. Both leave the public graph. Every change is
    written to the manifest.

``--restore PATH``
    Undo a ``--withdraw`` exactly, from its manifest.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

PUBLISHED = ("accepted", "merged", "published")
WIKIDATA_CONTRIBUTOR = "wikidata_import"

# Writers whose confidence is a policy, not someone's judgement.
SYSTEM_WRITERS = frozenset(
    {
        WIKIDATA_CONTRIBUTOR,
        "seed_db",
        "bootstrap_identity_clusters",
        "danam_import",
        "kg_test_seed",
    }
)


def _record_models():
    from apps.cidoc_data.models import MetaData

    return [
        m
        for m in apps.get_app_config("cidoc_data").get_models()
        if issubclass(m, MetaData) and m is not MetaData and not m._meta.abstract
    ]


def _unsourced(qs):
    return qs.filter(source__isnull=True, source_citation="")


def _origin(contributor: str | None) -> str:
    c = (contributor or "").strip()
    if c == WIKIDATA_CONTRIBUTOR:
        return "wikidata import"
    if not c:
        return "seed data (no contributor)"
    return "contributed"


def measure() -> dict:
    from apps.cidoc_data.models import HeritageAssertion

    records = Counter()
    unsourced_records = Counter()
    for model in _record_models():
        published = model.objects.filter(status__in=PUBLISHED)
        for contributor in published.values_list("contributor", flat=True):
            records[_origin(contributor)] += 1
        for contributor in _unsourced(published).values_list("contributor", flat=True):
            unsourced_records[_origin(contributor)] += 1

    accepted = HeritageAssertion.objects.filter(reconciliation_status="accepted")
    identity = accepted.filter(asserted_property__startswith="identity.")
    claims = accepted.exclude(asserted_property__startswith="identity.")
    unsourced_claims = Counter(
        (c or "(none)")
        for c in claims.filter(source__isnull=True).values_list(
            "contributed_by", flat=True
        )
    )
    n_records = sum(records.values())
    n_unsourced = sum(unsourced_records.values())
    return {
        "records": {
            "published": n_records,
            "with_source": n_records - n_unsourced,
            "coverage": round((n_records - n_unsourced) / n_records, 4)
            if n_records
            else None,
            "published_by_origin": dict(records),
            "unsourced_by_origin": dict(unsourced_records),
        },
        "claims": {
            "accepted": claims.count(),
            "with_registered_source": claims.filter(source__isnull=False).count(),
            "unsourced_by_contributor": dict(unsourced_claims),
        },
        "identity_bookkeeping": {
            "accepted": identity.count(),
            "with_registered_source": identity.filter(source__isnull=False).count(),
            "wikidata_without_source": identity.filter(
                contributed_by=WIKIDATA_CONTRIBUTOR, source__isnull=True
            ).count(),
            **_identity_resolution(),
        },
        "beyond_wikidata": {
            # The share of the graph that Wikidata does not already hold: the
            # platform's own contribution, as opposed to restructured import.
            "records": n_records - records.get("wikidata import", 0),
            "records_share": round(
                (n_records - records.get("wikidata import", 0)) / n_records, 4
            )
            if n_records
            else None,
            "claims": claims.exclude(contributed_by=WIKIDATA_CONTRIBUTOR).count(),
            "claims_share": round(
                claims.exclude(contributed_by=WIKIDATA_CONTRIBUTOR).count()
                / claims.count(),
                4,
            )
            if claims.count()
            else None,
        },
        "confidence_basis": {
            # A confidence a person stated is evidence about the claim; one an
            # importer assigned is an editorial default. Analyses must not mix them.
            "stated_by_contributor": dict(
                Counter(
                    claims.exclude(contributed_by__in=SYSTEM_WRITERS)
                    .exclude(contributed_by__startswith="system-")
                    .values_list("confidence", flat=True)
                )
            ),
            "assigned_by_policy": dict(
                Counter(
                    claims.filter(
                        Q(contributed_by__in=SYSTEM_WRITERS)
                        | Q(contributed_by__startswith="system-")
                    ).values_list("confidence", flat=True)
                )
            ),
        },
    }


def _identity_resolution() -> dict:
    """How identity clustering stands: singletons, merges and competing clusters."""
    from apps.cidoc_data.models import HeritageAssertion

    rows = HeritageAssertion.objects.filter(asserted_property__startswith="identity.")
    accepted = rows.filter(
        reconciliation_status="accepted", entity_cluster__isnull=False
    )
    members = Counter(accepted.values_list("entity_cluster_id", flat=True))
    per_record = Counter(accepted.values_list("content_type_id", "object_id"))
    return {
        "clusters": len(members),
        "singleton_clusters": sum(1 for n in members.values() if n == 1),
        "multi_member_clusters": sum(1 for n in members.values() if n > 1),
        "records_in_competing_clusters": sum(1 for n in per_record.values() if n > 1),
        "superseded_memberships": rows.filter(
            reconciliation_status="superseded"
        ).count(),
        "by_writer": dict(Counter(accepted.values_list("contributed_by", flat=True))),
    }


def backfill_wikidata() -> int:
    """Point Wikidata cluster memberships at the DataSource their record cites."""
    from apps.cidoc_data.models import HeritageAssertion

    fixed = 0
    rows = HeritageAssertion.objects.filter(
        contributed_by=WIKIDATA_CONTRIBUTOR,
        asserted_property__startswith="identity.",
        source__isnull=True,
    ).select_related("content_type")
    for ha in rows:
        model = ha.content_type.model_class()
        record = (
            model._default_manager.filter(pk=ha.object_id).first() if model else None
        )
        source = getattr(record, "source", None)
        if source is None:
            continue
        qid = (
            (record.source_citation or "").split(" ")[1]
            if (record.source_citation or "").startswith("Wikidata ")
            else ""
        )
        ha.source = source
        if not ha.source_citation and qid:
            ha.source_citation = f"Wikidata item {qid}."
        ha.save(update_fields=["source", "source_citation", "updated_at"])
        fixed += 1
    return fixed


def withdraw(manifest_path: Path, actor) -> dict:
    """Send unsourced records and claims back to review; record every change."""
    from apps.cidoc_data.models import HeritageAssertion
    from apps.heritage_data.models import Activity, CulturalEntity, Revision

    manifest: dict = {"records": [], "claims": []}
    with transaction.atomic():
        for model in _record_models():
            ct = ContentType.objects.get_for_model(model)
            for record in _unsourced(model.objects.filter(status__in=PUBLISHED)):
                wrapper = CulturalEntity.objects.filter(
                    cidoc_content_type=ct, cidoc_object_id=record.pk
                ).first()
                entry = {
                    "model": f"{ct.app_label}.{ct.model}",
                    "pk": record.pk,
                    "status": record.status,
                    "wrapper": str(wrapper.entity_id) if wrapper else None,
                    "wrapper_status": wrapper.status if wrapper else None,
                }
                record.status = "pending_review"
                record.save(update_fields=["status"])
                label = (
                    getattr(record, "name", None)
                    or getattr(record, "title", "")
                    or str(record)
                )
                note = "Withdrawn from publication: the record names no source."
                if wrapper is None:
                    from apps.cidoc_data.views import _get_category_for_model

                    wrapper = CulturalEntity.objects.create(
                        name=label[:255],
                        description=getattr(record, "description", "") or "",
                        category=_get_category_for_model(model),
                        status="pending_review",
                        contributor=actor,
                        cidoc_content_type=ct,
                        cidoc_object_id=record.pk,
                    )
                    rev = Revision.objects.create(
                        entity=wrapper,
                        revision_number=1,
                        created_by=actor,
                        data={
                            "name": label,
                            "_cidoc_model": model.__name__,
                            "_cidoc_id": record.pk,
                        },
                    )
                    wrapper.current_revision = rev
                    wrapper.save(update_fields=["current_revision"])
                    entry["created_wrapper"] = str(wrapper.entity_id)
                else:
                    wrapper.status = "pending_review"
                    wrapper.save(update_fields=["status"])
                Activity.objects.create(
                    entity=wrapper,
                    user=actor,
                    activity_type="changes_requested",
                    comment=note,
                )
                manifest["records"].append(entry)

        claims = HeritageAssertion.objects.filter(
            reconciliation_status="accepted", source__isnull=True
        ).exclude(asserted_property__startswith="identity.")
        for ha in claims:
            manifest["claims"].append(
                {"pk": str(ha.pk), "status": ha.reconciliation_status}
            )
            ha.reconciliation_status = "pending"
            ha.save(update_fields=["reconciliation_status", "updated_at"])

    manifest_path.write_text(json.dumps(manifest, indent=1))
    return {"records": len(manifest["records"]), "claims": len(manifest["claims"])}


def restore(manifest_path: Path) -> dict:
    from apps.cidoc_data.models import HeritageAssertion
    from apps.heritage_data.models import CulturalEntity

    manifest = json.loads(manifest_path.read_text())
    with transaction.atomic():
        for entry in manifest["records"]:
            app_label, model_name = entry["model"].split(".")
            model = ContentType.objects.get_by_natural_key(
                app_label, model_name
            ).model_class()
            record = model._default_manager.filter(pk=entry["pk"]).first()
            if record is not None:
                record.status = entry["status"]
                record.save(update_fields=["status"])
            if entry.get("created_wrapper"):
                CulturalEntity.objects.filter(pk=entry["created_wrapper"]).delete()
            elif entry.get("wrapper"):
                CulturalEntity.objects.filter(pk=entry["wrapper"]).update(
                    status=entry["wrapper_status"]
                )
        for entry in manifest["claims"]:
            ha = HeritageAssertion.objects.filter(pk=entry["pk"]).first()
            if ha is not None:
                ha.reconciliation_status = entry["status"]
                ha.save(update_fields=["reconciliation_status", "updated_at"])
    return {"records": len(manifest["records"]), "claims": len(manifest["claims"])}


class Command(BaseCommand):
    help = "Measure the evidence behind the public graph; optionally repair it."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json", action="store_true", help="Print the measurement as JSON."
        )
        parser.add_argument("--backfill-wikidata", action="store_true")
        parser.add_argument("--withdraw", action="store_true")
        parser.add_argument("--manifest", type=Path)
        parser.add_argument("--restore", type=Path)
        parser.add_argument(
            "--as", dest="actor", help="Username the withdrawal is recorded under."
        )

    def handle(self, *args, **opts):
        if opts["restore"]:
            done = restore(opts["restore"])
            self.stdout.write(
                f"restored {done['records']} records, {done['claims']} claims"
            )
            return
        if opts["backfill_wikidata"]:
            self.stdout.write(
                f"wikidata memberships given a source: {backfill_wikidata()}"
            )
        if opts["withdraw"]:
            if not opts["manifest"] or not opts["actor"]:
                raise CommandError(
                    "--withdraw needs --manifest PATH (for --restore) and --as USERNAME"
                )
            from django.contrib.auth import get_user_model

            actor = get_user_model().objects.filter(username=opts["actor"]).first()
            if actor is None:
                raise CommandError(f"No user {opts['actor']!r}")
            done = withdraw(opts["manifest"], actor)
            self.stdout.write(
                f"withdrew {done['records']} records and {done['claims']} claims; "
                f"manifest: {opts['manifest']}"
            )
        report = measure()
        if opts["json"]:
            self.stdout.write(json.dumps(report, indent=2))
            return
        r, c, i = report["records"], report["claims"], report["identity_bookkeeping"]
        self.stdout.write(
            f"Published records with a source: {r['with_source']}/{r['published']}"
            f" ({(r['coverage'] or 0):.0%})"
        )
        for origin, n in sorted(r["unsourced_by_origin"].items()):
            self.stdout.write(f"  unsourced, {origin}: {n}")
        self.stdout.write(
            f"Accepted claims citing a registered source: "
            f"{c['with_registered_source']}/{c['accepted']}"
        )
        for who, n in sorted(c["unsourced_by_contributor"].items()):
            self.stdout.write(f"  unsourced, contributed by {who}: {n}")
        self.stdout.write(
            f"Identity bookkeeping (not claims about heritage): {i['accepted']}, "
            f"of which Wikidata without source: {i['wikidata_without_source']}"
        )
        self.stdout.write(
            f"  clusters {i['clusters']} ({i['singleton_clusters']} singletons, "
            f"{i['multi_member_clusters']} with several records); records in "
            f"competing clusters: {i['records_in_competing_clusters']}; superseded "
            f"memberships: {i['superseded_memberships']}"
        )
        b, cb = report["beyond_wikidata"], report["confidence_basis"]
        self.stdout.write(
            f"Beyond Wikidata: {b['records']} records "
            f"({(b['records_share'] or 0):.0%}), "
            f"{b['claims']} claims ({(b['claims_share'] or 0):.0%})"
        )
        self.stdout.write(
            "Confidence stated by contributors: "
            f"{cb['stated_by_contributor'] or 'none'}; "
            f"assigned by import policy: {cb['assigned_by_policy'] or 'none'}"
        )
