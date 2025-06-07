from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()

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
    comment = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True)  # Changed to auto_now_add=True
    
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
        ('comment', 'Commented'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} {self.get_action_display()} {self.description} at {self.timestamp}"