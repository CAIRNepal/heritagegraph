import secrets
import string
import uuid
from django.contrib.auth import get_user_model
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

User = get_user_model()  # noqa: F811


def generate_unique_submission_id(length=11, max_attempts=100):
    characters = string.ascii_letters + string.digits
    for _ in range(max_attempts):
        new_id = "".join(secrets.choice(characters) for _ in range(length))
        if not Submission.objects.filter(submission_id=new_id).exists():
            return new_id
    raise Exception("Unable to generate a unique submission ID after many attempts.")

# Add these methods to the CulturalEntity model
def get_current_revision_data(self):
    """Get the data from the current revision"""
    if self.current_revision:
        return self.current_revision.data
    return None

def get_latest_revision(self):
    """Get the most recent revision for this entity"""
    return self.revisions.order_by('-revision_number').first()

def submit_for_review(self):
    """Submit the entity for editor review"""
    self.status = 'pending_review'
    self.save()
    
    # Log the activity
    Activity.objects.create(
        entity=self,
        user=self.contributor,
        activity_type='submitted',
        comment=f'Submitted "{self.name}" for review',
    )

def accept_contribution(self, editor, comment=None):
    """Accept the contribution and set it as published"""
    latest_revision = self.get_latest_revision()
    if latest_revision:
        self.current_revision = latest_revision
    self.status = 'accepted'
    self.save()
    
    # Log the activity
    Activity.objects.create(
        entity=self,
        user=editor,
        activity_type='accepted',
        comment=comment
    )

def reject_contribution(self, editor, comment):
    """Reject the contribution"""
    self.status = 'rejected'
    self.save()
    
    # Log the activity
    Activity.objects.create(
        entity=self,
        user=editor,
        activity_type='rejected',
        comment=comment
    )

def create_revision(self, user, form_data):
    """Create a new revision for this entity"""
    latest_rev = self.get_latest_revision()
    new_revision_number = latest_rev.revision_number + 1 if latest_rev else 1
    
    new_revision = Revision.objects.create(
        entity=self,
        data=form_data,
        revision_number=new_revision_number,
        created_by=user
    )
    
    # Update entity status
    self.status = 'pending_revision'
    self.save()
    
    # Log the activity
    Activity.objects.create(
        entity=self,
        user=user,
        activity_type='revised'
    )
    
    return new_revision


# Utility functions for views and management
def get_contribution_queue():
    """Get all entities pending review or revision"""
    return CulturalEntity.objects.filter(
        status__in=['pending_review', 'pending_revision']
    ).select_related('contributor', 'current_revision')

def get_user_contributions(user):
    """Get all contributions by a specific user"""
    return CulturalEntity.objects.filter(contributor=user).select_related('current_revision')

def get_entity_history(entity_id):
    """Get complete history of an entity including revisions and activities"""
    entity = CulturalEntity.objects.prefetch_related('revisions', 'activities').get(entity_id=entity_id)
    return {
        'entity': entity,
        'revisions': entity.revisions.all(),
        'activities': entity.activities.all().select_related('user')
    }

