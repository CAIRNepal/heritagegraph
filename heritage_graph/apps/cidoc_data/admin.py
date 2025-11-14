from django.contrib import admin
from .models import *

# Core models
@admin.register(HistoricalPeriod)
class HistoricalPeriodAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_year', 'end_year']
    search_fields = ['name']

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'current_status']
    list_filter = ['type', 'current_status']
    search_fields = ['name']

@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ['name', 'occupation', 'birth_date']
    search_fields = ['name', 'aliases']

@admin.register(Artifact)
class ArtifactAdmin(admin.ModelAdmin):
    list_display = ['name', 'material', 'condition', 'status']
    list_filter = ['condition', 'status', 'material']
    search_fields = ['name', 'aliases']

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'recurrence']
    list_filter = ['type', 'recurrence']
    search_fields = ['name']

@admin.register(Tradition)
class TraditionAdmin(admin.ModelAdmin):
    list_display = ['name', 'type']
    list_filter = ['type']
    search_fields = ['name']

@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ['title', 'type', 'publication_year']
    list_filter = ['type']
    search_fields = ['title', 'authors']

# Revision models
@admin.register(HistoricalPeriodRevision)
class HistoricalPeriodRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__name']

@admin.register(LocationRevision)
class LocationRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__name']

@admin.register(PersonRevision)
class PersonRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__name']

@admin.register(ArtifactRevision)
class ArtifactRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__name']

@admin.register(EventRevision)
class EventRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__name']

@admin.register(TraditionRevision)
class TraditionRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__name']

@admin.register(SourceRevision)
class SourceRevisionAdmin(admin.ModelAdmin):
    list_display = ['revision_id', 'uid', 'user', 'timestamp', 'action']
    list_filter = ['action', 'timestamp']
    search_fields = ['uid__title']

# Activity model
@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ['activity_id', 'user', 'activity_type', 'timestamp']
    list_filter = ['activity_type', 'timestamp']
    search_fields = ['user__username']

# Comment models
@admin.register(HistoricalPeriodComment)
class HistoricalPeriodCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(LocationComment)
class LocationCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(PersonComment)
class PersonCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(ArtifactComment)
class ArtifactCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(EventComment)
class EventCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(TraditionComment)
class TraditionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(SourceComment)
class SourceCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

# Revision comment models
@admin.register(HistoricalPeriodRevisionComment)
class HistoricalPeriodRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(LocationRevisionComment)
class LocationRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(PersonRevisionComment)
class PersonRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(ArtifactRevisionComment)
class ArtifactRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(EventRevisionComment)
class EventRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(TraditionRevisionComment)
class TraditionRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

@admin.register(SourceRevisionComment)
class SourceRevisionCommentAdmin(admin.ModelAdmin):
    list_display = ['comment_id', 'uid', 'user', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['user__username', 'comment']

# Notification model
@admin.register(NotificationForUser)
class NotificationForUserAdmin(admin.ModelAdmin):
    list_display = ['notification_id', 'user', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['user__username', 'message']