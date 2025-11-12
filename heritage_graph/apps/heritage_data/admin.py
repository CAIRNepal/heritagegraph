from django.contrib import admin
from django.utils.html import format_html

from .models import (
    ActivityLog,
    Comments,
    Contributor,
    CulturalHeritage,
    Media,
    Moderation,
    Notification,
    Submission,
    SubmissionEditSuggestion,
    SubmissionVersion,
    UserProfile,
    UserStats,
    CulturalEntity,
    Revision,
    Activity,
)


# Admin for CulturalHeritage model
class CulturalHeritageAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "heritage_type",
        "location",
        "created_at",
    )  # Key fields for display
    list_filter = ("heritage_type", "created_at")  # Filters for narrowing search
    search_fields = ("title", "description", "location")  # Searchable fields
    ordering = ("-created_at",)  # Recent heritage entries first


# Admin for Media model
class MediaAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "media_type",
        "file",
        "description",
    )  # Key fields for display
    list_filter = ("media_type", "submission")  # Filters for narrowing search
    search_fields = ("file", "description")  # Searchable fields
    ordering = ("submission",)


# Admin for Contributor model
class ContributorAdmin(admin.ModelAdmin):
    list_display = (
        "user_username",
        "relationship_to_heritage",
        "consent_to_share",
    )  # Key fields for display
    list_filter = ("user", "consent_to_share")  # Filters for narrowing search
    search_fields = ("user__username", "relationship_to_heritage")  # Searchable fields
    ordering = ("user",)

    # Add a method to display the username of the related user
    def user_username(self, obj):
        return obj.user.username

    user_username.short_description = (
        "Username"  # Optional: Sets the column header in the admin
    )


# Admin for Submission model


class SubmissionAdmin(admin.ModelAdmin):
    fields = [
        "submission_id",
        "title",
        "description",
        "contributor",
        "status",
        "cultural_heritage",
        "contribution_type",
        "contribution_data",
    ]
    list_display = [
        "submission_id",
        "title",
        "contributor",
        "status",
        "created_at",
        "contribution_type",
    ]
    search_fields = ["title", "contributor__username"]
    list_filter = ["status"]


# Admin for Moderation model
class ModerationAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "moderator",
        "reviewed_at",
        "short_comment",
    )  # Add a truncated comment display
    list_filter = ("moderator", "reviewed_at")  # Add reviewed_at to filters
    search_fields = (
        "submission__title",
        "moderator__username",
        "remark",
    )  # Include moderator in search
    ordering = ("-reviewed_at",)  # Recent reviews first

    # Add a short version of the comment
    def short_comment(self, obj):
        return obj.comment[:50] + ("..." if len(obj.comment) > 50 else "")

    short_comment.short_description = "Comment"


# Admin for UserProfile model
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "clerk_user_id",
        "user",
        "organization",
        "score",
        "position",
        "birth_date",
        "university_school",
    )  # Key fields for display
    list_filter = (
        "clerk_user_id",
        "organization",
        "university_school",
    )  # Filters for narrowing search
    search_fields = (
        "user__username",
        "organization",
        "university_school",
    )  # Searchable fields
    ordering = ("user__username",)  # Order by username


# Admin for ActivityLog model
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "action",
        "short_description",
        "timestamp",
    )  # Key fields for display
    list_filter = ("action", "timestamp")  # Filters for narrowing search
    search_fields = ("user__username", "action", "description")  # Searchable fields
    ordering = ("-timestamp",)  # Recent logs first

    # Add a short version of the description
    def short_description(self, obj):
        return obj.description[:50] + ("..." if len(obj.description) > 50 else "")

    short_description.short_description = "Description"


@admin.register(Comments)
class CommentsAdmin(admin.ModelAdmin):
    list_display = ("comment_id", "id", "user", "submission", "created_at")
    search_fields = ("comment", "user__username", "submission__title")


@admin.register(SubmissionVersion)
class SubmissionVersionAdmin(admin.ModelAdmin):
    list_display = ("submission", "version_number", "updated_by", "updated_at")
    list_filter = ("updated_by", "updated_at")
    search_fields = ("submission__title", "updated_by__username")


@admin.register(SubmissionEditSuggestion)
class SubmissionEditSuggestionAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "suggested_by",
        "approved",
        "reviewed_by",
        "created_at",
        "reviewed_at",
    )
    list_filter = ("approved", "suggested_by", "reviewed_by", "created_at")
    search_fields = (
        "submission__title",
        "suggested_by__username",
        "reviewed_by__username",
    )
    readonly_fields = ("created_at", "reviewed_at")


