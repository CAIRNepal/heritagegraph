"""Pipeline de-fragmentation tests (Phases 0–4).

Covers the invariants the unified contribution pipeline must guarantee:

- Phase 0: published records never vanish or change during re-review;
  rejecting a staged edit preserves the accepted content; accepting applies it.
- Phase 1: one canonical status vocabulary + legal-transition enforcement.
- Phase 2: QR/public contributions promote into the structured pipeline and
  reach the graph through the same accept gate.
- Phase 4: the legacy flat-field Submission write path is retired (410).

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.cidoc_data.test_pipeline_phases -v2
"""

import tempfile

from apps.cidoc_data.canonical_status import can_transition, to_canonical_status
from apps.cidoc_data.models import (
    ArchitecturalStructure,
    Location,
    Monument,
    Person,
)
from apps.graph.kg_engine import get_kg_engine
from apps.graph.kg_engine.uris import resource_uri_for_instance
from apps.heritage_data.models import (
    CulturalEntity,
    IllegalStatusTransition,
    PublicContribution,
)
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

_TMP_STORE = tempfile.mkdtemp(prefix="hg_phases_oxigraph_")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",  # embedded pyoxigraph
    RDF_QUERY_URL="",
)
class PublishedEditLifecycleTest(APITestCase):
    """Phase 0: the accepted lineage stays published through edit → re-review."""

    def setUp(self):
        self.contributor = User.objects.create_user(
            username="contributor", email="c@example.com", password="pw"
        )
        self.reviewer = User.objects.create_user(
            username="reviewer", email="r@example.com", password="pw", is_staff=True
        )
        self.client.force_authenticate(user=self.contributor)
        self.engine = get_kg_engine()

    def _wrapper_for(self, instance):
        ct = ContentType.objects.get_for_model(type(instance))
        return CulturalEntity.objects.get(
            cidoc_content_type=ct, cidoc_object_id=instance.pk
        )

    def _labels_in_graph(self, uri):
        return {
            e.get("value")
            for e in self.engine.neighborhood(uri)
            if e.get("predicate", "").endswith("label")
        }

    def test_edit_review_cycle_never_unpublishes(self):
        # Submit and accept (publish).
        resp = self.client.post(
            "/api/v1/cidoc/persons/",
            {"name": "King Bhupatindra Malla", "description": "Original."},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        person = Person.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(person)
        self.assertEqual(wrapper.status, "pending_review")

        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")
        person.refresh_from_db()
        wrapper.refresh_from_db()
        self.assertEqual(person.status, "accepted")
        self.assertIsNotNone(wrapper.accepted_revision)

        uri = resource_uri_for_instance(person)
        self.assertIn("King Bhupatindra Malla", self._labels_in_graph(uri))

        # Edit the published record: the row must NOT change and the graph
        # must keep serving the accepted content while review is pending.
        with self.captureOnCommitCallbacks(execute=True):
            patch = self.client.patch(
                f"/api/v1/cidoc/persons/{person.pk}/",
                {"name": "King Bhupatindra Malla (revised)"},
                format="json",
            )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.content)
        self.assertEqual(
            patch.json()["name"], "King Bhupatindra Malla (revised)"
        )  # response shows the proposal

        person.refresh_from_db()
        wrapper.refresh_from_db()
        self.assertEqual(person.name, "King Bhupatindra Malla")  # row untouched
        self.assertEqual(person.status, "accepted")  # still published
        self.assertEqual(wrapper.status, "pending_review")  # proposal queued
        self.assertIn("King Bhupatindra Malla", self._labels_in_graph(uri))
        self.assertNotIn(
            "King Bhupatindra Malla (revised)", self._labels_in_graph(uri)
        )

        # Reject the staged edit: accepted content survives, wrapper restored.
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.reject_contribution(self.reviewer, "not verifiable")
        person.refresh_from_db()
        wrapper.refresh_from_db()
        self.assertEqual(person.name, "King Bhupatindra Malla")
        self.assertEqual(person.status, "accepted")
        self.assertEqual(wrapper.status, "accepted")
        self.assertEqual(wrapper.current_revision_id, wrapper.accepted_revision_id)
        self.assertIn("King Bhupatindra Malla", self._labels_in_graph(uri))

        # Propose again and accept: the edit is applied and projected.
        with self.captureOnCommitCallbacks(execute=True):
            patch = self.client.patch(
                f"/api/v1/cidoc/persons/{person.pk}/",
                {"name": "Bhupatindra Malla of Bhaktapur"},
                format="json",
            )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.content)
        wrapper.refresh_from_db()
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "verified")
        person.refresh_from_db()
        self.assertEqual(person.name, "Bhupatindra Malla of Bhaktapur")
        self.assertEqual(person.status, "accepted")
        self.assertIn("Bhupatindra Malla of Bhaktapur", self._labels_in_graph(uri))

    def test_reaccept_after_rejected_edit_does_not_resurrect_proposal(self):
        """Accept must apply current_revision (what the reviewer sees), never
        a newer rejected proposal lingering as the latest revision."""
        resp = self.client.post(
            "/api/v1/cidoc/persons/",
            {"name": "Stable Person", "description": "Original."},
            format="json",
        )
        person = Person.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(person)
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")

        # Stage a rename, then reject it.
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(
                f"/api/v1/cidoc/persons/{person.pk}/",
                {"name": "Rejected Rename"},
                format="json",
            )
        wrapper.refresh_from_db()
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.reject_contribution(self.reviewer, "no")

        # Idempotent re-accept of the (restored) accepted wrapper must keep
        # the accepted content — not publish the rejected proposal.
        wrapper.refresh_from_db()
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "re-confirm")
        person.refresh_from_db()
        self.assertEqual(person.name, "Stable Person")
        uri = resource_uri_for_instance(person)
        self.assertIn("Stable Person", self._labels_in_graph(uri))
        self.assertNotIn("Rejected Rename", self._labels_in_graph(uri))

    def test_accept_syncs_wrapper_display_fields(self):
        """Accepting a staged rename updates the wrapper's name/description so
        queues and My Contributions don't show stale labels."""
        resp = self.client.post(
            "/api/v1/cidoc/persons/",
            {"name": "Old Label", "description": "Old desc."},
            format="json",
        )
        person = Person.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(person)
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(
                f"/api/v1/cidoc/persons/{person.pk}/",
                {"name": "New Label", "description": "New desc."},
                format="json",
            )
        wrapper.refresh_from_db()
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "verified")
        wrapper.refresh_from_db()
        person.refresh_from_db()
        self.assertEqual(person.name, "New Label")
        self.assertEqual(wrapper.name, "New Label")
        self.assertEqual(wrapper.description, "New desc.")

    def test_accept_applies_nested_foreign_key_representation(self):
        """A record whose FK serializes as a nested object must stay approvable.

        Revisions store the serializer's read representation, and several
        serializers render a foreign key as ``{"id", "name"}`` for the UI.
        Applying that dict straight onto the ``_id`` column raised TypeError,
        so every record with a populated FK 500'd on accept.
        """
        location = Location.objects.create(
            name="Patan Durbar Square", type="temple", current_status="preserved"
        )
        resp = self.client.post(
            "/api/v1/cidoc/structures/",
            {
                "name": "Krishna Mandir",
                "structure_type": "Temple",
                "has_current_location": location.pk,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        structure = ArchitecturalStructure.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(structure)

        # The revision really does carry the nested form this guards against.
        self.assertIsInstance(
            wrapper.current_revision.data.get("has_current_location"), dict
        )

        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")

        structure.refresh_from_db()
        self.assertEqual(structure.status, "accepted")
        self.assertEqual(structure.has_current_location_id, location.pk)

    def test_curator_withdrawal_unpublishes(self):
        resp = self.client.post(
            "/api/v1/cidoc/persons/",
            {"name": "Withdrawable Person", "description": "tmp"},
            format="json",
        )
        person = Person.objects.get(pk=resp.json()["id"])
        wrapper = self._wrapper_for(person)
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "ok")
        uri = resource_uri_for_instance(person)
        self.assertIn("Withdrawable Person", self._labels_in_graph(uri))

        # No pending edit: rejecting an accepted wrapper is a withdrawal.
        wrapper.refresh_from_db()
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.reject_contribution(self.reviewer, "community request")
        person.refresh_from_db()
        self.assertEqual(person.status, "rejected")
        self.assertEqual(self._labels_in_graph(uri), set())


class CanonicalStatusTest(APITestCase):
    """Phase 1: one vocabulary, explicit state machine."""

    def test_legacy_values_map_to_canonical(self):
        self.assertEqual(to_canonical_status("approved"), "accepted")
        self.assertEqual(to_canonical_status("incorporated"), "accepted")
        self.assertEqual(to_canonical_status("merged"), "accepted")
        self.assertEqual(to_canonical_status("published"), "accepted")
        self.assertEqual(to_canonical_status("pending"), "pending_review")
        self.assertEqual(to_canonical_status("pending_revision"), "pending_review")
        self.assertIsNone(to_canonical_status(None))
        self.assertIsNone(to_canonical_status("  "))  # legacy curated corpus

    def test_unknown_status_is_withheld(self):
        """Default-deny: an out-of-vocabulary status must never publish."""
        from apps.cidoc_data.canonical_status import UNKNOWN_STATUS
        from apps.cidoc_data.publication_policy import is_published_for_rdf

        self.assertEqual(to_canonical_status("aproved"), UNKNOWN_STATUS)

        class Row:
            status = "embargoed"

        self.assertFalse(is_published_for_rdf(Row()))

        class LegacyRow:
            status = None

        self.assertTrue(is_published_for_rdf(LegacyRow()))
        # Recovery: a curator may still moderate an unknown-status row.
        self.assertTrue(can_transition("embargoed", "accepted"))
        self.assertTrue(can_transition("embargoed", "rejected"))

    def test_transition_table(self):
        self.assertTrue(can_transition("pending_review", "accepted"))
        self.assertTrue(can_transition("accepted", "pending_review"))  # re-review
        self.assertTrue(can_transition("accepted", "rejected"))  # withdrawal
        self.assertTrue(can_transition("accepted", "accepted"))  # idempotent
        self.assertFalse(can_transition("superseded", "accepted"))
        self.assertFalse(can_transition("pending_review", "superseded"))

    def test_illegal_decision_raises(self):
        user = User.objects.create_user(username="u1", email="u@e.com", password="pw")
        entity = CulturalEntity.objects.create(
            name="Frozen",
            description="d",
            category="other",
            status="superseded",
            contributor=user,
        )
        with self.assertRaises(IllegalStatusTransition):
            entity.accept_contribution(user, "no")

    def test_revise_after_changes_requested(self):
        """The My Contributions "Revise" flow: a changes-requested
        (pending_revision) entity accepts a new revision via the API."""
        user = User.objects.create_user(username="u2", email="u2@e.com", password="pw")
        entity = CulturalEntity.objects.create(
            name="Needs work",
            description="d",
            category="other",
            status="pending_revision",
            contributor=user,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post(
            f"/api/v1/data/cultural-entities/{entity.entity_id}/create_revision/",
            {"data": {"name": "Needs work", "description": "reworked"}},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        entity.refresh_from_db()
        self.assertEqual(entity.revisions.count(), 1)
        # Still awaiting review (the queue includes pending_revision rows).
        self.assertEqual(entity.status, "pending_revision")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",
    RDF_QUERY_URL="",
)
class QRPromotionTest(APITestCase):
    """Phase 2: a QR note rides the structured pipeline into the graph."""

    def setUp(self):
        self.reviewer = User.objects.create_user(
            username="qr_reviewer", email="q@example.com", password="pw", is_staff=True
        )
        self.engine = get_kg_engine()

    def test_qr_contribution_promotes_and_publishes(self):
        # Anonymous QR submission (AllowAny).
        resp = self.client.post(
            "/api/v1/data/public-contributions/",
            {
                "entity_name": "Nyatapola Temple",
                "contribution_type": "history",
                "content": "Five-storey pagoda built in 1702 by Bhupatindra Malla.",
                "contributor_name": "Field Visitor",
                "submitted_via": "qr_scan",
                "latitude": "27.671402",
                "longitude": "85.429567",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        contribution = PublicContribution.objects.get(pk=resp.json()["id"])

        # Reviewer incorporates with a target CIDOC type → promotion.
        self.client.force_authenticate(user=self.reviewer)
        review = self.client.post(
            f"/api/v1/data/public-contributions/{contribution.pk}/review/",
            {
                "status": "incorporated",
                "review_notes": "Verified on site.",
                "target_type": "Monument",
            },
            format="json",
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK, review.content)
        promoted_entity_id = review.json()["promoted_entity_id"]
        self.assertIsNotNone(promoted_entity_id)

        contribution.refresh_from_db()
        self.assertEqual(contribution.status, "incorporated")
        wrapper = contribution.promoted_entity
        self.assertIsNotNone(wrapper)
        self.assertEqual(str(wrapper.entity_id), promoted_entity_id)
        self.assertEqual(wrapper.status, "pending_review")

        monument = wrapper.cidoc_record
        self.assertIsInstance(monument, Monument)
        self.assertEqual(monument.name, "Nyatapola Temple")
        self.assertEqual(monument.status, "pending_review")

        # Provenance back to the field observation is preserved.
        rev_data = wrapper.current_revision.data
        self.assertEqual(rev_data["_public_contribution_id"], str(contribution.id))
        self.assertEqual(rev_data["_contributor_name"], "Field Visitor")
        self.assertEqual(rev_data["_source"], "qr_scan")

        # Same accept gate → same graph projection as a form submission.
        with self.captureOnCommitCallbacks(execute=True):
            wrapper.accept_contribution(self.reviewer, "verified")
        monument.refresh_from_db()
        self.assertEqual(monument.status, "accepted")
        uri = resource_uri_for_instance(monument)
        labels = {
            e.get("value")
            for e in self.engine.neighborhood(uri)
            if e.get("predicate", "").endswith("label")
        }
        self.assertIn("Nyatapola Temple", labels)

    def test_invalid_target_type_rolls_back_review(self):
        resp = self.client.post(
            "/api/v1/data/public-contributions/",
            {"entity_name": "X", "content": "y", "contribution_type": "other"},
            format="json",
        )
        contribution = PublicContribution.objects.get(pk=resp.json()["id"])
        self.client.force_authenticate(user=self.reviewer)
        review = self.client.post(
            f"/api/v1/data/public-contributions/{contribution.pk}/review/",
            {"status": "incorporated", "target_type": "NotAModel"},
            format="json",
        )
        self.assertEqual(review.status_code, status.HTTP_400_BAD_REQUEST)
        contribution.refresh_from_db()
        self.assertEqual(contribution.status, "pending")  # decision rolled back


class StatusLeakageTest(APITestCase):
    """Security: explicitly requested withheld statuses must never leak."""

    def setUp(self):
        owner = User.objects.create_user(
            username="leak-owner", email="lo@e.com", password="pw"
        )
        self.owner = owner
        Person.objects.create(
            name="Hidden Pending", contributor="leak-owner", status="pending_review"
        )

    def test_anonymous_cannot_list_withheld_status(self):
        resp = self.client.get("/api/v1/cidoc/persons/?status=pending_review")
        body = resp.json()
        rows = body.get("results", body) if isinstance(body, dict) else body
        self.assertEqual(len(rows), 0, rows)

    def test_other_user_cannot_list_withheld_status(self):
        other = User.objects.create_user(
            username="leak-other", email="ot@e.com", password="pw"
        )
        self.client.force_authenticate(user=other)
        resp = self.client.get("/api/v1/cidoc/persons/?status=pending_review")
        body = resp.json()
        rows = body.get("results", body) if isinstance(body, dict) else body
        self.assertEqual(len(rows), 0, rows)

    def test_owner_sees_own_withheld_rows(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get("/api/v1/cidoc/persons/?status=pending_review")
        body = resp.json()
        rows = body.get("results", body) if isinstance(body, dict) else body
        self.assertEqual(len(rows), 1, rows)

    def test_unknown_status_param_does_not_leak_to_anonymous(self):
        Person.objects.create(
            name="Weird Status", contributor="leak-owner", status="embargoed"
        )
        resp = self.client.get("/api/v1/cidoc/persons/?status=embargoed")
        body = resp.json()
        rows = body.get("results", body) if isinstance(body, dict) else body
        self.assertEqual(len(rows), 0, rows)


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",
    RDF_QUERY_URL="",
)
class OutboxStaleReplayTest(APITestCase):
    """RDF integrity: a queued retry must re-check the publication gate."""

    def test_drain_does_not_replay_withdrawn_entity(self):
        from apps.cidoc_data.rdf_entity_projection import _Triple
        from apps.graph.kg_engine import get_kg_engine
        from apps.graph.kg_engine.outbox import drain_pending, triples_to_payload
        from apps.graph.models import RDFSyncOutbox

        engine = get_kg_engine()
        person = Person.objects.create(name="Outbox Person", status="accepted")
        uri = resource_uri_for_instance(person)

        # Simulate a write that failed while the entity was accepted: the
        # stale payload still carries the accepted label.
        label_pred = "http://www.w3.org/2000/01/rdf-schema#label"
        stale = [_Triple(uri, label_pred, None, ("Outbox Person", None))]
        RDFSyncOutbox.objects.create(
            subject_uri=uri,
            operation=RDFSyncOutbox.Operation.REPLACE_SLOT,
            graph_uri="",
            payload={"managed": [label_pred], "triples": triples_to_payload(stale)},
            last_error="simulated failure",
        )

        # The entity is withdrawn before the retry fires.
        Person.objects.filter(pk=person.pk).update(status="rejected")

        ok, failed = drain_pending()
        self.assertEqual(failed, 0)
        labels = {
            e.get("value")
            for e in engine.neighborhood(uri)
            if e.get("predicate", "").endswith("label")
        }
        self.assertEqual(labels, set(), "stale replay published withdrawn entity")


@override_settings(
    OXIGRAPH_STORE_PATH=_TMP_STORE,
    RDF_SYNC_ENABLED=True,
    RDF_ENDPOINT_URL="",
    RDF_QUERY_URL="",
)
class PublishedDeleteGuardTest(APITestCase):
    """Published rows cannot be deleted by contributors (staff only)."""

    def test_contributor_delete_published_forbidden(self):
        user = User.objects.create_user(
            username="del-user", email="d@e.com", password="pw"
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/v1/cidoc/persons/",
            {"name": "Keep Me", "description": "d"},
            format="json",
        )
        pk = resp.json()["id"]
        Person.objects.filter(pk=pk).update(status="accepted")

        denied = self.client.delete(f"/api/v1/cidoc/persons/{pk}/")
        self.assertEqual(denied.status_code, 403)
        self.assertTrue(Person.objects.filter(pk=pk).exists())

        # Unpublished rows remain deletable by their contributor.
        Person.objects.filter(pk=pk).update(status="pending_review")
        with self.captureOnCommitCallbacks(execute=True):
            ok = self.client.delete(f"/api/v1/cidoc/persons/{pk}/")
        self.assertEqual(ok.status_code, 204)


class PromotedDraftEditPermissionTest(APITestCase):
    """A non-staff active reviewer can edit qr:-contributed promoted drafts."""

    def test_reviewer_can_edit_promoted_draft(self):
        from apps.heritage_data.models import ReviewerRole

        reviewer = User.objects.create_user(
            username="qr-rev", email="qr@e.com", password="pw"
        )
        ReviewerRole.objects.create(user=reviewer, role="community_reviewer")
        person = Person.objects.create(
            name="Promoted Elder",
            contributor="qr:Field Visitor",
            status="pending_review",
        )
        self.client.force_authenticate(user=reviewer)
        resp = self.client.patch(
            f"/api/v1/cidoc/persons/{person.pk}/",
            {"description": "Verified on site."},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)

        # An ordinary contributor still cannot.
        rando = User.objects.create_user(
            username="qr-rando", email="rr@e.com", password="pw"
        )
        self.client.force_authenticate(user=rando)
        resp = self.client.patch(
            f"/api/v1/cidoc/persons/{person.pk}/",
            {"description": "vandalism"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


class ProjectionTriplesTest(APITestCase):
    """rdf_entity_projection emits type + label with managed predicates."""

    def test_tripleset_for_person(self):
        from apps.cidoc_data.rdf_entity_projection import (
            tripleset_for_metadata_instance,
        )
        from apps.graph.kg_engine.uris import label_for_instance

        person = Person.objects.create(name="Projection Person", status="accepted")
        triples, managed = tripleset_for_metadata_instance(
            person,
            resource_uri_fn=resource_uri_for_instance,
            label_fn=label_for_instance,
        )
        preds = {t.pred for t in triples}
        self.assertIn("http://www.w3.org/2000/01/rdf-schema#label", preds)
        self.assertTrue(
            any(p.endswith("type") for p in preds),
            f"rdf:type missing from projection: {preds}",
        )
        label_values = {
            t.literal[0] for t in triples if t.pred.endswith("label") and t.literal
        }
        self.assertIn("Projection Person", label_values)
        self.assertIn("http://www.w3.org/2000/01/rdf-schema#label", managed)


class LegacySubmissionRetiredTest(APITestCase):
    """Phase 4: the flat-field Submission write path returns 410 Gone."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="legacy", email="l@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def test_write_paths_are_gone(self):
        for url in (
            "/api/v1/data/submissions/",
            "/api/v1/data/form-submit/",
            "/api/v1/data/api/form-submit/",
        ):
            resp = self.client.post(url, {"title": "x"}, format="json")
            self.assertEqual(
                resp.status_code, status.HTTP_410_GONE, f"{url} -> {resp.status_code}"
            )

    def test_archive_remains_readable(self):
        resp = self.client.get("/api/v1/data/submissions/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
