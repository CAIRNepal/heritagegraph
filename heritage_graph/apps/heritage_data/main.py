# heritage/tests/test_models.py

from uuid import UUID

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from models import (
    Comment,
    FormSubmission,
    FormVersion,
    Notification,
    StatusTransition,
    SubmissionTag,
    Tag,
)


class FormSubmissionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reviewer", password="pass")
        self.submitter = User.objects.create_user(username="submitter", password="pass")

    def test_create_submission(self):
        submission = FormSubmission.objects.create(
            title="Machu Picchu",
            heritage_type="tangible",
            status="submitted",
            assigned_reviewer=self.user,
        )
        self.assertIsInstance(submission.id, UUID)
        self.assertEqual(submission.title, "Machu Picchu")
        self.assertEqual(submission.status, "submitted")
        self.assertIsNotNone(submission.created_at)
        self.assertLessEqual(submission.created_at, timezone.now())

    def test_default_status(self):
        submission = FormSubmission.objects.create(
            title="Great Barrier Reef", heritage_type="natural"
        )
        self.assertEqual(submission.status, "submitted")

    def test_string_representation(self):
        submission = FormSubmission.objects.create(
            title="Opera Singing", heritage_type="intangible"
        )
        self.assertEqual(str(submission), "Opera Singing [Intangible Heritage]")


class FormVersionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="author", password="pass")
        self.submission = FormSubmission.objects.create(
            title="Angkor Wat", heritage_type="tangible"
        )

    def test_create_version(self):
        version = FormVersion.objects.create(
            submission=self.submission,
            data={"description": "Temple complex in Cambodia", "location": "Siem Reap"},
            created_by=self.user,
        )
        self.assertEqual(version.version_number, 1)
        self.assertEqual(version.data["location"], "Siem Reap")

    def test_auto_increment_version_number(self):
        FormVersion.objects.create(
            submission=self.submission, created_by=self.user
        )  # v1
        v2 = FormVersion.objects.create(
            submission=self.submission, created_by=self.user
        )
        self.assertEqual(v2.version_number, 2)

    def test_unique_version_per_submission(self):
        FormVersion.objects.create(submission=self.submission, created_by=self.user)
        FormVersion.objects.create(submission=self.submission, created_by=self.user)
        versions = FormVersion.objects.filter(submission=self.submission)
        version_numbers = [v.version_number for v in versions]
        self.assertEqual(version_numbers, [2, 1])  # descending due to ordering

    def test_string_representation(self):
        version = FormVersion.objects.create(
            submission=self.submission, created_by=self.user, version_number=1
        )
        self.assertEqual(str(version), "v1 | Angkor Wat")


class CommentModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="commenter", password="pass")
        self.submission = FormSubmission.objects.create(
            title="Flamenco", heritage_type="intangible"
        )

    def test_create_comment(self):
        comment = Comment.objects.create(
            submission=self.submission,
            author=self.user,
            content="This is a beautiful cultural expression.",
        )
        self.assertEqual(comment.content, "This is a beautiful cultural expression.")
        self.assertEqual(comment.author, self.user)
        self.assertIsNone(comment.parent)

    def test_reply_to_comment(self):
        parent = Comment.objects.create(
            submission=self.submission, author=self.user, content="Nice!"
        )
        reply = Comment.objects.create(
            submission=self.submission,
            author=self.user,
            content="Thanks!",
            parent=parent,
        )
        self.assertEqual(reply.parent, parent)
        self.assertIn(reply, parent.replies.all())

    def test_string_representation(self):
        comment = Comment.objects.create(
            submission=self.submission, author=self.user, content="Hello"
        )
        expected = f"Comment by {self.user.username} on Flamenco"
        self.assertEqual(str(comment), expected)


class StatusTransitionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="moderator", password="pass")
        self.submission = FormSubmission.objects.create(
            title="Grand Canyon", heritage_type="natural", status="submitted"
        )

    def test_create_status_transition(self):
        transition = StatusTransition.objects.create(
            submission=self.submission,
            from_status="submitted",
            to_status="under_review",
            changed_by=self.user,
            reason="Starting initial review",
        )
        self.assertEqual(transition.from_status, "submitted")
        self.assertEqual(transition.to_status, "under_review")
        self.assertEqual(transition.changed_by, self.user)
        self.assertIn("review", transition.reason)

    def test_ordering(self):
        t1 = StatusTransition.objects.create(
            submission=self.submission,
            from_status="submitted",
            to_status="under_review",
            changed_by=self.user,
        )
        t2 = StatusTransition.objects.create(
            submission=self.submission,
            from_status="under_review",
            to_status="changes_requested",
            changed_by=self.user,
        )
        transitions = list(self.submission.status_transitions.all())
        self.assertEqual(transitions, [t2, t1])  # reverse chronological

    def test_string_representation(self):
        transition = StatusTransition.objects.create(
            submission=self.submission,
            from_status="submitted",
            to_status="accepted",
            changed_by=self.user,
        )
        self.assertEqual(str(transition), "submitted → accepted by moderator")


class NotificationModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="notified_user", password="pass")

    def test_create_notification(self):
        notification = Notification.objects.create(
            user=self.user,
            message="Your form has been accepted!",
            link="/forms/abc123/",
            read=False,
        )
        self.assertEqual(notification.user, self.user)
        self.assertFalse(notification.read)
        self.assertTrue(notification.link.endswith("/forms/abc123/"))

    def test_default_values(self):
        notification = Notification.objects.create(user=self.user, message="Update")
        self.assertFalse(notification.read)
        self.assertIsNotNone(notification.created_at)

    def test_string_representation(self):
        notification = Notification.objects.create(user=self.user, message="Test alert")
        self.assertEqual(str(notification), "Notification: Test alert")


class TagModelTest(TestCase):
    def test_create_tag(self):
        tag = Tag.objects.create(name="UNESCO Candidate")
        self.assertEqual(tag.name, "UNESCO Candidate")
        self.assertEqual(str(tag), "UNESCO Candidate")

    def test_tag_uniqueness(self):
        Tag.objects.create(name="Archaeological")
        with self.assertRaises(Exception):  # IntegrityError
            Tag.objects.create(name="Archaeological")


class SubmissionTagModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tagger", password="pass")
        self.submission = FormSubmission.objects.create(
            title="Samba de Roda", heritage_type="intangible"
        )
        self.tag = Tag.objects.create(name="Music")

    def test_tag_submission(self):
        rel = SubmissionTag.objects.create(
            submission=self.submission, tag=self.tag, added_by=self.user
        )
        self.assertEqual(rel.submission, self.submission)
        self.assertEqual(rel.tag.name, "Music")
        self.assertEqual(rel.added_by, self.user)

    def test_prevent_duplicate_tag(self):
        SubmissionTag.objects.create(
            submission=self.submission, tag=self.tag, added_by=self.user
        )
        with self.assertRaises(Exception):  # IntegrityError
            SubmissionTag.objects.create(
                submission=self.submission, tag=self.tag, added_by=self.user
            )

    def test_reverse_relationship(self):
        SubmissionTag.objects.create(
            submission=self.submission, tag=self.tag, added_by=self.user
        )
        self.assertEqual(self.submission.tag_relations.count(), 1)
        self.assertEqual(self.submission.tag_relations.first().tag.name, "Music")