@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "total_submissions",
        "submissions_this_month",
        "submissions_last_month",
        "submissions_growth",
        "approval_rate",
        "approval_rate_change",
        "contributor_rank",
        "community_impact_score",
        "updated_at",
    )
    search_fields = ("user__username",)
    readonly_fields = ("updated_at",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "notification_id",
        "user",
        "notification_type",
        "submission",
        "is_read",
        "created_at",
    )
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("notification_id", "user__username", "message")
    ordering = ("-created_at",)
    readonly_fields = ("notification_id", "created_at")

    # mark as read action
    actions = ["mark_as_read"]

    def mark_as_read(self, request, queryset):
        updated_count = queryset.update(is_read=True)
        self.message_user(request, f"{updated_count} notifications marked as read.")

    mark_as_read.short_description = "Mark selected notifications as read"

@admin.register(CulturalEntity)
class CulturalEntityAdmin(admin.ModelAdmin):
    list_display = (
        "entity_id",
        "name",
        "category",
        "status_colored",
        "contributor",
        "created_at",
        "updated_at",
    )
    list_filter = ("status", "category", "created_at")
    search_fields = ("name", "description", "contributor__username", "category")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    list_per_page = 25

    fieldsets = (
        ("Basic Info", {
            "fields": ("name", "description", "category", "status")
        }),
        ("Contributor & Metadata", {
            "fields": ("contributor", "created_at", "updated_at")
        }),
    )

    def status_colored(self, obj):
        color_map = {
            "draft": "#808080",            # gray
            "pending_review": "#FFA500",   # orange
            "accepted": "#008000",         # green
            "rejected": "#FF0000",         # red
            "pending_revision": "#4682B4", # steel blue
        }
        color = color_map.get(obj.status, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_status_display())

    status_colored.short_description = "Status"


@admin.register(Revision)
class RevisionAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "revision_number",
        "created_by",
        "created_at",
        "short_data_preview",
    )
    list_filter = ("created_at",)
    search_fields = ("entity__name", "created_by__username")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
    list_per_page = 25

    fieldsets = (
        ("Revision Info", {
            "fields": ("entity", "revision_number", "data")
        }),
        ("Metadata", {
            "fields": ("created_by", "created_at")
        }),
    )

    def short_data_preview(self, obj):
        """Show a shortened JSON preview in list view."""
        preview = str(obj.data)
        return (preview[:75] + "...") if len(preview) > 75 else preview

    short_data_preview.short_description = "Revision Data (Preview)"


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = (
        "activity_id",
        "entity",
        "activity_type_colored",
        "user",
        "comment_short",
        "created_at",
    )
    list_filter = ("activity_type", "created_at")
    search_fields = ("entity__name", "user__username", "comment")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
    list_per_page = 25

    fieldsets = (
        ("Activity Info", {
            "fields": ("entity", "activity_type", "comment")
        }),
        ("User & Timestamps", {
            "fields": ("user", "created_at")
        }),
    )

    def activity_type_colored(self, obj):
        color_map = {
            "submitted": "#4169E1",  # royal blue
            "accepted": "#228B22",   # forest green
            "rejected": "#B22222",   # firebrick
            "revised": "#8B008B",    # dark magenta
            "commented": "#708090",  # slate gray
        }
        color = color_map.get(obj.activity_type, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_activity_type_display())

    activity_type_colored.short_description = "Activity Type"

    def comment_short(self, obj):
        if not obj.comment:
            return "-"
        return (obj.comment[:50] + "...") if len(obj.comment) > 50 else obj.comment

    comment_short.short_description = "Comment"


# Optional: inline views for Revision & Activity in CulturalEntity admin
class RevisionInline(admin.TabularInline):
    model = Revision
    extra = 0
    readonly_fields = ("created_at", "created_by")
    show_change_link = True
    ordering = ("-revision_number",)


class ActivityInline(admin.TabularInline):
    model = Activity
    extra = 0
    readonly_fields = ("created_at", "user", "activity_type", "comment")
    show_change_link = True
    ordering = ("-created_at",)


# Attach inlines to CulturalEntity admin
CulturalEntityAdmin.inlines = [RevisionInline, ActivityInline]

# Register all models with their respective admin classes
admin.site.register(CulturalHeritage, CulturalHeritageAdmin)
admin.site.register(Media, MediaAdmin)
admin.site.register(Contributor, ContributorAdmin)
admin.site.register(Submission, SubmissionAdmin)
admin.site.register(Moderation, ModerationAdmin)
admin.site.register(ActivityLog, ActivityLogAdmin)
admin.site.register(UserProfile, UserProfileAdmin)
# admin.site.register(Comments, CommentsAdmin)
