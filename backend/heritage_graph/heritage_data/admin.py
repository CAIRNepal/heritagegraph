from django.contrib import admin
from .models import Submission, Moderation,ActivityLog, UserProfile


# Admin for Submission model
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('title', 'contributor', 'status', 'created_at')  # Key fields for display
    list_filter = ('status', 'contributor', 'created_at')  # Filters for narrowing search
    search_fields = ('title', 'description')  # Searchable fields
    ordering = ('-created_at',)  # Recent submissions first

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
    


class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'score','position','birth_date','university_school')

class ActivityLogAdmin(admin.ModelAdmin):
    lisst_display = ('user','action','description','timestamp')

admin.site.register(UserProfile, UserProfileAdmin)
admin.site.register(Submission, SubmissionAdmin)
admin.site.register(Moderation, ModerationAdmin)
admin.site.register(ActivityLog, ActivityLogAdmin)
