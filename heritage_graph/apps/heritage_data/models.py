from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator

import secrets
import string
from django.db import models


User = get_user_model()

def generate_unique_submission_id(length=11, max_attempts=100):
    characters = string.ascii_letters + string.digits
    for _ in range(max_attempts):
        new_id = ''.join(secrets.choice(characters) for _ in range(length))
        if not Submission.objects.filter(submission_id=new_id).exists():
            return new_id
    raise Exception("Unable to generate a unique submission ID after many attempts.")



class CulturalHeritage(models.Model):
    TYPE_CHOICES = [
        ('tangible', 'Tangible Heritage'),
        ('intangible', 'Intangible Heritage'),
        ('natural', 'Natural Heritage'),
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
        ('image', 'Image'),
        ('video', 'Video'),
        ('audio', 'Audio'),
    ]
    submission = models.ForeignKey('Submission', on_delete=models.CASCADE, related_name='media')
    media_type = models.CharField(max_length=50, choices=MEDIA_TYPE_CHOICES)
    file = models.FileField(upload_to='heritage_media/')
    description = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.media_type}: {self.file.name}"

class Contributor(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contributions')
    relationship_to_heritage = models.TextField()
    consent_to_share = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.user.username} - {self.relationship_to_heritage}"

STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('accepted', 'Accepted'),
    ('rejected', 'Rejected'),
    ('review', 'Review'),
]

class Submission(models.Model):
    submission_id = models.CharField(max_length=11, unique=True, blank=True)

    def save(self, *args, **kwargs):
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
                updated_by=self.contributor  # or whoever's editing it
            )
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    contributor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    cultural_heritage = models.ForeignKey('CulturalHeritage', on_delete=models.CASCADE, null=True, blank=True)
    contribution_type = models.CharField(max_length=100) 
    created_at = models.DateTimeField(auto_now_add=True)

    contribution_data = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class Moderation(models.Model):
    submission = models.OneToOneField(Submission, on_delete=models.CASCADE, related_name='moderation')
    moderator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='moderated_items')
    remarks = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True) 
    
    def __str__(self):
        moderator_name = self.moderator.username if self.moderator else "No Moderator"
        return f"Moderation for {self.submission.title} by {moderator_name}"

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    first_name = models.CharField(max_length=50, blank=True)
    middle_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)  # Removed unique=True
    birth_date = models.DateField(blank=True, null=True)
    organization = models.CharField(max_length=255, blank=True)
    position = models.CharField(max_length=255, blank=True)
    score = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    university_school = models.CharField(max_length=255, blank=True)
    
    def __str__(self):
        return self.user.username

class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ('add', 'Added'),
        ('edit', 'Edited'),
        ('delete', 'Deleted'),
        ('review', 'Reviewed'),
        ('remarks', 'Commented'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} {self.get_action_display()} {self.description} at {self.timestamp}"
    


# Place this at the top level, outside any class
def generate_unique_comment_id(length=11, max_attempts=100):
    """Generates a unique random comment ID."""
    characters = string.ascii_letters + string.digits
    for _ in range(max_attempts):
        new_id = ''.join(secrets.choice(characters) for _ in range(length))
        if not Comments.objects.filter(comment_id=new_id).exists():
            return new_id
    raise Exception("Unable to generate a unique comment ID after many attempts.")


class Comments(models.Model):
    comment_id = models.CharField(
        max_length=11,
        unique=True,
        blank=True,
        editable=False
    )
    submission = models.ForeignKey('Submission', on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_comments')
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.comment_id:
            self.comment_id = generate_unique_comment_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Comment by {self.user.username} on {self.submission.title}"


class SubmissionVersion(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    description = models.TextField()
    contribution_data = models.JSONField(default=dict)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']
        unique_together = ('submission', 'version_number')

    def __str__(self):
        return f"Version {self.version_number} of {self.submission.title}"
    

class SubmissionEditSuggestion(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='edit_suggestions')
    suggested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='suggested_edits')
    title = models.CharField(max_length=255)
    description = models.TextField()
    contribution_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    approved = models.BooleanField(null=True, blank=True)  
    
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_suggestions')
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
