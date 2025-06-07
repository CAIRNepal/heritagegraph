from django.contrib import admin
from .models import Submission, Moderation, ActivityLog, UserProfile, CulturalHeritage, Media, Contributor

# Admin for CulturalHeritage model
class CulturalHeritageAdmin(admin.ModelAdmin):
    list_display = ('title', 'heritage_type', 'location', 'created_at')  # Key fields for display
    list_filter = ('heritage_type', 'created_at')  # Filters for narrowing search
    search_fields = ('title', 'description', 'location')  # Searchable fields
    ordering = ('-created_at',)  # Recent heritage entries first


# Admin for Media model
class MediaAdmin(admin.ModelAdmin):
    list_display = ('submission', 'media_type', 'file', 'description')  # Key fields for display
    list_filter = ('media_type', 'submission')  # Filters for narrowing search
    search_fields = ('file', 'description')  # Searchable fields
    ordering = ('submission',)


# Admin for Contributor model
class ContributorAdmin(admin.ModelAdmin):
    list_display = ('user_username', 'relationship_to_heritage', 'consent_to_share')  # Key fields for display
    list_filter = ('user', 'consent_to_share')  # Filters for narrowing search
    search_fields = ('user__username', 'relationship_to_heritage')  # Searchable fields
    ordering = ('user',)

    # Add a method to display the username of the related user
    def user_username(self, obj):
        return obj.user.username
    user_username.short_description = 'Username'  # Optional: Sets the column header in the admin


# Admin for Submission model

class SubmissionAdmin(admin.ModelAdmin):
    fields = ['title', 'description', 'contributor', 'status', 'cultural_heritage', 'contribution_type', 'contribution_data']
    list_display = ['title', 'contributor', 'status', 'created_at', 'contribution_type']
    search_fields = ['title', 'contributor__username']
    list_filter = ['status']


# Admin for Moderation model
class ModerationAdmin(admin.ModelAdmin):
    list_display = ('submission', 'moderator', 'reviewed_at', 'short_comment')  # Add a truncated comment display
    list_filter = ('moderator', 'reviewed_at')  # Add reviewed_at to filters
    search_fields = ('submission__title', 'moderator__username', 'comment')  # Include moderator in search
    ordering = ('-reviewed_at',)  # Recent reviews first

    # Add a short version of the comment
    def short_comment(self, obj):
        return obj.comment[:50] + ('...' if len(obj.comment) > 50 else '')
    short_comment.short_description = 'Comment'


# Admin for UserProfile model
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'score', 'position', 'birth_date', 'university_school')  # Key fields for display
    list_filter = ('organization', 'university_school')  # Filters for narrowing search
    search_fields = ('user__username', 'organization', 'university_school')  # Searchable fields
    ordering = ('user__username',)  # Order by username


# Admin for ActivityLog model
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'short_description', 'timestamp')  # Key fields for display
    list_filter = ('action', 'timestamp')  # Filters for narrowing search
    search_fields = ('user__username', 'action', 'description')  # Searchable fields
    ordering = ('-timestamp',)  # Recent logs first

    # Add a short version of the description
    def short_description(self, obj):
        return obj.description[:50] + ('...' if len(obj.description) > 50 else '')
    short_description.short_description = 'Description'


# Register all models with their respective admin classes
admin.site.register(CulturalHeritage, CulturalHeritageAdmin)
admin.site.register(Media, MediaAdmin)
admin.site.register(Contributor, ContributorAdmin)
admin.site.register(Submission, SubmissionAdmin)
admin.site.register(Moderation, ModerationAdmin)
admin.site.register(ActivityLog, ActivityLogAdmin)
admin.site.register(UserProfile, UserProfileAdmin)