class CulturalEntity(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('pending_revision', 'Pending Revision'),
        ('merged', 'Merged'),
        ('superseded', 'Superseded'),
    ]
    
    CATEGORY_CHOICES = [
        ('monument', 'Monument'),
        ('artifact', 'Artifact'),
        ('ritual', 'Ritual'),
        ('festival', 'Festival'),
        ('tradition', 'Tradition'),
        ('document', 'Document'),
        ('other', 'Other'),
    ]
    
    entity_id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False,
        verbose_name="Entity ID"
    )
    name = models.CharField(max_length=255, verbose_name="Entity Name")
    description = models.TextField(verbose_name="Description")
    category = models.CharField(
        max_length=100, 
        choices=CATEGORY_CHOICES,
        verbose_name="Category"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name="Status"
    )
    contributor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='contributed_entities',
        verbose_name="Contributor"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    root_entity = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='all_forks',
        help_text="Root of the fork tree; null if this IS the root",
    )
    parent_entity = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='child_forks',
        help_text="Immediate parent in the fork tree",
    )
    fork_depth = models.PositiveIntegerField(
        default=0,
        help_text="0 = root, 1 = direct fork, etc.",
    )

    class Meta:
        db_table = 'cultural_entities'
        verbose_name = "Cultural Entity"
        verbose_name_plural = "Cultural Entities"
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['category']),
            models.Index(fields=['created_at']),
            models.Index(fields=['root_entity']),
            models.Index(fields=['parent_entity']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

class Revision(models.Model):
    revision_id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False,
        verbose_name="Revision ID"
    )
    entity = models.ForeignKey(
        CulturalEntity,
        on_delete=models.CASCADE,
        related_name='revisions',
        verbose_name="Cultural Entity"
    )
    data = models.JSONField(
        verbose_name="Revision Data",
        help_text="Complete form data for this revision in JSON format"
    )
    revision_number = models.PositiveIntegerField(
        default=1,
        verbose_name="Revision Number"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_revisions',
        verbose_name="Created By"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    class Meta:
        db_table = 'revisions'
        verbose_name = "Revision"
        verbose_name_plural = "Revisions"
        indexes = [
            models.Index(fields=['entity', 'revision_number']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['entity', '-revision_number']
        unique_together = ['entity', 'revision_number']

    def __str__(self):
        return f"Revision {self.revision_number} for {self.entity.name}"

class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('submitted', 'Submitted'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('revised', 'Revised'),
        ('commented', 'Commented'),
        ('escalated', 'Escalated to Expert'),
        ('changes_requested', 'Changes Requested'),
        ('flagged', 'Flagged for Review'),
        ('conflict_resolved', 'Conflict Resolved'),
    ]
    
    activity_id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False,
        verbose_name="Activity ID"
    )
    entity = models.ForeignKey(
        CulturalEntity,
        on_delete=models.CASCADE,
        related_name='activities',
        verbose_name="Cultural Entity"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='activities',
        verbose_name="User"
    )
    activity_type = models.CharField(
        max_length=20,
        choices=ACTIVITY_TYPES,
        verbose_name="Activity Type"
    )
    comment = models.TextField(
        blank=True, 
        null=True,
        verbose_name="Comment",
        help_text="Optional comment from editor or contributor"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    class Meta:
        db_table = 'activities'
        verbose_name = "Activity"
        verbose_name_plural = "Activities"
        indexes = [
            models.Index(fields=['entity', 'activity_type']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_activity_type_display()} by {self.user.username} on {self.entity.name}"

CulturalEntity.add_to_class(
    'current_revision',
    models.ForeignKey(
        Revision,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_for_entity',
        verbose_name="Current Revision"
    )
)

# Add the methods to the CulturalEntity class
CulturalEntity.get_current_revision_data = get_current_revision_data
CulturalEntity.get_latest_revision = get_latest_revision
CulturalEntity.submit_for_review = submit_for_review
CulturalEntity.accept_contribution = accept_contribution
CulturalEntity.reject_contribution = reject_contribution
CulturalEntity.create_revision = create_revision

# =====================================================================
# REVIEWER / CURATION MODELS
# =====================================================================

class ReviewerRole(models.Model):
    """
    Tracks which reviewer persona a user has and their domain expertise.
    Three personas: community_reviewer, domain_expert, expert_curator.
    """
    ROLE_CHOICES = [
        ('community_reviewer', 'Community Reviewer'),
        ('domain_expert', 'Domain Expert'),
        ('expert_curator', 'Expert Curator'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='reviewer_role')
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='community_reviewer')
    expertise_areas = models.JSONField(
        default=list, blank=True,
        help_text="List of domain areas, e.g. ['architecture', 'buddhist_heritage']"
    )
    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_reviewer_roles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reviewer_roles'
        verbose_name = 'Reviewer Role'
        verbose_name_plural = 'Reviewer Roles'

    def __str__(self):
        return f"{self.user.username} — {self.get_role_display()}"

    @property
    def can_override_confidence(self):
        return self.role in ('domain_expert', 'expert_curator')

    @property
    def can_resolve_conflicts(self):
        return self.role in ('domain_expert', 'expert_curator')

    @property
    def can_manage_roles(self):
        return self.role == 'expert_curator'


class ReviewerApplication(models.Model):
    """
    A user requests the ability to curate; staff approve in Django admin
    (or expert curators can still use ReviewerRole assign).
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reviewer_applications"
    )
    message = models.TextField(
        blank=True, help_text="Optional note from the applicant (background, interest, etc.)"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True
    )
    admin_notes = models.TextField(
        blank=True, help_text="Internal notes (visible only in admin)"
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_reviewer_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reviewer_applications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"Reviewer application — {self.user.username} ({self.status})"

    def approve(self, reviewed_by):
        """
        Grant community reviewer: ReviewerRole + Reviewers group.
        No-op if not pending.
        """
        if self.status != "pending":
            return False
        from django.contrib.auth.models import Group
        from django.utils import timezone

        ReviewerRole.objects.update_or_create(
            user=self.user,
            defaults={
                "role": "community_reviewer",
                "is_active": True,
                "assigned_by": reviewed_by,
                "expertise_areas": [],
            },
        )
        try:
            reviewers_g = Group.objects.get(name="Reviewers")
            self.user.groups.add(reviewers_g)
        except Group.DoesNotExist:
            pass

        self.status = "approved"
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        self.save(
            update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"]
        )
        return True

    def reject(self, reviewed_by, append_note: str = ""):
        if self.status != "pending":
            return False
        from django.utils import timezone

        self.status = "rejected"
        self.reviewed_by = reviewed_by
        self.reviewed_at = timezone.now()
        if append_note and append_note.strip():
            prev = (self.admin_notes or "").strip()
            line = f"[{reviewed_by}] {append_note.strip()}"
            self.admin_notes = f"{prev}\n{line}".strip() if prev else line
        self.save(
            update_fields=[
                "status",
                "reviewed_by",
                "reviewed_at",
                "admin_notes",
                "updated_at",
            ]
        )
        return True


class ReviewDecision(models.Model):
    """
    A single review decision on a CulturalEntity submission.
    Maps to the epistemic review workspace: verdict, conflict handling,
    confidence adjustment, and provenance feedback.
    """
    VERDICT_CHOICES = [
        ('accept', 'Accept — publish this assertion'),
        ('accept_with_edits', 'Accept with edits — modify before publishing'),
        ('request_changes', 'Request changes — send back to contributor'),
        ('reject', 'Reject — do not publish'),
        ('escalate', 'Escalate to expert — beyond my domain'),
    ]

    CONFLICT_HANDLING_CHOICES = [
        ('not_applicable', 'No conflict'),
        ('supersedes', 'New claim supersedes existing'),
        ('coexist', 'Both claims coexist (conflicting sources)'),
        ('existing_stands', 'Existing claim stands; reject new one'),
        ('refines', 'New claim refines existing (more precise)'),
        ('disputed', 'Genuinely contradictory — requires expert'),
    ]

    VERIFICATION_METHOD_CHOICES = [
        ('source_crosscheck', 'Source cross-checked'),
        ('expert_knowledge', 'Expert knowledge'),
        ('field_verification', 'Field verification'),
        ('community_consensus', 'Community consensus'),
    ]

    CONFIDENCE_CHOICES = [
        ('certain', 'Certain'),
        ('likely', 'Likely'),
        ('uncertain', 'Uncertain'),
        ('speculative', 'Speculative'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity = models.ForeignKey(
        CulturalEntity, on_delete=models.CASCADE,
        related_name='review_decisions'
    )
    reviewer = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='review_decisions'
    )
    revision_reviewed = models.ForeignKey(
        Revision, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='review_decisions',
        help_text="The specific revision this decision was made on"
    )

    # Decision
    verdict = models.CharField(max_length=30, choices=VERDICT_CHOICES)
    conflict_handling = models.CharField(
        max_length=20, choices=CONFLICT_HANDLING_CHOICES,
        default='not_applicable'
    )
    confidence_override = models.CharField(
        max_length=20, choices=CONFIDENCE_CHOICES,
        blank=True, null=True,
        help_text="Override contributor's confidence assessment"
    )
    verification_method = models.CharField(
        max_length=30, choices=VERIFICATION_METHOD_CHOICES,
        blank=True, null=True
    )

    # Feedback
    feedback = models.TextField(
        blank=True,
        help_text="Feedback shown to contributor; logged permanently"
    )
    reconciliation_note = models.TextField(
        blank=True,
        help_text="Public note on conflict reconciliation (part of provenance)"
    )
    internal_note = models.TextField(
        blank=True,
        help_text="Internal note visible only to reviewers"
    )

    # Escalation
    escalated_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='escalated_reviews',
        help_text="Expert this was escalated to"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_decisions'
        verbose_name = 'Review Decision'
        verbose_name_plural = 'Review Decisions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity', 'created_at']),
            models.Index(fields=['reviewer']),
            models.Index(fields=['verdict']),
        ]

    def __str__(self):
        return f"{self.get_verdict_display()} by {self.reviewer.username} on {self.entity.name}"


class ReviewFlag(models.Model):
    """
    Flags raised on entities by community members or automated checks.
    Types: questionable_source, suspected_duplicate, sensitive_content,
    low_confidence, stale_review.
    """
    FLAG_TYPE_CHOICES = [
        ('questionable_source', 'Questionable Source'),
        ('suspected_duplicate', 'Suspected Duplicate'),
        ('sensitive_content', 'Sensitive Content'),
        ('low_confidence', 'Low Confidence Score'),
        ('stale_review', 'Stale — In Review Too Long'),
        ('contradiction', 'Contradicts Existing Data'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity = models.ForeignKey(
        CulturalEntity, on_delete=models.CASCADE,
        related_name='review_flags'
    )
    flag_type = models.CharField(max_length=30, choices=FLAG_TYPE_CHOICES)
    flagged_by = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='raised_flags'
    )
    reason = models.TextField(blank=True)
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_flags'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_flags'
        verbose_name = 'Review Flag'
        verbose_name_plural = 'Review Flags'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_flag_type_display()} on {self.entity.name}"


class CulturalHeritage(models.Model):
    TYPE_CHOICES = [
        ("tangible", "Tangible Heritage"),
        ("intangible", "Intangible Heritage"),
        ("natural", "Natural Heritage"),
    ]
    heritage_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    historical_context = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Media(models.Model):
    MEDIA_TYPE_CHOICES = [
        ("image", "Image"),
        ("video", "Video"),
        ("audio", "Audio"),
    ]
    submission = models.ForeignKey(
        "Submission",
        on_delete=models.CASCADE,
        related_name="media",
        null=True,
        blank=True,
    )
    cultural_entity = models.ForeignKey(
        "CulturalEntity",
        on_delete=models.CASCADE,
        related_name="media",
        null=True,
        blank=True,
    )
    ingestion_contributor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="ingestion_media_files",
        null=True,
        blank=True,
        help_text="When set, this media file belongs to a standalone OCR ingestion upload (no CE/submission).",
    )
    media_type = models.CharField(max_length=50, choices=MEDIA_TYPE_CHOICES)
    file = models.FileField(upload_to="heritage_media/")
    description = models.TextField(blank=True)
    ocr_deferred = models.BooleanField(
        default=False,
        help_text="When true, OCR is not auto-queued on upload; use project start-ocr or OCR upload.",
    )

    def __str__(self):
        return f"{self.media_type}: {self.file.name}"

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError

        has_submission = self.submission_id is not None
        has_entity = self.cultural_entity_id is not None
        has_ingestion = self.ingestion_contributor_id is not None
        link_count = sum((has_submission, has_entity, has_ingestion))
        if link_count != 1:
            raise ValidationError(
                "Media must be linked to exactly one of: Submission, CulturalEntity, or ingestion contributor."
            )

class Contributor(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="contributions"
    )
    relationship_to_heritage = models.TextField()
    consent_to_share = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.relationship_to_heritage}"


STATUS_CHOICES = [
    ("pending", "Pending"),
    ("accepted", "Accepted"),
    ("rejected", "Rejected"),
    ("review", "Review"),
]


class Submission(models.Model):
    submission_id = models.CharField(max_length=11, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.submission_id:
            self.submission_id = generate_unique_submission_id()

        is_update = self.pk is not None
        super().save(*args, **kwargs)

        if is_update:
            latest_version = self.versions.first()
            next_version = (latest_version.version_number + 1) if latest_version else 1
            SubmissionVersion.objects.create(
                submission=self,
                version_number=next_version,
                title=self.title,
                description=self.description,
                contribution_data=self.contribution_data,
                updated_by=self.contributor,
            )

    title = models.CharField(max_length=255)
    description = models.TextField()
    contributor = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="submissions"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    cultural_heritage = models.ForeignKey(
        "CulturalHeritage", on_delete=models.CASCADE, null=True, blank=True
    )
    contribution_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    # Additional fields based on unique labels
    Activity = models.CharField(max_length=255, null=True, blank=True)
    Alternative_name_s = models.CharField(max_length=255, null=True, blank=True)
    Anglicized_name = models.CharField(max_length=255, null=True, blank=True)
    Base_plinth_depth = models.CharField(max_length=255, null=True, blank=True)
    Base_plinth_height = models.CharField(max_length=255, null=True, blank=True)
    Base_plinth_width = models.CharField(max_length=255, null=True, blank=True)
    Cakula_depth = models.CharField(max_length=255, null=True, blank=True)
    Cakula_height = models.CharField(max_length=255, null=True, blank=True)
    Cakula_width = models.CharField(max_length=255, null=True, blank=True)
    Capital_depth = models.CharField(max_length=255, null=True, blank=True)
    Capital_height = models.CharField(max_length=255, null=True, blank=True)
    Capital_width = models.CharField(max_length=255, null=True, blank=True)
    Circumference = models.CharField(max_length=255, null=True, blank=True)
    City_quarter_tola = models.CharField(max_length=255, null=True, blank=True)
    Column_depth = models.CharField(max_length=255, null=True, blank=True)
    Column_height = models.CharField(max_length=255, null=True, blank=True)
    Column_width = models.CharField(max_length=255, null=True, blank=True)
    Commentary = models.TextField(null=True, blank=True)
    Date_BCE_CE = models.CharField(max_length=255, null=True, blank=True)
    Date_VS_NS = models.CharField(max_length=255, null=True, blank=True)
    Depth = models.CharField(max_length=255, null=True, blank=True)
    Description_for_past_interventions = models.TextField(null=True, blank=True)
    Description_in_Nepali = models.TextField(null=True, blank=True)
    Details = models.TextField(null=True, blank=True)
    District = models.CharField(max_length=255, null=True, blank=True)
    Edge_at_platform = models.CharField(max_length=255, null=True, blank=True)
    Editorial_team = models.CharField(max_length=255, null=True, blank=True)
    End_date = models.CharField(max_length=255, null=True, blank=True)
    Event_name = models.CharField(max_length=255, null=True, blank=True)
    Forms_of_columns = models.CharField(max_length=255, null=True, blank=True)
    Gate = models.CharField(max_length=255, null=True, blank=True)
    Height = models.CharField(max_length=255, null=True, blank=True)
    Heritage_focus_area = models.CharField(max_length=255, null=True, blank=True)
    Identified_threats = models.TextField(null=True, blank=True)
    Image_declaration = models.CharField(max_length=255, null=True, blank=True)
    Inscription_identification_number = models.CharField(
        max_length=255, null=True, blank=True
    )
    Lintel_depth = models.CharField(max_length=255, null=True, blank=True)
    Lintel_height = models.CharField(max_length=255, null=True, blank=True)
    Main_deity_in_the_sanctum = models.CharField(max_length=255, null=True, blank=True)
    Maps_and_drawing_type = models.CharField(max_length=255, null=True, blank=True)
    Monument_assessment = models.TextField(null=True, blank=True)
    Monument_depth = models.CharField(max_length=255, null=True, blank=True)
    Monument_diameter = models.CharField(max_length=255, null=True, blank=True)
    Monument_height_approximate = models.CharField(
        max_length=255, null=True, blank=True
    )
    Monument_length = models.CharField(max_length=255, null=True, blank=True)
    Monument_name = models.CharField(max_length=255, null=True, blank=True)
    Monument_shape = models.CharField(max_length=255, null=True, blank=True)
    Monument_type = models.CharField(max_length=255, null=True, blank=True)
    Municipality_village_council = models.CharField(
        max_length=255, null=True, blank=True
    )
    Name = models.CharField(max_length=255, null=True, blank=True)
    Name_in_Devanagari = models.CharField(max_length=255, null=True, blank=True)
    Nepali_month = models.CharField(max_length=255, null=True, blank=True)
    Number_of_bays_front = models.CharField(max_length=255, null=True, blank=True)
    Number_of_bays_sides = models.CharField(max_length=255, null=True, blank=True)
    Number_of_doors = models.CharField(max_length=255, null=True, blank=True)
    Number_of_plinth = models.CharField(max_length=255, null=True, blank=True)
    Number_of_roofs = models.CharField(max_length=255, null=True, blank=True)
    Number_of_storeys = models.CharField(max_length=255, null=True, blank=True)
    Number_of_struts = models.CharField(max_length=255, null=True, blank=True)
    Number_of_wood_carved_windows = models.CharField(
        max_length=255, null=True, blank=True
    )
    Object_ID_number = models.CharField(max_length=255, null=True, blank=True)
    Object_location = models.CharField(max_length=255, null=True, blank=True)
    Object_material = models.CharField(max_length=255, null=True, blank=True)
    Object_type = models.CharField(max_length=255, null=True, blank=True)
    Paksa = models.CharField(max_length=255, null=True, blank=True)
    Peculiarities = models.TextField(null=True, blank=True)
    Period = models.CharField(max_length=255, null=True, blank=True)
    Platform_floor = models.CharField(max_length=255, null=True, blank=True)
    Profile_at_base = models.CharField(max_length=255, null=True, blank=True)
    Province_number = models.CharField(max_length=255, null=True, blank=True)
    Reference_source = models.TextField(null=True, blank=True)
    Religion = models.CharField(max_length=255, null=True, blank=True)
    Roofing = models.CharField(max_length=255, null=True, blank=True)
    Short_description = models.TextField(null=True, blank=True)
    Sources = models.TextField(null=True, blank=True)
    Thickness_of_main_wall = models.CharField(max_length=255, null=True, blank=True)
    Tithi = models.CharField(max_length=255, null=True, blank=True)
    Top_plinth_depth = models.CharField(max_length=255, null=True, blank=True)
    Top_plinth_height = models.CharField(max_length=255, null=True, blank=True)
    Top_plinth_width = models.CharField(max_length=255, null=True, blank=True)
    Type_of_bricks = models.CharField(max_length=255, null=True, blank=True)
    Type_of_roof = models.CharField(max_length=255, null=True, blank=True)
    Width = models.CharField(max_length=255, null=True, blank=True)
    Year_SS_NS_VS = models.CharField(max_length=255, null=True, blank=True)

    contribution_data = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class UserStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="stats")

    total_submissions = models.PositiveIntegerField(default=0)
    submissions_last_month = models.PositiveIntegerField(default=0)
    submissions_this_month = models.PositiveIntegerField(default=0)
    submissions_growth = models.FloatField(default=0.0)

    total_reviewed = models.PositiveIntegerField(default=0)
    accepted_count = models.PositiveIntegerField(default=0)
    approval_rate = models.FloatField(default=0.0)
    approval_rate_change = models.FloatField(default=0.0)

    contributor_rank = models.PositiveIntegerField(default=0)
    rank_change = models.IntegerField(default=0)

    community_impact_score = models.FloatField(default=0.0)
    impact_score_change = models.FloatField(default=0.0)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} stats"


class Moderation(models.Model):
    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name="moderation"
    )
    moderator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_items",
    )
    remarks = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        moderator_name = self.moderator.username if self.moderator else "No Moderator"
        return f"Moderation for {self.submission.title} by {moderator_name}"

class Organization(models.Model):
    """Community organizations that group contributors."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    short_name = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='org_logos/', blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    country = models.CharField(max_length=100, blank=True)
    focus_areas = models.JSONField(
        default=list, blank=True,
        help_text="List of heritage focus areas, e.g. ['architecture','epigraphy']"
    )
    owner = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='owned_organizations'
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organizations'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def member_count(self):
        return self.members.count()


class OrganizationMembership(models.Model):
    """Links users to organizations with a role."""
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('editor', 'Editor'),
        ('admin', 'Admin'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='org_memberships')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'organization_memberships'
        unique_together = ['user', 'organization']
        ordering = ['-joined_at']

    def __str__(self):
        return f"{self.user.username} @ {self.organization.name} ({self.role})"


class UserProfile(models.Model):
    CONTRIBUTOR_MODE_BASIC = "basic"
    CONTRIBUTOR_MODE_ADVANCED = "advanced"
    CONTRIBUTOR_MODE_CHOICES = [
        (CONTRIBUTOR_MODE_BASIC, "Basic"),
        (CONTRIBUTOR_MODE_ADVANCED, "Advanced"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    slug = models.UUIDField(default=uuid.uuid4, unique=True, editable=False,
                            help_text="Public URL-safe identifier for profile pages")
    clerk_user_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    first_name = models.CharField(max_length=50, blank=True)
    middle_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    birth_date = models.DateField(blank=True, null=True)
    profile_image = models.ImageField(upload_to='profile_images/', blank=True, null=True)
    avatar_url = models.URLField(blank=True, null=True)

    biography = models.TextField(blank=True)
    area_of_expertise = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=100, blank=True)

    organization = models.CharField(max_length=255, blank=True)
    position = models.CharField(max_length=255, blank=True)
    university_school = models.CharField(max_length=255, blank=True)

    # Fixed fields
    social_links = models.JSONField(
        blank=True,
        null=True,
        default=dict,
        help_text="A JSON object of social links, e.g., "
        "{'twitter': 'url', 'linkedin': 'url'}",
    )
    website_link = models.URLField(blank=True, null=True)
    contributor_mode = models.CharField(
        max_length=16,
        choices=CONTRIBUTOR_MODE_CHOICES,
        default=CONTRIBUTOR_MODE_BASIC,
        help_text="Global contributor experience mode used by ontology forms.",
    )

    score = models.IntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )

    @property
    def member_since(self):
        return self.user.date_joined.strftime("%B %Y")

    def __str__(self):
        return self.user.username


class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ("add", "Added"),
        ("edit", "Edited"),
        ("delete", "Deleted"),
        ("review", "Reviewed"),
        ("remarks", "Commented"),
    ]
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="activity_logs"
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"{self.user.username} {self.get_action_display()}"
            f"{self.description} at {self.timestamp}"
        )


# Place this at the top level, outside any class
def generate_unique_comment_id(length=11, max_attempts=100):
    """Generates a unique random comment ID."""
    characters = string.ascii_letters + string.digits
    for _ in range(max_attempts):
        new_id = "".join(secrets.choice(characters) for _ in range(length))
        if not Comments.objects.filter(comment_id=new_id).exists():
            return new_id
    raise Exception("Unable to generate a unique comment ID after many attempts.")


class Comments(models.Model):
    comment_id = models.CharField(
        max_length=11, unique=True, blank=True, editable=False
    )
    submission = models.ForeignKey(
        "CulturalEntity",
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        "Project",
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="user_comments"
    )
    comment = models.TextField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
        help_text="Parent comment for threaded replies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "comments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission", "created_at"]),
            models.Index(fields=["project", "created_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.comment_id:
            self.comment_id = generate_unique_comment_id()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.submission_id:
            return f"Comment by {self.user.username} on entity {self.submission_id}"
        return f"Comment by {self.user.username} on project {self.project_id}"


class SubmissionVersion(models.Model):
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    description = models.TextField()
    contribution_data = models.JSONField(default=dict)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version_number"]
        unique_together = ("submission", "version_number")

    def __str__(self):
        return f"Version {self.version_number} of {self.submission.title}"


class SubmissionEditSuggestion(models.Model):
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="edit_suggestions"
    )
    suggested_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="suggested_edits"
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    contribution_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    approved = models.BooleanField(null=True, blank=True)

    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_suggestions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Suggestion for {self.submission.title} by {self.suggested_by.username}"


def apply(self, reviewer):
    from django.utils import timezone

    submission = self.submission
    submission.title = self.title
    submission.description = self.description
    submission.contribution_data = self.contribution_data
    submission.save()

    self.approved = True
    self.reviewed_at = timezone.now()
    self.reviewed_by = reviewer
    self.save()


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ("submission_update", "Submission Update"),
        ("comment", "Comment"),
        ("moderation", "Moderation"),
        ("suggestion_review", "Edit Suggestion Review"),
        ("review_decision", "Review Decision"),
        ("revision", "Revision"),
        ("reaction", "Reaction"),
        ("fork", "Fork"),
        ("general", "General"),
        ("project_state_changed", "Project State Changed"),
        ("project_comment", "Project Comment"),
    ]

    notification_id = models.CharField(
        max_length=11, unique=True, blank=True, editable=False
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="triggered_notifications",
        null=True,
        blank=True,
        help_text="The user who triggered this notification",
    )
    notification_type = models.CharField(
        max_length=50, choices=NOTIFICATION_TYPE_CHOICES
    )
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    entity = models.ForeignKey(
        CulturalEntity,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        "Project",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    link = models.CharField(
        max_length=500, blank=True,
        help_text="Frontend URL to navigate to when notification is clicked"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.notification_id:
            self.notification_id = self.generate_unique_notification_id()
        super().save(*args, **kwargs)

    def generate_unique_notification_id(self, length=11, max_attempts=100):
        characters = string.ascii_letters + string.digits
        for _ in range(max_attempts):
            new_id = "".join(secrets.choice(characters) for _ in range(length))
            if not Notification.objects.filter(notification_id=new_id).exists():
                return new_id
        raise Exception(
            "Unable to generate a unique notification ID after many attempts."
        )

    def __str__(self):
        status = "Read" if self.is_read else "Unread"
        return f"Notification for {self.user.username} ({status}): {self.message[:50]}"


# =====================================================================
# REACTION / VOTE MODEL
# =====================================================================

class Reaction(models.Model):
    """
    Upvote/downvote reactions on entities and comments.
    Each user can have one reaction per target (entity or comment).
    """
    REACTION_CHOICES = [
        ("upvote", "Upvote"),
        ("downvote", "Downvote"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reactions"
    )
    entity = models.ForeignKey(
        CulturalEntity, on_delete=models.CASCADE,
        related_name="reactions", null=True, blank=True,
    )
    comment = models.ForeignKey(
        Comments, on_delete=models.CASCADE,
        related_name="reactions", null=True, blank=True,
    )
    reaction_type = models.CharField(max_length=10, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reactions"
        # One reaction per user per entity or comment
        constraints = [
            models.UniqueConstraint(
                fields=["user", "entity"],
                condition=models.Q(entity__isnull=False),
                name="unique_user_entity_reaction",
            ),
            models.UniqueConstraint(
                fields=["user", "comment"],
                condition=models.Q(comment__isnull=False),
                name="unique_user_comment_reaction",
            ),
        ]
        indexes = [
            models.Index(fields=["entity", "reaction_type"]),
            models.Index(fields=["comment", "reaction_type"]),
        ]

    def __str__(self):
        target = self.entity or self.comment
        return f"{self.user.username} {self.reaction_type}d {target}"


# =====================================================================
# FORK MODEL — forking contributions
# =====================================================================

class Fork(models.Model):
    """
    A fork of an existing CulturalEntity contribution.
    Creates a new entity that references its parent for provenance.
    """
    FORK_REASON_CHOICES = [
        ('correction', 'Factual Correction'),
        ('translation', 'Language / Translation Variant'),
        ('expansion', 'Add Missing Information'),
        ('source_addition', 'Source Citation'),
        ('dispute', 'Dispute Existing Claim'),
        ('other', 'Other'),
    ]
    FORK_STATUS_CHOICES = [
        ('active', 'Active'),
        ('merged', 'Merged'),
        ('promoted', 'Promoted'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_entity = models.ForeignKey(
        CulturalEntity, on_delete=models.CASCADE,
        related_name="forks",
        help_text="The entity that was forked",
    )
    forked_entity = models.ForeignKey(
        CulturalEntity, on_delete=models.CASCADE,
        related_name="forked_from",
        help_text="The new entity created from the fork",
    )
    forked_by = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="forked_entities",
    )
    forked_from_revision = models.ForeignKey(
        Revision, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="forks",
        help_text="The specific revision that was forked",
    )
    reason = models.TextField(
        blank=True,
        help_text="Why the user forked this contribution",
    )
    fork_reason_tag = models.CharField(
        max_length=30,
        choices=FORK_REASON_CHOICES,
        default='other',
        help_text="Structured reason category for the fork",
    )
    fork_status = models.CharField(
        max_length=20,
        choices=FORK_STATUS_CHOICES,
        default='active',
    )
    diff_summary = models.JSONField(
        default=dict, blank=True,
        help_text="Field-level diff vs parent at fork time",
    )
    merged_at = models.DateTimeField(null=True, blank=True)
    merged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='merged_forks',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forks"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["original_entity", "created_at"]),
            models.Index(fields=["fork_status"]),
            models.Index(fields=["fork_reason_tag"]),
        ]

    def __str__(self):
        return f"Fork of {self.original_entity.name} by {self.forked_by.username}"


# =====================================================================
# SHARE TRACKING MODEL
# =====================================================================

# =====================================================================
# TRIAGE POLICY + SCHEMA EXTENSION PROPOSALS (006-reviewer-triage-and-approval)
# =====================================================================


class TriagePolicy(models.Model):
    """
    Active weights and caps for review-queue triage scoring (single-tenant).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_active = models.BooleanField(default=True, db_index=True)
    w_age = models.DecimalField(max_digits=6, decimal_places=3, default=2.5)
    w_flags = models.DecimalField(max_digits=6, decimal_places=3, default=1.5)
    w_conflict = models.DecimalField(max_digits=6, decimal_places=3, default=3.0)
    w_source = models.DecimalField(max_digits=6, decimal_places=3, default=1.0)
    s_max_days = models.PositiveIntegerField(default=30)
    f_max_flags = models.PositiveIntegerField(default=10)
    tier_rank_json = models.JSONField(
        default=list,
        help_text="Ordered source_type values best→worst for trust (see spec assumptions).",
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triage_policy_updates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "triage_policies"
        verbose_name = "Triage policy"
        verbose_name_plural = "Triage policies"

    def __str__(self):
        return f"TriagePolicy(active={self.is_active})"


class SchemaExtensionProposal(models.Model):
    """Moderator-gated LinkML / registry overlay change proposal."""

    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PUBLISHED = "published"
    STATUS_WITHDRAWN = "withdrawn"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="schema_extension_proposals",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
    )
    base_schema_version = models.CharField(max_length=128, blank=True)
    proposed_yaml = models.TextField(help_text="YAML overlay or LinkML fragment")
    conflict_keys = models.JSONField(default=list, blank=True)
    moderator_comment = models.TextField(blank=True)
    published_schema_version = models.CharField(max_length=128, blank=True)
    published_extension_hash = models.CharField(max_length=128, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "schema_extension_proposals"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "submitted_at"]),
            models.Index(fields=["author", "status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"


class SchemaExtensionAuditEvent(models.Model):
    """Append-only audit row for proposal lifecycle."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        SchemaExtensionProposal,
        on_delete=models.CASCADE,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="schema_extension_audit_actions",
    )
    action = models.CharField(max_length=40, db_index=True)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    comment = models.TextField(blank=True)
    schema_version_snapshot = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "schema_extension_audit_events"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.action} @ {self.created_at}"


# =====================================================================
# KNOWLEDGE GRAPH PROPOSALS (spec 007)
# =====================================================================


class EntityProposal(models.Model):
    """Contributor entity/cluster proposal; moderator approval materializes EntityCluster."""

    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_WITHDRAWN = "withdrawn"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    RESOLUTION_NEW = "new_cluster"
    RESOLUTION_LINK = "link_existing"
    RESOLUTION_CHOICES = [
        (RESOLUTION_NEW, "Create new cluster"),
        (RESOLUTION_LINK, "Link anchors to existing cluster"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="entity_proposals",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
    )
    canonical_label = models.CharField(max_length=500)
    aliases = models.JSONField(default=list, blank=True)
    type_scope = models.CharField(max_length=100)
    anchor_records = models.JSONField(
        default=list,
        help_text='[{"entity_type":"person","entity_id":123}, …] CIDOC rows',
    )
    supporting_source_ids = models.JSONField(default=list, blank=True)
    contributor_note = models.TextField(blank=True)
    external_identifiers = models.JSONField(default=dict, blank=True)
    resolution_mode = models.CharField(
        max_length=32,
        choices=RESOLUTION_CHOICES,
        default=RESOLUTION_NEW,
    )
    existing_cluster = models.ForeignKey(
        "cidoc_data.EntityCluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entity_proposals_linking",
    )
    moderator_comment = models.TextField(blank=True)
    materialized_cluster = models.ForeignKey(
        "cidoc_data.EntityCluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entity_proposals_materialized",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "entity_proposals"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "submitted_at"]),
            models.Index(fields=["author", "status"]),
        ]

    def __str__(self) -> str:
        return f"EntityProposal {self.canonical_label!r} ({self.status})"


class RelationshipProposal(models.Model):
    """Binary relationship proposal; approval creates HeritageAssertion (relationship.*)."""

    STATUS_DRAFT = EntityProposal.STATUS_DRAFT
    STATUS_SUBMITTED = EntityProposal.STATUS_SUBMITTED
    STATUS_APPROVED = EntityProposal.STATUS_APPROVED
    STATUS_REJECTED = EntityProposal.STATUS_REJECTED
    STATUS_WITHDRAWN = EntityProposal.STATUS_WITHDRAWN
    STATUS_CHOICES = EntityProposal.STATUS_CHOICES

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="relationship_proposals",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
    )
    predicate = models.ForeignKey(
        "cidoc_data.RelationshipPredicate",
        on_delete=models.PROTECT,
        related_name="relationship_proposals",
    )
    subject_entity_type = models.CharField(max_length=100)
    subject_entity_id = models.PositiveIntegerField()
    object_entity_type = models.CharField(max_length=100)
    object_entity_id = models.PositiveIntegerField()
    primary_source = models.ForeignKey(
        "cidoc_data.DataSource",
        on_delete=models.PROTECT,
        related_name="relationship_proposals_primary",
    )
    supporting_source_ids = models.JSONField(default=list, blank=True)
    temporal_scope_edtf = models.CharField(max_length=255, blank=True)
    confidence = models.CharField(max_length=20, default="likely")
    interpretation_note = models.TextField(blank=True)
    moderator_comment = models.TextField(blank=True)
    materialized_assertion = models.ForeignKey(
        "cidoc_data.HeritageAssertion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="relationship_proposals_materialized",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "relationship_proposals"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "submitted_at"]),
            models.Index(fields=["author", "status"]),
        ]

    def __str__(self) -> str:
        return f"RelationshipProposal ({self.status})"


class EntityProposalAuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        EntityProposal,
        on_delete=models.CASCADE,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="entity_proposal_audit_actions",
    )
    action = models.CharField(max_length=40, db_index=True)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "entity_proposal_audit_events"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.action} @ {self.created_at}"


class RelationshipProposalAuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        RelationshipProposal,
        on_delete=models.CASCADE,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="relationship_proposal_audit_actions",
    )
    action = models.CharField(max_length=40, db_index=True)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "relationship_proposal_audit_events"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.action} @ {self.created_at}"


# =====================================================================
# PUBLIC CONTRIBUTION MODEL (QR SCAN CONTRIBUTIONS)
# =====================================================================

class PublicContribution(models.Model):
    """
    Stores anonymous contributions from visitors who scan QR codes at heritage sites.
    These go into a review queue where curators can verify and incorporate them
    into the knowledge base.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('incorporated', 'Incorporated'),  # Added to an entity
    ]
    
    CONTRIBUTION_TYPE_CHOICES = [
        ('history', 'Historical Information'),
        ('story', 'Story or Legend'),
        ('tradition', 'Cultural Practice/Tradition'),
        ('memory', 'Personal Memory'),
        ('photo', 'Photo Description'),
        ('correction', 'Correction/Update'),
        ('other', 'Other Information'),
    ]
    
    SUBMISSION_SOURCE_CHOICES = [
        ('qr_scan', 'QR Code Scan'),
        ('web_form', 'Web Form'),
        ('mobile_app', 'Mobile App'),
        ('field_survey', 'Field Survey'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to existing entity (optional - may be for a new untracked site)
    entity = models.ForeignKey(
        CulturalEntity, 
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='public_contributions',
        help_text="The entity this contribution is about (if exists in system)"
    )
    
    # Entity identification (for cases where entity doesn't exist yet)
    entity_reference_id = models.CharField(
        max_length=255, blank=True,
        help_text="External ID reference (from QR code) if entity not in system"
    )
    entity_name = models.CharField(
        max_length=255,
        help_text="Name/label of the heritage site from QR code"
    )
    
    # Contribution content
    contribution_type = models.CharField(
        max_length=20, 
        choices=CONTRIBUTION_TYPE_CHOICES,
        default='other'
    )
    content = models.TextField(
        help_text="The actual contribution content"
    )
    
    # Contributor info (optional - for follow-up if needed)
    contributor_name = models.CharField(max_length=255, blank=True, default='Anonymous')
    contributor_email = models.EmailField(blank=True, null=True)
    contributor_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Source/provenance
    source_description = models.TextField(
        blank=True,
        help_text="How the contributor knows this information"
    )
    submitted_via = models.CharField(
        max_length=20,
        choices=SUBMISSION_SOURCE_CHOICES,
        default='qr_scan'
    )
    
    # Location context
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, 
        null=True, blank=True,
        help_text="GPS latitude where contribution was made"
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6,
        null=True, blank=True,
        help_text="GPS longitude where contribution was made"
    )
    
    # Review workflow
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_public_contributions'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(
        blank=True,
        help_text="Notes from reviewer"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'public_contributions'
        verbose_name = 'Public Contribution'
        verbose_name_plural = 'Public Contributions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['entity', 'created_at']),
            models.Index(fields=['contribution_type']),
        ]

    def __str__(self):
        return f"{self.contribution_type}: {self.entity_name} by {self.contributor_name}"


class Share(models.Model):
    """Tracks shares of entities/comments to external platforms."""
    PLATFORM_CHOICES = [
        ("twitter", "Twitter/X"),
        ("facebook", "Facebook"),
        ("linkedin", "LinkedIn"),
        ("email", "Email"),
        ("copy_link", "Copy Link"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="shares", null=True, blank=True,
    )
    entity = models.ForeignKey(
        CulturalEntity, on_delete=models.CASCADE,
        related_name="shares", null=True, blank=True,
    )
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shares"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Shared {self.entity} on {self.platform}"


# =====================================================================
# PROJECT-BASED CONTRIBUTION (final_plan.md §3)
# =====================================================================
#
# A Project is an authoring/governance container for a contributor's
# dossier on a single heritage subject. It references ontology
# instances (CulturalEntity, Media, etc.) without being one itself.


class Project(models.Model):
    STATE_DRAFT = "draft"
    STATE_IN_REVIEW = "in_review"
    STATE_NEEDS_REVISION = "needs_revision"
    STATE_APPROVED = "approved"
    STATE_MERGED = "merged"
    STATE_WITHDRAWN = "withdrawn"
    STATE_CHOICES = [
        (STATE_DRAFT, "Draft"),
        (STATE_IN_REVIEW, "In Review"),
        (STATE_NEEDS_REVISION, "Needs Revision"),
        (STATE_APPROVED, "Approved"),
        (STATE_MERGED, "Merged"),
        (STATE_WITHDRAWN, "Withdrawn"),
    ]

    VISIBILITY_PRIVATE = "private"
    VISIBILITY_ORG = "org"
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PRIVATE, "Private"),
        (VISIBILITY_ORG, "Organization"),
        (VISIBILITY_PUBLIC, "Public"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=200)
    abstract = models.TextField(blank=True)
    intended_subject = models.CharField(
        max_length=120,
        blank=True,
        help_text="Free-text subject hint (e.g. 'temple', 'ritual'); guides class suggestions.",
    )
    languages = models.JSONField(
        default=list,
        blank=True,
        help_text="List of BCP-47 language tags this project authors in.",
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="owned_projects",
    )
    collaborators = models.ManyToManyField(
        User,
        through="ProjectMembership",
        through_fields=("project", "user"),
        related_name="projects",
        blank=True,
    )

    visibility = models.CharField(
        max_length=10,
        choices=VISIBILITY_CHOICES,
        default=VISIBILITY_PRIVATE,
    )
    state = models.CharField(
        max_length=20,
        choices=STATE_CHOICES,
        default=STATE_DRAFT,
    )

    forked_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forks",
    )

    schema_version = models.CharField(
        max_length=40,
        blank=True,
        help_text="Git SHA of ontology/HeritageGraph.yaml at project start.",
    )
    canvas_state = models.JSONField(
        default=dict,
        blank=True,
        help_text="Persistent node positions for the drag-and-arrow canvas.",
    )

    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Free-form tags used by reviewer-queue filters.",
    )

    submitted_at = models.DateTimeField(null=True, blank=True)
    merged_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["state"]),
            models.Index(fields=["visibility"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_state_display()})"


class ProjectMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_EDITOR = "editor"
    ROLE_VIEWER = "viewer"
    ROLE_DOMAIN_EXPERT = "domain_expert"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_EDITOR, "Editor"),
        (ROLE_VIEWER, "Viewer"),
        (ROLE_DOMAIN_EXPERT, "Domain Expert"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_EDITOR,
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_invitations_sent",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "project_memberships"
        unique_together = [("project", "user")]
        indexes = [
            models.Index(fields=["project", "role"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user} {self.role} on {self.project_id}"


class ProjectAsset(models.Model):
    ROLE_EVIDENCE = "evidence"
    ROLE_PRIMARY = "primary"
    ROLE_REFERENCE = "reference"
    ROLE_CHOICES = [
        (ROLE_EVIDENCE, "Evidence"),
        (ROLE_PRIMARY, "Primary"),
        (ROLE_REFERENCE, "Reference"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="assets",
    )
    media = models.ForeignKey(
        Media,
        on_delete=models.PROTECT,
        related_name="project_assets",
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_EVIDENCE,
    )
    caption = models.CharField(max_length=255, blank=True)
    version_label = models.CharField(
        max_length=120,
        blank=True,
        help_text="Contributor label for this revision of the attachment (v2, revised-2026, …).",
    )
    entity_suggestions = models.JSONField(
        default=list,
        blank=True,
        help_text="Suggested ontology links from OCR/NER pipelines (stub until full matching).",
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="project_assets_uploaded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_assets"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "role"]),
        ]

    def __str__(self):
        return f"Asset {self.media_id} on project {self.project_id}"


class ProjectSnapshot(models.Model):
    """Point-in-time JSON snapshot before a merge (rollback aid for moderators)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="snapshots",
    )
    merged_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_snapshots_recorded",
    )
    snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Serialized pointers (entity ids, title, slug) captured at merge time.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_snapshots"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"]),
        ]

    def __str__(self):
        return f"Snapshot for {self.project_id} ({self.created_at})"


