import secrets
import string

from django.contrib.auth import get_user_model
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

User = get_user_model()


def generate_unique_submission_id(length=11, max_attempts=100):
    characters = string.ascii_letters + string.digits
    for _ in range(max_attempts):
        new_id = "".join(secrets.choice(characters) for _ in range(length))
        if not Submission.objects.filter(submission_id=new_id).exists():
            return new_id
    raise Exception("Unable to generate a unique submission ID after many attempts.")


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
        "Submission", on_delete=models.CASCADE, related_name="media"
    )
    media_type = models.CharField(max_length=50, choices=MEDIA_TYPE_CHOICES)
    file = models.FileField(upload_to="heritage_media/")
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.media_type}: {self.file.name}"


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


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    clerk_user_id = models.CharField(
        max_length=255, blank=True, null=True, unique=True
    )  # <-- new field
    first_name = models.CharField(max_length=50, blank=True)
    middle_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    birth_date = models.DateField(blank=True, null=True)
    organization = models.CharField(max_length=255, blank=True)
    position = models.CharField(max_length=255, blank=True)
    score = models.IntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    university_school = models.CharField(max_length=255, blank=True)

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
        "Submission", on_delete=models.CASCADE, related_name="comments"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="user_comments"
    )
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.comment_id:
            self.comment_id = generate_unique_comment_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Comment by {self.user.username} on {self.submission.title}"


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
