"""The provenance audit measures honestly and its repairs are reversible."""

import json
import tempfile
from pathlib import Path

from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.management.commands.audit_provenance import (
    backfill_wikidata,
    measure,
    restore,
    withdraw,
)
from apps.cidoc_data.models import (
    DataSource,
    Deity,
    EntityCluster,
    HeritageAssertion,
    Tradition,
)
from apps.heritage_data.models import CulturalEntity
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase, override_settings


@override_settings(RDF_SYNC_ENABLED=False)
class AuditProvenanceTest(TestCase):
    def setUp(self):
        self.wikidata = DataSource.objects.create(name="Wikidata", source_type="web")
        self.imported = Deity.objects.create(
            name="Vishnu",
            status="accepted",
            contributor="wikidata_import",
            source=self.wikidata,
            source_citation=(
                "Wikidata Q11380 (revision 1), retrieved 2026-10-25, CC0 1.0."
            ),
        )
        self.seed = Deity.objects.create(name="Seeded", status="accepted")
        self.sourced = Tradition.objects.create(
            name="Shaivism", status="accepted", source_citation="A book."
        )
        ct = ContentType.objects.get_for_model(Deity)
        self.membership = HeritageAssertion.objects.create(
            confidence="certain",
            content_type=ct,
            object_id=self.imported.pk,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            entity_cluster=EntityCluster.objects.create(
                canonical_label="Vishnu", type_scope="deity"
            ),
            reconciliation_status="accepted",
            contributed_by="wikidata_import",
        )
        self.claim = HeritageAssertion.objects.create(
            confidence="certain",
            content_type=ct,
            object_id=self.seed.pk,
            asserted_property="note",
            asserted_value="Seed claim",
            reconciliation_status="accepted",
            contributed_by="seed_db",
        )

    def test_measure_separates_records_claims_and_bookkeeping(self):
        m = measure()
        self.assertEqual(m["records"]["published"], 3)
        self.assertEqual(m["records"]["with_source"], 2)
        self.assertEqual(
            m["records"]["unsourced_by_origin"], {"seed data (no contributor)": 1}
        )
        self.assertEqual(
            m["claims"],
            {
                "accepted": 1,
                "with_registered_source": 0,
                "unsourced_by_contributor": {"seed_db": 1},
            },
        )
        self.assertEqual(m["identity_bookkeeping"]["wikidata_without_source"], 1)

    def test_backfill_cites_the_records_own_wikidata_source(self):
        self.assertEqual(backfill_wikidata(), 1)
        self.membership.refresh_from_db()
        self.assertEqual(self.membership.source, self.wikidata)
        self.assertEqual(self.membership.source_citation, "Wikidata item Q11380.")
        self.assertEqual(backfill_wikidata(), 0)

    def test_withdraw_then_restore_is_exact(self):
        manifest = Path(tempfile.mkdtemp()) / "m.json"
        curator = get_user_model().objects.create_user(
            username="curator", email="cu@example.com"
        )
        done = withdraw(manifest, curator)
        self.assertEqual(done, {"records": 1, "claims": 1})
        self.seed.refresh_from_db()
        self.claim.refresh_from_db()
        self.assertEqual(self.seed.status, "pending_review")
        self.assertEqual(self.claim.reconciliation_status, "pending")
        wrapper = CulturalEntity.objects.get(cidoc_object_id=self.seed.pk)
        self.assertEqual(wrapper.status, "pending_review")
        # Sourced records are untouched.
        self.imported.refresh_from_db()
        self.assertEqual(self.imported.status, "accepted")
        self.assertEqual(len(json.loads(manifest.read_text())["records"]), 1)

        restore(manifest)
        self.seed.refresh_from_db()
        self.claim.refresh_from_db()
        self.assertEqual(self.seed.status, "accepted")
        self.assertEqual(self.claim.reconciliation_status, "accepted")
        self.assertFalse(
            CulturalEntity.objects.filter(cidoc_object_id=self.seed.pk).exists()
        )


@override_settings(RDF_SYNC_ENABLED=False)
class AuditAddedValueTest(TestCase):
    def test_beyond_wikidata_and_confidence_basis(self):
        wd = DataSource.objects.create(name="Wikidata", source_type="web")
        imported = Deity.objects.create(
            name="Vishnu", status="accepted", contributor="wikidata_import", source=wd
        )
        ours = Deity.objects.create(
            name="Local deity",
            status="accepted",
            contributor="author",
            source_citation="Field notes.",
        )
        ct = ContentType.objects.get_for_model(Deity)
        for subject, who, conf in (
            (imported, "wikidata_import", "likely"),
            (ours, "author", "certain"),
        ):
            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=subject.pk,
                asserted_property="note",
                asserted_value="x",
                source=wd,
                reconciliation_status="accepted",
                contributed_by=who,
                confidence=conf,
            )
        m = measure()
        self.assertEqual(m["beyond_wikidata"]["records"], 1)
        self.assertEqual(m["beyond_wikidata"]["claims"], 1)
        self.assertEqual(m["beyond_wikidata"]["claims_share"], 0.5)
        self.assertEqual(m["confidence_basis"]["stated_by_contributor"], {"certain": 1})
        self.assertEqual(m["confidence_basis"]["assigned_by_policy"], {"likely": 1})
