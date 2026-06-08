from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.serializers import ModelSerializer, ValidationError

from .models import (
    ActivityLog,
    Comments,
    Moderation,
    Organization,
    OrganizationMembership,
    Submission,
    SubmissionEditSuggestion,
    SubmissionVersion,
    UserProfile,
    PublicContribution,
)

User = get_user_model()
from apps.cidoc_data.models import EntityCluster
from .models import (
    CulturalEntity,
    Revision,
    Activity,
    ReviewDecision,
    ReviewFlag,
    ReviewerRole,
    ReviewerApplication,
    Notification,
    Reaction,
    Fork,
    Share,
    SchemaExtensionAuditEvent,
    SchemaExtensionProposal,
    EntityProposal,
    EntityProposalAuditEvent,
    RelationshipProposal,
    RelationshipProposalAuditEvent,
)


class SubmissionSerializer(serializers.ModelSerializer):
    contributor_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Submission
        fields = [
            "submission_id",
            "title",
            "description",
            "contributor",
            "contributor_username",
            "status",
            "created_at",
            # Additional fields
            "Activity",
            "Alternative_name_s",
            "Anglicized_name",
            "Base_plinth_depth",
            "Base_plinth_height",
            "Base_plinth_width",
            "Cakula_depth",
            "Cakula_height",
            "Cakula_width",
            "Capital_depth",
            "Capital_height",
            "Capital_width",
            "Circumference",
            "City_quarter_tola",
            "Column_depth",
            "Column_height",
            "Column_width",
            "Commentary",
            "Date_BCE_CE",
            "Date_VS_NS",
            "Depth",
            "Description_for_past_interventions",
            "Description_in_Nepali",
            "Details",
            "District",
            "Edge_at_platform",
            "Editorial_team",
            "End_date",
            "Event_name",
            "Forms_of_columns",
            "Gate",
            "Height",
            "Heritage_focus_area",
            "Identified_threats",
            "Image_declaration",
            "Inscription_identification_number",
            "Lintel_depth",
            "Lintel_height",
            "Main_deity_in_the_sanctum",
            "Maps_and_drawing_type",
            "Monument_assessment",
            "Monument_depth",
            "Monument_diameter",
            "Monument_height_approximate",
            "Monument_length",
            "Monument_name",
            "Monument_shape",
            "Monument_type",
            "Municipality_village_council",
            "Name",
            "Name_in_Devanagari",
            "Nepali_month",
            "Number_of_bays_front",
            "Number_of_bays_sides",
            "Number_of_doors",
            "Number_of_plinth",
            "Number_of_roofs",
            "Number_of_storeys",
            "Number_of_struts",
            "Number_of_wood_carved_windows",
            "Object_ID_number",
            "Object_location",
            "Object_material",
            "Object_type",
            "Paksa",
            "Peculiarities",
            "Period",
            "Platform_floor",
            "Profile_at_base",
            "Province_number",
            "Reference_source",
            "Religion",
            "Roofing",
            "Short_description",
            "Sources",
            "Thickness_of_main_wall",
            "Tithi",
            "Top_plinth_depth",
            "Top_plinth_height",
            "Top_plinth_width",
            "Type_of_bricks",
            "Type_of_roof",
            "Width",
            "Year_SS_NS_VS",
        ]
        read_only_fields = [
            "submission_id",
            "contributor",
            "contributor_username",
            "status",
            "created_at",
        ]

    def get_contributor_username(self, obj):
        return getattr(obj.contributor, "username", None)


class ModerationSerializer(serializers.ModelSerializer):
    submission = serializers.PrimaryKeyRelatedField(
        queryset=Submission.objects.filter(status="pending")
    )

    class Meta:
        model = Moderation
        fields = ["id", "submission", "moderator", "remarks", "reviewed_at"]


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["organization", "score"]


class CustomUserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "profile"]


class ActivityLogSerializer(serializers.ModelSerializer):
    permission_classes = [AllowAny]
    user = serializers.StringRelatedField()

    class Meta:
        model = ActivityLog
        fields = ["user", "action", "description", "timestamp"]


class UserSignupSerializer(serializers.ModelSerializer):
    # Additional fields for the user profile
    organization = serializers.CharField(write_only=True, required=False)
    position = serializers.CharField(write_only=True, required=False)
    birth_date = serializers.DateField(write_only=True, required=False)
    university_school = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "organization",
            "position",
            "birth_date",
            "university_school",
        ]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        # Extract the additional profile-related fields
        organization = validated_data.pop("organization", None)
        position = validated_data.pop("position", None)
        birth_date = validated_data.pop("birth_date", None)
        university_school = validated_data.pop("university_school", None)

        # Extract the first name and last name for the user model
        # first_name = validated_data.pop("first_name", None)
        # last_name = validated_data.pop("last_name", None)

        # Create the user with first_name and last_name
        user = User.objects.create_user(**validated_data)
        profile = UserProfile.objects.create(
            user=user,
            organization=organization,
            position=position,
            birth_date=birth_date,
            university_school=university_school,
        )
        user.save()
        profile.save()

        # Check if the UserProfile already exists, if not, create one
        if not UserProfile.objects.filter(user=user).exists():
            UserProfile.objects.create(
                user=user,
                organization=organization,
                position=position,
                birth_date=birth_date,
                university_school=university_school,
            )

        return user, profile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "email",
            "first_name",
            "last_name",
            "organization",
            "score",
            "birth_date",
            "position",
            "university_school",
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["username", "profile"]