class ProjectEntity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="entities",
    )
    entity = models.ForeignKey(
        CulturalEntity,
        on_delete=models.CASCADE,
        related_name="project_links",
    )
    role_in_project = models.CharField(
        max_length=120,
        blank=True,
        help_text="Free-text role, e.g. 'subject', 'context', 'reference'.",
    )
    added_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="project_entities_added",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_entities"
        unique_together = [("project", "entity")]
        ordering = ["-added_at"]
        indexes = [
            models.Index(fields=["project"]),
            models.Index(fields=["entity"]),
        ]

    def __str__(self):
        return f"Entity {self.entity_id} on project {self.project_id}"


class ProjectActivity(models.Model):
    """Scoped audit log for a project. Separate from the global ActivityLog."""

    ACTION_CREATED = "created"
    ACTION_UPDATED = "updated"
    ACTION_STATE_CHANGED = "state_changed"
    ACTION_MEMBER_ADDED = "member_added"
    ACTION_MEMBER_REMOVED = "member_removed"
    ACTION_ASSET_ADDED = "asset_added"
    ACTION_ASSET_REMOVED = "asset_removed"
    ACTION_ENTITY_LINKED = "entity_linked"
    ACTION_ENTITY_UNLINKED = "entity_unlinked"
    ACTION_SUBMITTED = "submitted"
    ACTION_REVIEWED = "reviewed"
    ACTION_MERGED = "merged"
    ACTION_FORKED = "forked"
    ACTION_COMMENTED = "commented"

    ACTION_CHOICES = [
        (ACTION_CREATED, "Created"),
        (ACTION_UPDATED, "Updated"),
        (ACTION_STATE_CHANGED, "State Changed"),
        (ACTION_MEMBER_ADDED, "Member Added"),
        (ACTION_MEMBER_REMOVED, "Member Removed"),
        (ACTION_ASSET_ADDED, "Asset Added"),
        (ACTION_ASSET_REMOVED, "Asset Removed"),
        (ACTION_ENTITY_LINKED, "Entity Linked"),
        (ACTION_ENTITY_UNLINKED, "Entity Unlinked"),
        (ACTION_SUBMITTED, "Submitted"),
        (ACTION_REVIEWED, "Reviewed"),
        (ACTION_MERGED, "Merged"),
        (ACTION_FORKED, "Forked"),
        (ACTION_COMMENTED, "Commented"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_activities",
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    target_kind = models.CharField(
        max_length=40,
        blank=True,
        help_text="Optional kind hint for the target (e.g. 'entity', 'asset', 'membership').",
    )
    target_id = models.CharField(max_length=64, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_activities"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"]),
            models.Index(fields=["actor"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"{self.action} on project {self.project_id} by {self.actor_id}"
