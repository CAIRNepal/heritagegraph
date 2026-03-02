from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Activity,
    ActivityLog,
    Comments,
    Contributor,
    CulturalEntity,
    CulturalHeritage,
    Fork,
    Media,
    Moderation,
    Notification,
    Organization,
    OrganizationMembership,
    Reaction,
    ReviewDecision,
    ReviewerRole,
    ReviewFlag,
    Revision,
    Share,
    Submission,
    SubmissionEditSuggestion,
    SubmissionVersion,
    UserProfile,
    UserStats,
)


# =====================================================================
# CULTURAL ENTITY WORKFLOW (core contribution pipeline)
# =====================================================================

class RevisionInline(admin.TabularInline):
    model = Revision
    extra = 0
    readonly_fields = ("revision_id", "revision_number", "created_by", "created_at")
    show_change_link = True
    ordering = ("-revision_number",)
    fields = ("revision_number", "created_by", "created_at", "data")


class ActivityInline(admin.TabularInline):
    model = Activity
    extra = 0
    readonly_fields = ("activity_id", "user", "activity_type", "comment", "created_at")
    show_change_link = True
    ordering = ("-created_at",)


class ReviewDecisionInline(admin.TabularInline):
    model = ReviewDecision
    extra = 0
    readonly_fields = ("id", "reviewer", "verdict", "created_at")
    show_change_link = True
    ordering = ("-created_at",)
    fields = ("reviewer", "verdict", "conflict_handling", "feedback", "created_at")


class ReviewFlagInline(admin.TabularInline):
    model = ReviewFlag
    extra = 0
    readonly_fields = ("id", "flagged_by", "flag_type", "created_at")
    show_change_link = True
    ordering = ("-created_at",)
    fields = ("flag_type", "flagged_by", "reason", "is_resolved", "created_at")


class ReactionInline(admin.TabularInline):
    model = Reaction
    fk_name = "entity"
    extra = 0
    readonly_fields = ("id", "user", "reaction_type", "created_at")


class ForkInline(admin.TabularInline):
    model = Fork
    fk_name = "original_entity"
    extra = 0
    readonly_fields = ("id", "forked_by", "forked_entity", "created_at")
    fields = ("forked_by", "forked_entity", "reason", "created_at")