class RegisterSerializer(ModelSerializer):
    """
    Serializer for registering a new user.

    Validates that the email is unique.
    """

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise ValidationError("Email already exists.")
        return value


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)  # show username
    submission = serializers.PrimaryKeyRelatedField(read_only=True)
    entity_id = serializers.UUIDField(source="submission_id", read_only=True)
    entity_name = serializers.CharField(
        source="submission.name", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = Comments
        fields = [
            "comment_id",
            "id",
            "submission",
            "entity_id",
            "entity_name",
            "user",
            "comment",
            "created_at",
        ]


class SubmissionEditSuggestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionEditSuggestion
        fields = "__all__"


class SubmissionVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionVersion
        fields = [
            "version_number",
            "title",
            "description",
            "contribution_data",
            "updated_by",
            "updated_at",
        ]


# class SubmissionEditSuggestionSerializer(serializers.ModelSerializer):
#     suggested_by = (
#         serializers.StringRelatedField()
#     )  # Will show username instead of user ID
#     reviewed_by = serializers.StringRelatedField(required=False)

#     class Meta:
#         model = SubmissionEditSuggestion
#         fields = [
#             "id",
#             "title",
#             "description",
#             "contribution_data",
#             "suggested_by",
#             "created_at",
#             "approved",
#             "reviewed_by",
#             "reviewed_at",
#         ]


class SubmissionIdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ["submission_id"]


class UserStatsSerializer(serializers.Serializer):
    total_submissions = serializers.IntegerField()
    submissions_growth = serializers.FloatField()
    approval_rate = serializers.FloatField()
    approval_rate_change = serializers.FloatField()
    contributor_rank = serializers.IntegerField()
    rank_change = serializers.IntegerField()
    community_impact_score = serializers.FloatField()
    impact_score_change = serializers.FloatField()


class UserProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    member_since = serializers.CharField(read_only=True)  # property from model
    profile_image = serializers.ImageField(required=False, allow_null=True)
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "user_id",
            "slug",
            "username",
            "email",
            "first_name",
            "middle_name",
            "last_name",
            "biography",
            "area_of_expertise",
            "country",
            "organization",
            "position",
            "university_school",
            "social_links",
            "website_link",
            "contributor_mode",
            "score",
            "member_since",
            "profile_image",
            "avatar_url",
            "organizations",
        ]

    def get_organizations(self, obj):
        memberships = OrganizationMembership.objects.filter(
            user=obj.user
        ).select_related("organization")
        return [
            {
                "id": str(m.organization.id),
                "name": m.organization.name,
                "short_name": m.organization.short_name,
                "role": m.role,
                "logo": m.organization.logo.url if m.organization.logo else None,
            }
            for m in memberships
        ]


class UserSerializer(serializers.ModelSerializer):
    """
    Lightweight user projection for nested serializers (revisions, queue, etc.).
    ``contributor_score`` is a heuristic 0–100 score for triage / reputation surfacing.
    """

    contributor_score = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "contributor_score",
        ]

    def get_contributor_score(self, obj):
        try:
            accepted = CulturalEntity.objects.filter(
                contributor=obj, status="accepted"
            ).count()
            review_hits = ReviewDecision.objects.filter(
                reviewer=obj,
                verdict__in=("accept", "accept_with_edits"),
            ).count()
            raw = accepted * 5.0 + review_hits * 2.0
            return round(min(100.0, raw), 1)
        except Exception:
            return 0.0


class RevisionSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Revision
        fields = ["revision_id", "revision_number", "data", "created_by", "created_at"]
        read_only_fields = [
            "revision_id",
            "revision_number",
            "created_by",
            "created_at",
        ]


class ActivitySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    entity_name = serializers.CharField(
        source="entity.name", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = Activity
        fields = [
            "activity_id",
            "user",
            "entity_id",
            "entity_name",
            "activity_type",
            "comment",
            "created_at",
        ]
        read_only_fields = [
            "activity_id",
            "user",
            "entity_id",
            "entity_name",
            "created_at",
        ]


class CulturalEntityListSerializer(serializers.ModelSerializer):
    contributor = UserSerializer(read_only=True)
    current_revision = serializers.SerializerMethodField()
    is_fork = serializers.SerializerMethodField()

    class Meta:
        model = CulturalEntity
        fields = [
            "entity_id",
            "name",
            "category",
            "status",
            "contributor",
            "created_at",
            "current_revision",
            "root_entity",
            "parent_entity",
            "fork_depth",
            "is_fork",
        ]

    def get_current_revision(self, obj):
        """
        Prefer the FK; if unset (legacy rows), use the newest revision so list UIs
        can link to CIDOC detail routes using revision.data (_cidoc_model / id).
        """
        rev = obj.current_revision
        if rev is not None:
            return RevisionSerializer(rev).data
        prefetched = getattr(obj, "prefetched_revisions_newest_first", None)
        if prefetched and len(prefetched) > 0:
            return RevisionSerializer(prefetched[0]).data
        latest = (
            Revision.objects.filter(entity=obj).order_by("-revision_number").first()
        )
        return RevisionSerializer(latest).data if latest else None

    def get_is_fork(self, obj):
        return obj.parent_entity_id is not None


class CulturalEntityDetailSerializer(serializers.ModelSerializer):
    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    revisions = RevisionSerializer(many=True, read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    is_fork = serializers.SerializerMethodField()
    parent_entity_name = serializers.CharField(
        source="parent_entity.name", read_only=True, default=None
    )
    root_entity_name = serializers.CharField(
        source="root_entity.name", read_only=True, default=None
    )

    class Meta:
        model = CulturalEntity
        fields = [
            "entity_id",
            "name",
            "description",
            "category",
            "status",
            "contributor",
            "current_revision",
            "created_at",
            "updated_at",
            "revisions",
            "activities",
            "root_entity",
            "parent_entity",
            "fork_depth",
            "is_fork",
            "parent_entity_name",
            "root_entity_name",
        ]
        read_only_fields = ["entity_id", "created_at", "updated_at", "contributor"]

    def get_is_fork(self, obj):
        return obj.parent_entity_id is not None


class CulturalEntityCreateSerializer(serializers.ModelSerializer):
    form_data = serializers.JSONField(write_only=True)

    class Meta:
        model = CulturalEntity
        fields = ["name", "description", "category", "form_data"]

    def create(self, validated_data):
        form_data = validated_data.pop("form_data")
        request = self.context.get("request")
        # `contributor` may arrive via perform_create's serializer.save(contributor=...)
        # or be derived from the request; accept either without duplicating the kwarg.
        contributor = validated_data.pop("contributor", None) or (
            request.user if request else None
        )

        # Create cultural entity
        entity = CulturalEntity.objects.create(
            **validated_data, contributor=contributor, status="draft"
        )

        # Create first revision
        entity.create_revision(contributor, form_data)

        # Submit for review
        entity.submit_for_review()

        return entity


class CulturalEntityUpdateSerializer(serializers.ModelSerializer):
    form_data = serializers.JSONField(write_only=True)

    class Meta:
        model = CulturalEntity
        fields = ["name", "description", "category", "form_data"]
        read_only_fields = ["entity_id", "contributor", "created_at"]


class RevisionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Revision
        fields = ["data"]

    def create(self, validated_data):
        entity = self.context["entity"]
        request = self.context["request"]
        return entity.create_revision(request.user, validated_data["data"])


class ModerationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["accept", "reject"])
    comment = serializers.CharField(required=False, allow_blank=True)


def triage_display_for_entity(
    context: dict, entity: CulturalEntity
) -> tuple[float, dict, str, str | None]:
    """Shared triage fields for queue rows and review workspace (spec 006)."""
    from apps.heritage_data.services.triage_scoring import (
        compute_triage_components,
        compute_triage_priority,
    )
    from apps.heritage_data.services.triage_sources import worst_source_type_for_entity

    m = context.get("triage_worst_sources")
    if m is not None:
        worst = m.get(str(entity.entity_id))
    else:
        worst = worst_source_type_for_entity(entity)
    p, breakdown = compute_triage_priority(entity, worst_source_type=worst)
    comps = compute_triage_components(entity, worst_source_type=worst)
    return p, breakdown, comps.worst_tier_label, worst


class ContributionQueueSerializer(serializers.ModelSerializer):
    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    latest_revision = serializers.SerializerMethodField()
    activity_count = serializers.SerializerMethodField()
    flag_count = serializers.SerializerMethodField()
    has_conflicts = serializers.SerializerMethodField()
    days_in_review = serializers.SerializerMethodField()
    is_fork = serializers.SerializerMethodField()
    fork_info = serializers.SerializerMethodField()
    triage_priority = serializers.SerializerMethodField()
    triage_breakdown = serializers.SerializerMethodField()
    worst_source_tier = serializers.SerializerMethodField()
    worst_source_type = serializers.SerializerMethodField()

    class Meta:
        model = CulturalEntity
        fields = [
            "entity_id",
            "name",
            "description",
            "category",
            "status",
            "contributor",
            "created_at",
            "current_revision",
            "latest_revision",
            "activity_count",
            "flag_count",
            "has_conflicts",
            "days_in_review",
            "is_fork",
            "fork_info",
            "root_entity",
            "parent_entity",
            "fork_depth",
            "triage_priority",
            "triage_breakdown",
            "worst_source_tier",
            "worst_source_type",
        ]

    def get_latest_revision(self, obj):
        latest = obj.get_latest_revision()
        if latest:
            return RevisionSerializer(latest).data
        return None

    def get_activity_count(self, obj):
        return obj.activities.count()

    def get_flag_count(self, obj):
        if hasattr(obj, "review_flags"):
            return obj.review_flags.filter(is_resolved=False).count()
        return 0

    def get_has_conflicts(self, obj):
        """Check if this entity has unresolved conflict flags."""
        if hasattr(obj, "review_flags"):
            return obj.review_flags.filter(
                flag_type="contradiction", is_resolved=False
            ).exists()
        return False

    def get_days_in_review(self, obj):
        """Days since entity entered pending_review status."""
        if obj.status == "pending_review":
            from django.utils import timezone

            delta = timezone.now() - obj.created_at
            return delta.days
        return 0

    def get_is_fork(self, obj):
        return obj.parent_entity_id is not None

    def get_fork_info(self, obj):
        if not obj.parent_entity_id:
            return None
        fork = (
            Fork.objects.filter(forked_entity=obj)
            .select_related("original_entity", "forked_by")
            .first()
        )
        if not fork:
            return None
        return {
            "fork_id": str(fork.id),
            "original_entity_id": str(fork.original_entity.entity_id),
            "original_entity_name": fork.original_entity.name,
            "fork_reason_tag": fork.fork_reason_tag,
            "fork_reason_tag_display": fork.get_fork_reason_tag_display(),
            "fork_status": fork.fork_status,
            "diff_field_count": len(fork.diff_summary) if fork.diff_summary else 0,
            "reason": fork.reason,
            "forked_by": fork.forked_by.username,
        }

    def _worst_source_type(self, obj):
        _, _, _, worst = triage_display_for_entity(self.context, obj)
        return worst

    def get_triage_priority(self, obj):
        p, _, _, _ = triage_display_for_entity(self.context, obj)
        return p

    def get_triage_breakdown(self, obj):
        _, breakdown, _, _ = triage_display_for_entity(self.context, obj)
        return breakdown

    def get_worst_source_tier(self, obj):
        _, _, tier, _ = triage_display_for_entity(self.context, obj)
        return tier

    def get_worst_source_type(self, obj):
        return self._worst_source_type(obj)


# =====================================================================
# REVIEWER / CURATION SERIALIZERS
# =====================================================================


class ReviewerRoleSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    assigned_by = UserSerializer(read_only=True)
    can_override_confidence = serializers.BooleanField(read_only=True)
    can_resolve_conflicts = serializers.BooleanField(read_only=True)
    can_manage_roles = serializers.BooleanField(read_only=True)

    class Meta:
        model = ReviewerRole
        fields = [
            "id",
            "user",
            "role",
            "expertise_areas",
            "is_active",
            "assigned_by",
            "created_at",
            "updated_at",
            "can_override_confidence",
            "can_resolve_conflicts",
            "can_manage_roles",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ReviewerRoleAssignSerializer(serializers.Serializer):
    """Used by Expert Curators to assign reviewer roles."""

    user_id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=ReviewerRole.ROLE_CHOICES)
    expertise_areas = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class ReviewerApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewerApplication
        fields = [
            "id",
            "message",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ReviewerApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewerApplication
        fields = ["message"]

    def validate(self, attrs):
        user = self.context["request"].user
        if user.is_staff:
            raise ValidationError("Staff accounts do not submit reviewer applications.")
        if user.groups.filter(name="Reviewers").exists():
            raise ValidationError("You are already a reviewer.")
        if ReviewerRole.objects.filter(user=user, is_active=True).exists():
            raise ValidationError("You already have an active reviewer role.")
        if ReviewerApplication.objects.filter(user=user, status="pending").exists():
            raise ValidationError("You already have a pending application.")
        return attrs

    def create(self, validated_data):
        return ReviewerApplication.objects.create(
            user=self.context["request"].user, **validated_data
        )


class PlatformAdminUserSerializer(serializers.ModelSerializer):
    """User directory rows for the in-app platform admin UI (staff or expert curators)."""

    groups = serializers.SerializerMethodField()
    reviewer_role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "groups",
            "reviewer_role",
        ]
        read_only_fields = fields

    def get_groups(self, obj):
        return list(obj.groups.values_list("name", flat=True))

    def get_reviewer_role(self, obj):
        try:
            rr = obj.reviewer_role
        except ReviewerRole.DoesNotExist:
            return None
        return {
            "id": str(rr.id),
            "role": rr.role,
            "is_active": rr.is_active,
        }


class ReviewDecisionSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    revision_reviewed = RevisionSerializer(read_only=True)

    class Meta:
        model = ReviewDecision
        fields = [
            "id",
            "entity",
            "reviewer",
            "revision_reviewed",
            "verdict",
            "conflict_handling",
            "confidence_override",
            "verification_method",
            "feedback",
            "reconciliation_note",
            "internal_note",
            "escalated_to",
            "created_at",
        ]
        read_only_fields = ["id", "reviewer", "created_at"]


class ReviewDecisionProfileSerializer(serializers.ModelSerializer):
    """Public profile: verdict, entity, date — no internal curation text."""

    entity_id = serializers.UUIDField(read_only=True)
    entity_name = serializers.CharField(
        source="entity.name", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = ReviewDecision
        fields = ["id", "entity_id", "entity_name", "verdict", "created_at"]
        read_only_fields = [
            "id",
            "entity_id",
            "entity_name",
            "verdict",
            "created_at",
        ]


class ReviewDecisionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for submitting a review decision.
    The three-panel review workspace submits through this.
    """

    class Meta:
        model = ReviewDecision
        fields = [
            "verdict",
            "conflict_handling",
            "confidence_override",
            "verification_method",
            "feedback",
            "reconciliation_note",
            "internal_note",
            "escalated_to",
        ]

    def validate(self, data):
        verdict = data.get("verdict")
        request = self.context.get("request")

        # Community reviewers cannot override confidence
        if data.get("confidence_override") and hasattr(request.user, "reviewer_role"):
            role = request.user.reviewer_role
            if not role.can_override_confidence and not request.user.is_staff:
                raise serializers.ValidationError(
                    "Community reviewers cannot override confidence scores."
                )

        # Reject requires feedback
        if verdict == "reject" and not data.get("feedback"):
            raise serializers.ValidationError(
                "Feedback is required when rejecting a submission."
            )

        # Conflict handling required if there are conflicts
        entity = self.context.get("entity")
        if entity and hasattr(entity, "review_flags"):
            has_conflicts = entity.review_flags.filter(
                flag_type="contradiction", is_resolved=False
            ).exists()
            if (
                has_conflicts
                and data.get("conflict_handling", "not_applicable") == "not_applicable"
            ):
                raise serializers.ValidationError(
                    "Conflict handling is required when conflicts exist."
                )

        return data


class ReviewFlagSerializer(serializers.ModelSerializer):
    flagged_by = UserSerializer(read_only=True)
    resolved_by = UserSerializer(read_only=True)

    class Meta:
        model = ReviewFlag
        fields = [
            "id",
            "entity",
            "flag_type",
            "flagged_by",
            "reason",
            "is_resolved",
            "resolved_by",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "flagged_by",
            "resolved_by",
            "resolved_at",
            "created_at",
        ]


class ReviewFlagCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewFlag
        fields = ["entity", "flag_type", "reason"]


class ReviewWorkspaceSerializer(serializers.ModelSerializer):
    """
    The full three-panel review workspace context:
    - Entity state + provenance history (left panel)
    - Current submission detail (middle panel)
    - Review decisions history (right panel context)
    - Fork context (when entity is a fork)
    """

    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    revisions = RevisionSerializer(many=True, read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    review_decisions = ReviewDecisionSerializer(many=True, read_only=True)
    flags = serializers.SerializerMethodField()
    contributor_stats = serializers.SerializerMethodField()
    is_fork = serializers.SerializerMethodField()
    fork_context = serializers.SerializerMethodField()
    triage_priority = serializers.SerializerMethodField()
    triage_breakdown = serializers.SerializerMethodField()
    worst_source_tier = serializers.SerializerMethodField()
    worst_source_type = serializers.SerializerMethodField()

    class Meta:
        model = CulturalEntity
        fields = [
            "entity_id",
            "name",
            "description",
            "category",
            "status",
            "contributor",
            "current_revision",
            "created_at",
            "updated_at",
            "revisions",
            "activities",
            "review_decisions",
            "flags",
            "contributor_stats",
            "is_fork",
            "fork_context",
            "root_entity",
            "parent_entity",
            "fork_depth",
            "triage_priority",
            "triage_breakdown",
            "worst_source_tier",
            "worst_source_type",
        ]

    def get_flags(self, obj):
        flags = obj.review_flags.filter(is_resolved=False)
        return ReviewFlagSerializer(flags, many=True).data

    def get_contributor_stats(self, obj):
        """Contributor track record for reviewer context."""
        user = obj.contributor
        total = CulturalEntity.objects.filter(contributor=user).count()
        accepted = CulturalEntity.objects.filter(
            contributor=user, status="accepted"
        ).count()
        return {
            "total_contributions": total,
            "accepted_contributions": accepted,
            "acceptance_rate": round(accepted / total * 100, 1) if total > 0 else 0,
        }

    def get_is_fork(self, obj):
        return obj.parent_entity_id is not None

    def get_fork_context(self, obj):
        if not obj.parent_entity_id:
            return None
        fork = (
            Fork.objects.filter(forked_entity=obj)
            .select_related("original_entity", "forked_by", "forked_from_revision")
            .first()
        )
        if not fork:
            return None
        parent = fork.original_entity
        parent_rev = parent.revisions.order_by("-revision_number").first()

        parent_comments = (
            Comments.objects.filter(
                submission_id=str(parent.entity_id),
                parent__isnull=True,
            )
            .select_related("user")
            .prefetch_related("replies")
            .order_by("-created_at")[:10]
        )
        parent_comments_data = CommentSerializer(parent_comments, many=True).data

        return {
            "fork_id": str(fork.id),
            "parent_entity_id": str(parent.entity_id),
            "parent_entity_name": parent.name,
            "parent_entity_status": parent.status,
            "fork_reason_tag": fork.fork_reason_tag,
            "fork_reason_tag_display": fork.get_fork_reason_tag_display(),
            "fork_status": fork.fork_status,
            "fork_status_display": fork.get_fork_status_display(),
            "reason": fork.reason,
            "diff_summary": fork.diff_summary,
            "diff_field_count": len(fork.diff_summary) if fork.diff_summary else 0,
            "forked_by": fork.forked_by.username,
            "forked_from_revision_number": (
                fork.forked_from_revision.revision_number
                if fork.forked_from_revision
                else None
            ),
            "parent_current_revision": (
                RevisionSerializer(parent_rev).data if parent_rev else None
            ),
            "parent_comments": parent_comments_data,
            "created_at": fork.created_at.isoformat(),
        }

    def get_triage_priority(self, obj):
        p, _, _, _ = triage_display_for_entity(self.context, obj)
        return p

    def get_triage_breakdown(self, obj):
        _, breakdown, _, _ = triage_display_for_entity(self.context, obj)
        return breakdown

    def get_worst_source_tier(self, obj):
        _, _, tier, _ = triage_display_for_entity(self.context, obj)
        return tier

    def get_worst_source_type(self, obj):
        _, _, _, worst = triage_display_for_entity(self.context, obj)
        return worst


class ReviewerDashboardSerializer(serializers.Serializer):
    """Stats for the reviewer's dashboard homepage."""

    queue_count = serializers.IntegerField()
    conflicts_count = serializers.IntegerField()
    flagged_count = serializers.IntegerField()
    expiring_count = serializers.IntegerField()
    resolved_this_week = serializers.IntegerField()
    accepted_this_week = serializers.IntegerField()
    rejected_this_week = serializers.IntegerField()
    total_reviewed = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    conflicts_resolved = serializers.IntegerField()
    reviewer_role = ReviewerRoleSerializer(required=False, allow_null=True)
    recent_domain_activity = serializers.ListField(child=serializers.DictField())


# =====================================================================
# ORGANIZATION SERIALIZERS
# =====================================================================


class OrganizationMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationMembership
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "joined_at",
            "profile_image",
        ]

    def get_profile_image(self, obj):
        if hasattr(obj.user, "profile") and obj.user.profile.profile_image:
            return obj.user.profile.profile_image.url
        return None


class OrganizationListSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    owner_username = serializers.CharField(
        source="owner.username", read_only=True, default=None
    )

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "short_name",
            "description",
            "logo",
            "website",
            "country",
            "focus_areas",
            "is_verified",
            "member_count",
            "owner_username",
            "created_at",
        ]


class OrganizationDetailSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True)
    owner_username = serializers.CharField(
        source="owner.username", read_only=True, default=None
    )

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "short_name",
            "description",
            "logo",
            "website",
            "country",
            "focus_areas",
            "is_verified",
            "member_count",
            "owner_username",
            "created_at",
            "updated_at",
            "members",
        ]

    def get_members(self, obj):
        memberships = obj.members.select_related("user").order_by("-role", "joined_at")
        return OrganizationMemberSerializer(memberships, many=True).data


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "name",
            "short_name",
            "description",
            "logo",
            "website",
            "country",
            "focus_areas",
        ]


class ActivityDetailSerializer(serializers.ModelSerializer):
    """Extended activity serializer with entity context for timeline view."""

    user = UserSerializer(read_only=True)
    entity_name = serializers.CharField(source="entity.name", read_only=True)
    entity_category = serializers.CharField(source="entity.category", read_only=True)
    entity_status = serializers.CharField(source="entity.status", read_only=True)

    class Meta:
        model = Activity
        fields = [
            "activity_id",
            "user",
            "activity_type",
            "comment",
            "created_at",
            "entity_name",
            "entity_category",
            "entity_status",
        ]
        read_only_fields = ["activity_id", "user", "created_at"]


# =====================================================================
# NOTIFICATION SERIALIZERS
# =====================================================================


class NotificationSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(
        source="entity.name", read_only=True, default=None
    )
    entity_id = serializers.UUIDField(
        source="entity.entity_id", read_only=True, default=None
    )
    entity_category = serializers.CharField(
        source="entity.category", read_only=True, default=None
    )
    actor_username = serializers.CharField(
        source="actor.username", read_only=True, default=None
    )
    actor_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "notification_id",
            "user",
            "notification_type",
            "message",
            "is_read",
            "link",
            "entity_name",
            "entity_id",
            "entity_category",
            "actor_username",
            "actor_display_name",
            "submission",
            "created_at",
        ]
        read_only_fields = ["notification_id", "user", "created_at"]

    def get_actor_display_name(self, obj):
        if obj.actor:
            full = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
            return full or obj.actor.username
        return None


class NotificationMarkReadSerializer(serializers.Serializer):
    notification_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of notification_ids to mark as read. If empty, marks all as read.",
    )


# =====================================================================
# REACTION SERIALIZERS
# =====================================================================


class ReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "user", "entity", "comment", "reaction_type", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class ReactionCreateSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField(required=False)
    comment_id = serializers.CharField(required=False)
    reaction_type = serializers.ChoiceField(choices=Reaction.REACTION_CHOICES)

    def validate(self, data):
        if not data.get("entity_id") and not data.get("comment_id"):
            raise serializers.ValidationError(
                "Either entity_id or comment_id is required."
            )
        if data.get("entity_id") and data.get("comment_id"):
            raise serializers.ValidationError(
                "Provide either entity_id or comment_id, not both."
            )
        return data


class ReactionSummarySerializer(serializers.Serializer):
    """Aggregated reaction counts for an entity or comment."""

    upvotes = serializers.IntegerField()
    downvotes = serializers.IntegerField()
    user_reaction = serializers.CharField(allow_null=True)


# =====================================================================
# FORK SERIALIZERS
# =====================================================================


class ForkSerializer(serializers.ModelSerializer):
    forked_by = UserSerializer(read_only=True)
    original_entity_name = serializers.CharField(
        source="original_entity.name", read_only=True
    )
    forked_entity_name = serializers.CharField(
        source="forked_entity.name", read_only=True
    )
    forked_entity_id = serializers.UUIDField(
        source="forked_entity.entity_id", read_only=True
    )
    forked_entity_status = serializers.CharField(
        source="forked_entity.status", read_only=True
    )
    fork_reason_tag_display = serializers.CharField(
        source="get_fork_reason_tag_display", read_only=True
    )
    fork_status_display = serializers.CharField(
        source="get_fork_status_display", read_only=True
    )
    merged_by_username = serializers.CharField(
        source="merged_by.username", read_only=True, default=None
    )
    diff_field_count = serializers.SerializerMethodField()

    class Meta:
        model = Fork
        fields = [
            "id",
            "original_entity",
            "forked_entity",
            "forked_entity_id",
            "forked_entity_name",
            "forked_entity_status",
            "original_entity_name",
            "forked_by",
            "forked_from_revision",
            "reason",
            "fork_reason_tag",
            "fork_reason_tag_display",
            "fork_status",
            "fork_status_display",
            "diff_summary",
            "diff_field_count",
            "merged_at",
            "merged_by",
            "merged_by_username",
            "created_at",
        ]
        read_only_fields = ["id", "forked_by", "created_at"]

    def get_diff_field_count(self, obj):
        if obj.diff_summary and isinstance(obj.diff_summary, dict):
            return len(obj.diff_summary)
        return 0


class ForkCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    fork_reason_tag = serializers.ChoiceField(
        choices=Fork.FORK_REASON_CHOICES,
        default="other",
    )
    changes = serializers.JSONField(
        required=False,
        help_text="Optional changes to apply to the forked entity's revision data",
    )


class ForkLineageNodeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for lineage tree nodes."""

    contributor_username = serializers.CharField(
        source="contributor.username", read_only=True
    )
    is_fork = serializers.SerializerMethodField()
    fork_info = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = CulturalEntity
        fields = [
            "entity_id",
            "name",
            "status",
            "category",
            "contributor_username",
            "fork_depth",
            "is_fork",
            "fork_info",
            "children",
            "created_at",
        ]

    def get_is_fork(self, obj):
        return obj.parent_entity_id is not None

    def get_fork_info(self, obj):
        fork = (
            Fork.objects.filter(forked_entity=obj).select_related("forked_by").first()
        )
        if not fork:
            return None
        return {
            "fork_id": str(fork.id),
            "reason": fork.reason,
            "fork_reason_tag": fork.fork_reason_tag,
            "fork_status": fork.fork_status,
            "diff_field_count": len(fork.diff_summary) if fork.diff_summary else 0,
            "diff_fields": list(fork.diff_summary.keys()) if fork.diff_summary else [],
            "forked_by": fork.forked_by.username,
            "created_at": fork.created_at.isoformat(),
        }

    def get_children(self, obj):
        children = (
            CulturalEntity.objects.filter(parent_entity=obj)
            .select_related("contributor")
            .order_by("-created_at")
        )
        return ForkLineageNodeSerializer(children, many=True).data


# =====================================================================
# SHARE SERIALIZER
# =====================================================================


class ShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = Share
        fields = ["id", "entity", "platform", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class ShareCreateSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    platform = serializers.ChoiceField(choices=Share.PLATFORM_CHOICES)


# =====================================================================
# REVISION DIFF SERIALIZER
# =====================================================================


class RevisionDiffSerializer(serializers.Serializer):
    """Shows the diff between two revisions of the same entity."""

    revision_from = RevisionSerializer()
    revision_to = RevisionSerializer()
    diff = serializers.DictField(
        help_text="Field-by-field diff: { field_key: { old: ..., new: ... } }"
    )


# =====================================================================
# ENHANCED COMMENT SERIALIZER (with reactions + replies)
# =====================================================================


class CommentWithReactionsSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    submission = serializers.PrimaryKeyRelatedField(read_only=True)
    replies = serializers.SerializerMethodField()
    reaction_summary = serializers.SerializerMethodField()

    class Meta:
        model = Comments
        fields = [
            "comment_id",
            "id",
            "submission",
            "user",
            "comment",
            "parent",
            "created_at",
            "updated_at",
            "replies",
            "reaction_summary",
        ]
        read_only_fields = ["comment_id", "user", "created_at", "updated_at"]

    def get_replies(self, obj):
        replies = obj.replies.select_related("user").order_by("created_at")
        return CommentWithReactionsSerializer(
            replies, many=True, context=self.context
        ).data

    def get_reaction_summary(self, obj):
        upvotes = obj.reactions.filter(reaction_type="upvote").count()
        downvotes = obj.reactions.filter(reaction_type="downvote").count()
        request = self.context.get("request")
        user_reaction = None
        if request and request.user.is_authenticated:
            reaction = obj.reactions.filter(user=request.user).first()
            if reaction:
                user_reaction = reaction.reaction_type
        return {
            "upvotes": upvotes,
            "downvotes": downvotes,
            "user_reaction": user_reaction,
        }


# =====================================================================
# PUBLIC CONTRIBUTION SERIALIZERS (QR Scan Contributions)
# =====================================================================


class PublicContributionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating public contributions via QR code scan.
    Does not require authentication.
    """

    entity_id = serializers.CharField(
        required=False, allow_blank=True, help_text="UUID of linked entity (if exists)"
    )

    class Meta:
        model = PublicContribution
        fields = [
            "entity_id",
            "entity_name",
            "contribution_type",
            "content",
            "contributor_name",
            "contributor_email",
            "contributor_phone",
            "source_description",
            "submitted_via",
            "latitude",
            "longitude",
        ]

    def validate_entity_id(self, value):
        """Try to link to an existing entity if provided."""
        if value:
            try:
                # Store for use in create()
                return value
            except Exception:
                pass
        return value

    def create(self, validated_data):
        entity_id = validated_data.pop("entity_id", None)

        # Try to link to existing entity
        if entity_id:
            try:
                entity = CulturalEntity.objects.get(entity_id=entity_id)
                validated_data["entity"] = entity
            except CulturalEntity.DoesNotExist:
                # Store the reference ID for manual linking later
                validated_data["entity_reference_id"] = entity_id

        return super().create(validated_data)


class PublicContributionListSerializer(serializers.ModelSerializer):
    """Serializer for listing/viewing public contributions (for reviewers)."""

    entity_name_display = serializers.SerializerMethodField()
    contribution_type_display = serializers.CharField(
        source="get_contribution_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username", read_only=True, allow_null=True
    )

    class Meta:
        model = PublicContribution
        fields = [
            "id",
            "entity",
            "entity_reference_id",
            "entity_name",
            "entity_name_display",
            "contribution_type",
            "contribution_type_display",
            "content",
            "contributor_name",
            "contributor_email",
            "source_description",
            "submitted_via",
            "latitude",
            "longitude",
            "status",
            "status_display",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "review_notes",
            "created_at",
            "updated_at",
        ]

    def get_entity_name_display(self, obj):
        if obj.entity:
            return obj.entity.name
        return obj.entity_name


class PublicContributionReviewSerializer(serializers.Serializer):
    """Serializer for reviewing (approving/rejecting) a public contribution."""

    status = serializers.ChoiceField(
        choices=[
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("incorporated", "Incorporated"),
        ]
    )
    review_notes = serializers.CharField(required=False, allow_blank=True)
    link_to_entity_id = serializers.UUIDField(
        required=False,
        help_text="Optionally link to an existing entity when incorporating",
    )


# =====================================================================
# SCHEMA EXTENSION PROPOSALS (006)
# =====================================================================


class SchemaExtensionAuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username", read_only=True, allow_null=True
    )

    class Meta:
        model = SchemaExtensionAuditEvent
        fields = [
            "id",
            "action",
            "from_status",
            "to_status",
            "comment",
            "actor_username",
            "schema_version_snapshot",
            "created_at",
        ]
        read_only_fields = fields


class SchemaExtensionProposalSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    change_summary = serializers.SerializerMethodField()

    class Meta:
        model = SchemaExtensionProposal
        fields = [
            "id",
            "title",
            "description",
            "author",
            "author_username",
            "status",
            "base_schema_version",
            "proposed_yaml",
            "conflict_keys",
            "moderator_comment",
            "published_schema_version",
            "published_extension_hash",
            "submitted_at",
            "resolved_at",
            "change_summary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "author",
            "author_username",
            "status",
            "base_schema_version",
            "conflict_keys",
            "moderator_comment",
            "published_schema_version",
            "published_extension_hash",
            "submitted_at",
            "resolved_at",
            "change_summary",
            "created_at",
            "updated_at",
        ]

    def get_change_summary(self, obj):
        from apps.heritage_data.services.schema_extension_summary import (
            summarize_proposal_yaml,
        )

        return summarize_proposal_yaml(obj.proposed_yaml or "")


class SchemaExtensionProposalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemaExtensionProposal
        fields = ["title", "description", "proposed_yaml"]

    def create(self, validated_data):
        request = self.context["request"]
        return SchemaExtensionProposal.objects.create(
            author=request.user,
            status=SchemaExtensionProposal.STATUS_DRAFT,
            **validated_data,
        )


class SchemaExtensionProposalPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemaExtensionProposal
        fields = ["title", "description", "proposed_yaml"]

    def validate(self, attrs):
        inst = self.instance
        if inst and inst.status != SchemaExtensionProposal.STATUS_DRAFT:
            raise ValidationError("Only draft proposals can be edited.")
        return attrs


# =====================================================================
# ENTITY / RELATIONSHIP PROPOSALS (007)
# =====================================================================


class EntityProposalAuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username", read_only=True, allow_null=True
    )

    class Meta:
        model = EntityProposalAuditEvent
        fields = [
            "id",
            "action",
            "from_status",
            "to_status",
            "comment",
            "actor_username",
            "created_at",
        ]
        read_only_fields = fields


class RelationshipProposalAuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username", read_only=True, allow_null=True
    )

    class Meta:
        model = RelationshipProposalAuditEvent
        fields = [
            "id",
            "action",
            "from_status",
            "to_status",
            "comment",
            "actor_username",
            "created_at",
        ]
        read_only_fields = fields


class EntityProposalSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = EntityProposal
        fields = [
            "id",
            "author",
            "author_username",
            "status",
            "canonical_label",
            "aliases",
            "type_scope",
            "anchor_records",
            "supporting_source_ids",
            "contributor_note",
            "external_identifiers",
            "resolution_mode",
            "existing_cluster",
            "moderator_comment",
            "materialized_cluster",
            "submitted_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "author",
            "author_username",
            "status",
            "moderator_comment",
            "materialized_cluster",
            "submitted_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]


class EntityProposalCreateSerializer(serializers.ModelSerializer):
    existing_cluster = serializers.PrimaryKeyRelatedField(
        queryset=EntityCluster.objects.filter(merged_into__isnull=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = EntityProposal
        fields = [
            "canonical_label",
            "aliases",
            "type_scope",
            "anchor_records",
            "supporting_source_ids",
            "contributor_note",
            "external_identifiers",
            "resolution_mode",
            "existing_cluster",
        ]

    def validate(self, attrs):
        mode = attrs.get("resolution_mode", EntityProposal.RESOLUTION_NEW)
        existing = attrs.get("existing_cluster")
        if mode == EntityProposal.RESOLUTION_LINK and existing is None:
            raise ValidationError(
                {"existing_cluster": "Required when resolution_mode is link_existing."}
            )
        return attrs


class EntityProposalPatchSerializer(serializers.ModelSerializer):
    existing_cluster = serializers.PrimaryKeyRelatedField(
        queryset=EntityCluster.objects.filter(merged_into__isnull=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = EntityProposal
        fields = [
            "canonical_label",
            "aliases",
            "type_scope",
            "anchor_records",
            "supporting_source_ids",
            "contributor_note",
            "external_identifiers",
            "resolution_mode",
            "existing_cluster",
        ]

    def validate(self, attrs):
        if self.instance and self.instance.status != EntityProposal.STATUS_DRAFT:
            raise ValidationError("Only draft proposals can be edited.")
        mode = attrs.get("resolution_mode")
        if mode is None and self.instance:
            mode = self.instance.resolution_mode
        existing = attrs.get("existing_cluster")
        if existing is None and self.instance:
            existing = self.instance.existing_cluster
        if mode == EntityProposal.RESOLUTION_LINK and existing is None:
            raise ValidationError(
                {"existing_cluster": "Required when resolution_mode is link_existing."}
            )
        return attrs


class RelationshipProposalSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    predicate_code = serializers.CharField(source="predicate.code", read_only=True)
    predicate_label = serializers.CharField(source="predicate.label", read_only=True)

    class Meta:
        model = RelationshipProposal
        fields = [
            "id",
            "author",
            "author_username",
            "status",
            "predicate",
            "predicate_code",
            "predicate_label",
            "subject_entity_type",
            "subject_entity_id",
            "object_entity_type",
            "object_entity_id",
            "primary_source",
            "supporting_source_ids",
            "temporal_scope_edtf",
            "confidence",
            "interpretation_note",
            "moderator_comment",
            "materialized_assertion",
            "submitted_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "author",
            "author_username",
            "status",
            "predicate_code",
            "predicate_label",
            "moderator_comment",
            "materialized_assertion",
            "submitted_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]


class RelationshipProposalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelationshipProposal
        fields = [
            "predicate",
            "subject_entity_type",
            "subject_entity_id",
            "object_entity_type",
            "object_entity_id",
            "primary_source",
            "supporting_source_ids",
            "temporal_scope_edtf",
            "confidence",
            "interpretation_note",
        ]


class RelationshipProposalPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelationshipProposal
        fields = [
            "predicate",
            "subject_entity_type",
            "subject_entity_id",
            "object_entity_type",
            "object_entity_id",
            "primary_source",
            "supporting_source_ids",
            "temporal_scope_edtf",
            "confidence",
            "interpretation_note",
        ]

    def validate(self, attrs):
        if self.instance and self.instance.status != RelationshipProposal.STATUS_DRAFT:
            raise ValidationError("Only draft proposals can be edited.")
        return attrs


# =====================================================================
# PROJECT-BASED CONTRIBUTION SERIALIZERS (final_plan.md §3)
# =====================================================================

from .models import (  # noqa: E402
    Media,
    Project,
    ProjectActivity,
    ProjectAsset,
    ProjectEntity,
    ProjectMembership,
)


class ProjectUserBriefSerializer(serializers.ModelSerializer):
    """Compact user representation embedded in project payloads."""

    class Meta:
        model = User
        fields = ["id", "username", "email"]
        read_only_fields = fields


class ProjectMembershipSerializer(serializers.ModelSerializer):
    user = ProjectUserBriefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True,
        required=False,
    )
    username = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ProjectMembership
        fields = [
            "id",
            "project",
            "user",
            "user_id",
            "username",
            "role",
            "invited_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "invited_by", "created_at", "updated_at"]

    def validate(self, attrs):
        username = (attrs.pop("username", None) or "").strip()
        if attrs.get("user") is None and username:
            try:
                attrs["user"] = User.objects.get(username=username)
            except User.DoesNotExist as exc:
                raise ValidationError({"username": "User not found."}) from exc
        if attrs.get("user") is None:
            raise ValidationError("Provide user_id or username.")
        return attrs


class ProjectAssetSerializer(serializers.ModelSerializer):
    uploaded_by = ProjectUserBriefSerializer(read_only=True)
    media_url = serializers.SerializerMethodField()
    media_type = serializers.CharField(source="media.media_type", read_only=True)
    uploaded_document_id = serializers.SerializerMethodField()
    ocr_status = serializers.SerializerMethodField()

    class Meta:
        model = ProjectAsset
        fields = [
            "id",
            "project",
            "media",
            "media_url",
            "media_type",
            "role",
            "caption",
            "version_label",
            "entity_suggestions",
            "uploaded_by",
            "uploaded_document_id",
            "ocr_status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "uploaded_by",
            "media_url",
            "media_type",
            "uploaded_document_id",
            "ocr_status",
            "entity_suggestions",
            "version_label",
            "created_at",
        ]

    def get_media_url(self, obj):
        if obj.media and obj.media.file:
            request = self.context.get("request")
            url = obj.media.file.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_uploaded_document_id(self, obj):
        doc = getattr(obj.media, "ocr_document", None)
        return str(doc.id) if doc else None

    def get_ocr_status(self, obj):
        from .project_services import get_asset_ocr_status

        return get_asset_ocr_status(obj.media)


class ProjectAssetUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    role = serializers.ChoiceField(
        choices=ProjectAsset.ROLE_CHOICES,
        default=ProjectAsset.ROLE_EVIDENCE,
    )
    caption = serializers.CharField(required=False, allow_blank=True, default="")
    version_label = serializers.CharField(required=False, allow_blank=True, default="", max_length=120)
    media_type = serializers.ChoiceField(
        choices=Media.MEDIA_TYPE_CHOICES,
        required=False,
    )
    run_ocr = serializers.BooleanField(default=False)
    source_institution = serializers.CharField(required=False, allow_blank=True, default="")
    collection_name = serializers.CharField(required=False, allow_blank=True, default="")
    language = serializers.CharField(required=False, allow_blank=True, default="")
    ocr_language = serializers.CharField(required=False, allow_blank=True, default="")
    copyright_note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_file(self, value):
        from .project_services import validate_project_asset_file

        validate_project_asset_file(value)
        return value


class ProjectEntitySerializer(serializers.ModelSerializer):
    added_by = ProjectUserBriefSerializer(read_only=True)
    entity_name = serializers.CharField(source="entity.name", read_only=True)
    entity_category = serializers.CharField(source="entity.category", read_only=True)
    entity_status = serializers.CharField(source="entity.status", read_only=True)

    class Meta:
        model = ProjectEntity
        fields = [
            "id",
            "project",
            "entity",
            "entity_name",
            "entity_category",
            "entity_status",
            "role_in_project",
            "added_by",
            "added_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "entity_name",
            "entity_category",
            "entity_status",
            "added_by",
            "added_at",
        ]


class ProjectActivitySerializer(serializers.ModelSerializer):
    actor = ProjectUserBriefSerializer(read_only=True)

    class Meta:
        model = ProjectActivity
        fields = [
            "id",
            "project",
            "actor",
            "action",
            "target_kind",
            "target_id",
            "payload",
            "created_at",
        ]
        read_only_fields = fields


class ProjectListSerializer(serializers.ModelSerializer):
    owner = ProjectUserBriefSerializer(read_only=True)
    asset_count = serializers.IntegerField(read_only=True)
    entity_count = serializers.IntegerField(read_only=True)
    collaborator_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "slug",
            "title",
            "abstract",
            "intended_subject",
            "languages",
            "owner",
            "visibility",
            "state",
            "forked_from",
            "tags",
            "asset_count",
            "entity_count",
            "collaborator_count",
            "submitted_at",
            "merged_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ProjectDetailSerializer(serializers.ModelSerializer):
    owner = ProjectUserBriefSerializer(read_only=True)
    memberships = ProjectMembershipSerializer(many=True, read_only=True)
    assets = ProjectAssetSerializer(many=True, read_only=True)
    entities = ProjectEntitySerializer(many=True, read_only=True)
    allowed_transitions = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "slug",
            "title",
            "abstract",
            "intended_subject",
            "languages",
            "owner",
            "visibility",
            "state",
            "forked_from",
            "schema_version",
            "canvas_state",
            "tags",
            "memberships",
            "assets",
            "entities",
            "allowed_transitions",
            "can_edit",
            "submitted_at",
            "merged_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "state",
            "schema_version",
            "memberships",
            "assets",
            "entities",
            "allowed_transitions",
            "can_edit",
            "submitted_at",
            "merged_at",
            "created_at",
            "updated_at",
        ]

    def get_allowed_transitions(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        from .project_services import get_allowed_project_transitions

        return get_allowed_project_transitions(user, obj)

    def get_can_edit(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        from .project_services import user_can_edit_project

        return user_can_edit_project(user, obj)


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Write serializer for POST /projects/. Owner and state are set server-side."""

    class Meta:
        model = Project
        fields = [
            "slug",
            "title",
            "abstract",
            "intended_subject",
            "languages",
            "visibility",
            "forked_from",
            "tags",
        ]

    def validate_slug(self, value):
        if Project.objects.filter(slug=value).exists():
            raise ValidationError("A project with this slug already exists.")
        return value


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for PATCH /projects/<id>/. State is changed via dedicated action."""

    class Meta:
        model = Project
        fields = [
            "title",
            "abstract",
            "intended_subject",
            "languages",
            "visibility",
            "tags",
            "canvas_state",
        ]


class ProjectStateTransitionSerializer(serializers.Serializer):
    """Payload for the /projects/<id>/transition/ action."""

    target_state = serializers.ChoiceField(choices=Project.STATE_CHOICES)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class ProjectCommentSerializer(serializers.ModelSerializer):
    """Comments scoped to a project (final_plan.md §10.1)."""

    user = ProjectUserBriefSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        from .models import Comments
        model = Comments
        fields = [
            "comment_id",
            "project",
            "user",
            "comment",
            "parent",
            "replies",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["comment_id", "project", "user", "replies", "created_at", "updated_at"]

    def get_replies(self, obj):
        qs = obj.replies.order_by("created_at")
        return ProjectCommentSerializer(qs, many=True, context=self.context).data
