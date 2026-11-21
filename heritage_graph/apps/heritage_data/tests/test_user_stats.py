"""Contributor dashboard statistics must be measured, never assumed.

These tests exist because the dashboard previously shipped two hardcoded
constants (`rank_change = 2`, `impact_score_change = 0.3`) that were rendered to
every user as if they were measured trends. The rules asserted here:

1. A quantity with no basis in the data is null, not a default.
2. `merged` is a successful review outcome and counts toward the approval rate.
3. Drafts are not submissions.
4. Rank movement is only reported when an earlier snapshot exists to measure
   against.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.heritage_data.tests.test_user_stats -v2
"""

from datetime import date

from apps.heritage_data.models import (
    CulturalEntity,
    UserProfile,
    UserStats,
    UserStatsSnapshot,
)
from apps.heritage_data.signals import refresh_user_stats
from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


def _entity(user, *, status, name="Test entity"):
    return CulturalEntity.objects.create(
        name=name,
        description="fixture",
        category="monument",
        status=status,
        contributor=user,
    )


class UserStatsHonestyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="contributor", email="c@example.org", password="x"
        )

    def _stats(self):
        refresh_user_stats(self.user)
        return UserStats.objects.get(user=self.user)

    def test_new_contributor_has_no_invented_numbers(self):
        """Nothing has happened yet, so nothing is reported as having happened."""
        stats = self._stats()

        self.assertEqual(stats.total_submissions, 0)
        self.assertEqual(stats.total_reviewed, 0)
        self.assertIsNone(stats.approval_rate)
        self.assertIsNone(stats.approval_rate_change)
        self.assertIsNone(stats.submissions_growth)
        self.assertIsNone(stats.rank_change)

    def test_growth_is_null_rather_than_100_percent_from_zero(self):
        """0 -> n is an undefined percent change, not a 100% increase."""
        _entity(self.user, status="pending_review")

        self.assertIsNone(self._stats().submissions_growth)

    def test_merged_counts_as_accepted(self):
        """`merged` is how a project-flow contribution succeeds."""
        _entity(self.user, status="merged", name="Merged")
        _entity(self.user, status="accepted", name="Accepted")
        _entity(self.user, status="rejected", name="Rejected")

        stats = self._stats()

        self.assertEqual(stats.total_reviewed, 3)
        self.assertEqual(stats.accepted_count, 2)
        self.assertAlmostEqual(stats.approval_rate, 200 / 3, places=4)

    def test_drafts_are_not_submissions(self):
        _entity(self.user, status="draft", name="Draft")
        _entity(self.user, status="pending_review", name="Submitted")

        self.assertEqual(self._stats().total_submissions, 1)

    def test_undecided_statuses_stay_out_of_the_approval_rate(self):
        """pending_revision and superseded are not review decisions."""
        _entity(self.user, status="pending_revision", name="Revising")
        _entity(self.user, status="superseded", name="Superseded")
        _entity(self.user, status="accepted", name="Accepted")

        stats = self._stats()

        self.assertEqual(stats.total_reviewed, 1)
        self.assertEqual(stats.approval_rate, 100.0)

    def test_rank_change_requires_an_earlier_snapshot(self):
        UserProfile.objects.update_or_create(user=self.user, defaults={"score": 10})

        self.assertIsNone(self._stats().rank_change)

    def test_rank_change_is_measured_against_the_snapshot(self):
        UserProfile.objects.update_or_create(user=self.user, defaults={"score": 10})
        rival = User.objects.create_user(
            username="rival", email="r@example.org", password="x"
        )
        UserProfile.objects.update_or_create(user=rival, defaults={"score": 99})

        # The user currently sits second behind `rival`.
        self.assertEqual(self._stats().contributor_rank, 2)

        UserStatsSnapshot.objects.create(
            user=self.user,
            period=date(2026, 7, 1),
            total_submissions=0,
            contributor_rank=5,
            approval_rate=None,
        )

        # Measured movement: 5th previously, 2nd now => gained 3 places.
        self.assertEqual(self._stats().rank_change, 3)

    def test_contributor_rank_is_null_without_a_profile(self):
        self.assertIsNone(self._stats().contributor_rank)


class UserStatsApiTests(TestCase):
    """The API must pass nulls through rather than coercing them to zero."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="apiuser", email="a@example.org", password="x"
        )
        self.client.force_login(self.user)

    def test_unmeasured_fields_serialize_as_null(self):
        response = self.client.get("/data/api/user-stats/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNone(payload["approval_rate"])
        self.assertIsNone(payload["rank_change"])
        self.assertIsNone(payload["submissions_growth"])
        self.assertNotIn("community_impact_score", payload)
        self.assertNotIn("impact_score_change", payload)