@admin.register(CulturalEntity)
class CulturalEntityAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "status_colored",
        "contributor",
        "revision_count",
        "created_at",
    )
    list_filter = ("status", "category", "created_at")
    search_fields = ("name", "description", "contributor__username")
    readonly_fields = ("entity_id", "created_at", "updated_at")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("contributor",)
    inlines = [
        RevisionInline,
        ActivityInline,
        ReviewDecisionInline,
        ReviewFlagInline,
        ReactionInline,
        ForkInline,
    ]

    fieldsets = (
        ("Basic Info", {
            "fields": ("entity_id", "name", "description", "category"),
        }),
        ("Status & Review", {
            "fields": ("status", "current_revision"),
        }),
        ("Contributor & Metadata", {
            "fields": ("contributor", "created_at", "updated_at"),
        }),
    )

    actions = ["mark_accepted", "mark_rejected", "mark_pending_review"]

    def status_colored(self, obj):
        color_map = {
            "draft": "#808080",
            "pending_review": "#FFA500",
            "accepted": "#008000",
            "rejected": "#FF0000",
            "pending_revision": "#4682B4",
        }
        color = color_map.get(obj.status, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_status_display())
    status_colored.short_description = "Status"

    def revision_count(self, obj):
        return obj.revisions.count()
    revision_count.short_description = "Revisions"

    @admin.action(description="Mark selected as Accepted")
    def mark_accepted(self, request, queryset):
        queryset.update(status="accepted")

    @admin.action(description="Mark selected as Rejected")
    def mark_rejected(self, request, queryset):
        queryset.update(status="rejected")

    @admin.action(description="Mark selected as Pending Review")
    def mark_pending_review(self, request, queryset):
        queryset.update(status="pending_review")


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
    readonly_fields = ("revision_id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("entity", "created_by")

    fieldsets = (
        ("Revision Info", {
            "fields": ("revision_id", "entity", "revision_number", "data"),
        }),
        ("Metadata", {
            "fields": ("created_by", "created_at"),
        }),
    )

    def short_data_preview(self, obj):
        preview = str(obj.data)
        return (preview[:75] + "...") if len(preview) > 75 else preview
    short_data_preview.short_description = "Data Preview"


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "activity_type_colored",
        "user",
        "comment_short",
        "created_at",
    )
    list_filter = ("activity_type", "created_at")
    search_fields = ("entity__name", "user__username", "comment")
    readonly_fields = ("activity_id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("entity", "user")

    fieldsets = (
        ("Activity Info", {
            "fields": ("activity_id", "entity", "activity_type", "comment"),
        }),
        ("User & Timestamps", {
            "fields": ("user", "created_at"),
        }),
    )

    def activity_type_colored(self, obj):
        color_map = {
            "submitted": "#4169E1",
            "accepted": "#228B22",
            "rejected": "#B22222",
            "revised": "#8B008B",
            "commented": "#708090",
            "escalated": "#FF8C00",
            "changes_requested": "#DAA520",
            "flagged": "#DC143C",
            "conflict_resolved": "#2E8B57",
        }
        color = color_map.get(obj.activity_type, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_activity_type_display())
    activity_type_colored.short_description = "Activity Type"

    def comment_short(self, obj):
        if not obj.comment:
            return "-"
        return (obj.comment[:60] + "...") if len(obj.comment) > 60 else obj.comment
    comment_short.short_description = "Comment"


# =====================================================================
# EPISTEMIC REVIEW SYSTEM
# =====================================================================

@admin.register(ReviewerRole)
class ReviewerRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role_colored", "is_active", "expertise_preview", "assigned_by", "created_at")
    list_filter = ("role", "is_active", "created_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")
    list_select_related = ("user", "assigned_by")
    list_per_page = 25

    fieldsets = (
        ("Role Assignment", {
            "fields": ("id", "user", "role", "is_active", "assigned_by"),
        }),
        ("Expertise", {
            "fields": ("expertise_areas",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    def role_colored(self, obj):
        color_map = {
            "community_reviewer": "#4169E1",
            "domain_expert": "#8B008B",
            "expert_curator": "#B8860B",
        }
        color = color_map.get(obj.role, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_role_display())
    role_colored.short_description = "Role"

    def expertise_preview(self, obj):
        if not obj.expertise_areas:
            return "-"
        return ", ".join(obj.expertise_areas[:3]) + ("..." if len(obj.expertise_areas) > 3 else "")
    expertise_preview.short_description = "Expertise"


@admin.register(ReviewDecision)
class ReviewDecisionAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "reviewer",
        "verdict_colored",
        "conflict_handling",
        "confidence_override",
        "created_at",
    )
    list_filter = ("verdict", "conflict_handling", "confidence_override", "created_at")
    search_fields = ("entity__name", "reviewer__username", "feedback", "reconciliation_note")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("entity", "reviewer", "revision_reviewed", "escalated_to")

    fieldsets = (
        ("Decision", {
            "fields": ("id", "entity", "reviewer", "revision_reviewed", "verdict"),
        }),
        ("Conflict & Confidence", {
            "fields": ("conflict_handling", "confidence_override", "verification_method"),
        }),
        ("Feedback", {
            "fields": ("feedback", "reconciliation_note", "internal_note"),
        }),
        ("Escalation", {
            "fields": ("escalated_to",),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    def verdict_colored(self, obj):
        color_map = {
            "accept": "#228B22",
            "accept_with_edits": "#6B8E23",
            "request_changes": "#DAA520",
            "reject": "#B22222",
            "escalate": "#FF8C00",
        }
        color = color_map.get(obj.verdict, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_verdict_display())
    verdict_colored.short_description = "Verdict"


@admin.register(ReviewFlag)
class ReviewFlagAdmin(admin.ModelAdmin):
    list_display = ("entity", "flag_type", "flagged_by", "is_resolved", "resolved_by", "created_at")
    list_filter = ("flag_type", "is_resolved", "created_at")
    search_fields = ("entity__name", "flagged_by__username", "reason")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("entity", "flagged_by", "resolved_by")

    fieldsets = (
        ("Flag Info", {
            "fields": ("id", "entity", "flag_type", "flagged_by", "reason"),
        }),
        ("Resolution", {
            "fields": ("is_resolved", "resolved_by", "resolved_at"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    actions = ["mark_resolved"]

    @admin.action(description="Mark selected flags as resolved")
    def mark_resolved(self, request, queryset):
        from django.utils import timezone
        queryset.update(is_resolved=True, resolved_by=request.user, resolved_at=timezone.now())


# =====================================================================
# REACTIONS, FORKS, SHARES
# =====================================================================

@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("user", "reaction_type", "entity", "comment", "created_at")
    list_filter = ("reaction_type", "created_at")
    search_fields = ("user__username", "entity__name")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 50


@admin.register(Fork)
class ForkAdmin(admin.ModelAdmin):
    list_display = ("original_entity", "forked_entity", "forked_by", "reason_short", "created_at")
    list_filter = ("created_at",)
    search_fields = ("original_entity__name", "forked_entity__name", "forked_by__username", "reason")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("original_entity", "forked_entity", "forked_by")

    def reason_short(self, obj):
        if not obj.reason:
            return "-"
        return (obj.reason[:60] + "...") if len(obj.reason) > 60 else obj.reason
    reason_short.short_description = "Reason"


@admin.register(Share)
class ShareAdmin(admin.ModelAdmin):
    list_display = ("entity", "platform", "user", "created_at")
    list_filter = ("platform", "created_at")
    search_fields = ("entity__name", "user__username")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 50


# =====================================================================
# ORGANIZATIONS & COMMUNITY
# =====================================================================

class OrganizationMembershipInline(admin.TabularInline):
    model = OrganizationMembership
    extra = 0
    readonly_fields = ("id", "joined_at")
    fields = ("user", "role", "joined_at")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "short_name", "owner", "is_verified", "member_count_display", "created_at")
    list_filter = ("is_verified", "country", "created_at")
    search_fields = ("name", "short_name", "description", "owner__username")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("name",)
    list_per_page = 25
    list_select_related = ("owner",)
    inlines = [OrganizationMembershipInline]

    fieldsets = (
        ("Basic Info", {
            "fields": ("id", "name", "short_name", "description", "logo"),
        }),
        ("Details", {
            "fields": ("website", "country", "focus_areas"),
        }),
        ("Ownership & Status", {
            "fields": ("owner", "is_verified"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    def member_count_display(self, obj):
        return obj.member_count
    member_count_display.short_description = "Members"


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "joined_at")
    list_filter = ("role", "joined_at")
    search_fields = ("user__username", "organization__name")
    readonly_fields = ("id", "joined_at")
    list_select_related = ("user", "organization")


# =====================================================================
# NOTIFICATIONS
# =====================================================================

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "notification_type",
        "entity",
        "submission",
        "is_read",
        "message_short",
        "created_at",
    )
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("notification_id", "user__username", "message")
    readonly_fields = ("notification_id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 50
    list_select_related = ("user", "entity", "submission")

    fieldsets = (
        ("Notification", {
            "fields": ("notification_id", "user", "notification_type", "message"),
        }),
        ("Links", {
            "fields": ("entity", "submission", "link"),
        }),
        ("Status", {
            "fields": ("is_read", "created_at"),
        }),
    )

    actions = ["mark_as_read", "mark_as_unread"]

    @admin.action(description="Mark selected as read")
    def mark_as_read(self, request, queryset):
        count = queryset.update(is_read=True)
        self.message_user(request, f"{count} notifications marked as read.")

    @admin.action(description="Mark selected as unread")
    def mark_as_unread(self, request, queryset):
        count = queryset.update(is_read=False)
        self.message_user(request, f"{count} notifications marked as unread.")

    def message_short(self, obj):
        return (obj.message[:60] + "...") if len(obj.message) > 60 else obj.message
    message_short.short_description = "Message"


# =====================================================================
# COMMENTS
# =====================================================================

@admin.register(Comments)
class CommentsAdmin(admin.ModelAdmin):
    list_display = ("comment_id", "user", "submission", "parent", "comment_short", "created_at")
    list_filter = ("created_at",)
    search_fields = ("comment", "user__username", "submission__name")
    readonly_fields = ("comment_id", "created_at", "updated_at")
    ordering = ("-created_at",)
    list_per_page = 25
    list_select_related = ("user", "submission", "parent")

    def comment_short(self, obj):
        return (obj.comment[:60] + "...") if len(obj.comment) > 60 else obj.comment
    comment_short.short_description = "Comment"


# =====================================================================
# LEGACY MODELS (Submission pipeline)
# =====================================================================

@admin.register(CulturalHeritage)
class CulturalHeritageAdmin(admin.ModelAdmin):
    list_display = ("title", "heritage_type", "location", "created_at")
    list_filter = ("heritage_type", "created_at")
    search_fields = ("title", "description", "location")
    ordering = ("-created_at",)


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ("submission", "media_type", "file", "description")
    list_filter = ("media_type",)
    search_fields = ("file", "description")


@admin.register(Contributor)
class ContributorAdmin(admin.ModelAdmin):
    list_display = ("user_username", "relationship_to_heritage", "consent_to_share")
    list_filter = ("consent_to_share",)
    search_fields = ("user__username", "relationship_to_heritage")

    def user_username(self, obj):
        return obj.user.username
    user_username.short_description = "Username"


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("submission_id", "title", "contributor", "status", "contribution_type", "created_at")
    list_filter = ("status", "contribution_type")
    search_fields = ("title", "contributor__username", "submission_id")
    ordering = ("-created_at",)
    fields = (
        "submission_id", "title", "description", "contributor",
        "status", "cultural_heritage", "contribution_type", "contribution_data",
    )


@admin.register(Moderation)
class ModerationAdmin(admin.ModelAdmin):
    list_display = ("submission", "moderator", "reviewed_at", "remarks_short")
    list_filter = ("moderator", "reviewed_at")
    search_fields = ("submission__title", "moderator__username", "remarks")
    ordering = ("-reviewed_at",)

    def remarks_short(self, obj):
        if not obj.remarks:
            return "-"
        return (obj.remarks[:60] + "...") if len(obj.remarks) > 60 else obj.remarks
    remarks_short.short_description = "Remarks"


@admin.register(SubmissionVersion)
class SubmissionVersionAdmin(admin.ModelAdmin):
    list_display = ("submission", "version_number", "updated_by", "updated_at")
    list_filter = ("updated_at",)
    search_fields = ("submission__title", "updated_by__username")


@admin.register(SubmissionEditSuggestion)
class SubmissionEditSuggestionAdmin(admin.ModelAdmin):
    list_display = ("submission", "suggested_by", "approved", "reviewed_by", "created_at")
    list_filter = ("approved", "created_at")
    search_fields = ("submission__title", "suggested_by__username")
    readonly_fields = ("created_at", "reviewed_at")


# =====================================================================
# USER STATS & PROFILES
# =====================================================================

@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "total_submissions",
        "approval_rate",
        "contributor_rank",
        "community_impact_score",
        "updated_at",
    )
    search_fields = ("user__username",)
    readonly_fields = ("updated_at",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "position", "country", "score")
    list_filter = ("country", "organization")
    search_fields = ("user__username", "user__email", "organization", "area_of_expertise")
    readonly_fields = ("clerk_user_id",)
    ordering = ("user__username",)

    fieldsets = (
        ("User", {
            "fields": ("user", "clerk_user_id", "profile_image"),
        }),
        ("Personal Info", {
            "fields": ("first_name", "middle_name", "last_name", "email", "birth_date", "biography"),
        }),
        ("Professional", {
            "fields": ("organization", "position", "university_school", "area_of_expertise", "country"),
        }),
        ("Links & Score", {
            "fields": ("social_links", "website_link", "score"),
        }),
    )


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "description_short", "timestamp")
    list_filter = ("action", "timestamp")
    search_fields = ("user__username", "description")
    ordering = ("-timestamp",)

    def description_short(self, obj):
        return (obj.description[:60] + "...") if len(obj.description) > 60 else obj.description
    description_short.short_description = "Description"


# =====================================================================
# ADMIN SITE CUSTOMIZATION
# =====================================================================

admin.site.site_header = "HeritageGraph Administration"
admin.site.site_title = "HeritageGraph Admin"
admin.site.index_title = "Data Management"
