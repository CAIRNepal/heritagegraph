from django.contrib.auth.models import User
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
)
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CulturalEntity, Revision, Activity, ReviewDecision, ReviewFlag, ReviewerRole


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

    class Meta:
        model = Comments
        fields = ["comment_id", "id", "submission", "user", "comment", "created_at"]


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
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    member_since = serializers.CharField(read_only=True)  # property from model
    profile_image = serializers.ImageField(required=False, allow_null=True)
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
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
            "score",
            "member_since",
            "profile_image",
            "organizations",
        ]

    def get_organizations(self, obj):
        memberships = OrganizationMembership.objects.filter(
            user=obj.user
        ).select_related('organization')
        return [
            {
                'id': str(m.organization.id),
                'name': m.organization.name,
                'short_name': m.organization.short_name,
                'role': m.role,
                'logo': m.organization.logo.url if m.organization.logo else None,
            }
            for m in memberships
        ]

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class RevisionSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = Revision
        fields = ['revision_id', 'revision_number', 'data', 'created_by', 'created_at']
        read_only_fields = ['revision_id', 'revision_number', 'created_by', 'created_at']

class ActivitySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Activity
        fields = ['activity_id', 'user', 'activity_type', 'comment', 'created_at']
        read_only_fields = ['activity_id', 'user', 'created_at']

class CulturalEntityListSerializer(serializers.ModelSerializer):
    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    
    class Meta:
        model = CulturalEntity
        fields = [
            'entity_id', 'name', 'category', 'status', 
            'contributor', 'created_at', 'current_revision'
        ]

class CulturalEntityDetailSerializer(serializers.ModelSerializer):
    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    revisions = RevisionSerializer(many=True, read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    
    class Meta:
        model = CulturalEntity
        fields = [
            'entity_id', 'name', 'description', 'category', 'status',
            'contributor', 'current_revision', 'created_at', 'updated_at',
            'revisions', 'activities'
        ]
        read_only_fields = ['entity_id', 'created_at', 'updated_at', 'contributor']

class CulturalEntityCreateSerializer(serializers.ModelSerializer):
    form_data = serializers.JSONField(write_only=True)
    
    class Meta:
        model = CulturalEntity
        fields = ['name', 'description', 'category', 'form_data']
    
    def create(self, validated_data):
        form_data = validated_data.pop('form_data')
        request = self.context.get('request')
        
        # Create cultural entity
        entity = CulturalEntity.objects.create(
            **validated_data,
            contributor=request.user,
            status='draft'
        )
        
        # Create first revision
        entity.create_revision(request.user, form_data)
        
        # Submit for review
        entity.submit_for_review()
        
        return entity

class CulturalEntityUpdateSerializer(serializers.ModelSerializer):
    form_data = serializers.JSONField(write_only=True)
    
    class Meta:
        model = CulturalEntity
        fields = ['name', 'description', 'category', 'form_data']
        read_only_fields = ['entity_id', 'contributor', 'created_at']

class RevisionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Revision
        fields = ['data']
    
    def create(self, validated_data):
        entity = self.context['entity']
        request = self.context['request']
        return entity.create_revision(request.user, validated_data['data'])

class ModerationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['accept', 'reject'])
    comment = serializers.CharField(required=False, allow_blank=True)

class ContributionQueueSerializer(serializers.ModelSerializer):
    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    latest_revision = serializers.SerializerMethodField()
    activity_count = serializers.SerializerMethodField()
    flag_count = serializers.SerializerMethodField()
    has_conflicts = serializers.SerializerMethodField()
    days_in_review = serializers.SerializerMethodField()
    
    class Meta:
        model = CulturalEntity
        fields = [
            'entity_id', 'name', 'description', 'category', 'status', 'contributor',
            'created_at', 'current_revision', 'latest_revision', 'activity_count',
            'flag_count', 'has_conflicts', 'days_in_review'
        ]
    
    def get_latest_revision(self, obj):
        latest = obj.get_latest_revision()
        if latest:
            return RevisionSerializer(latest).data
        return None
    
    def get_activity_count(self, obj):
        return obj.activities.count()

    def get_flag_count(self, obj):
        if hasattr(obj, 'review_flags'):
            return obj.review_flags.filter(is_resolved=False).count()
        return 0

    def get_has_conflicts(self, obj):
        """Check if this entity has unresolved conflict flags."""
        if hasattr(obj, 'review_flags'):
            return obj.review_flags.filter(
                flag_type='contradiction', is_resolved=False
            ).exists()
        return False

    def get_days_in_review(self, obj):
        """Days since entity entered pending_review status."""
        if obj.status == 'pending_review':
            from django.utils import timezone
            delta = timezone.now() - obj.created_at
            return delta.days
        return 0


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
            'id', 'user', 'role', 'expertise_areas', 'is_active',
            'assigned_by', 'created_at', 'updated_at',
            'can_override_confidence', 'can_resolve_conflicts', 'can_manage_roles'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReviewerRoleAssignSerializer(serializers.Serializer):
    """Used by Expert Curators to assign reviewer roles."""
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=ReviewerRole.ROLE_CHOICES)
    expertise_areas = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class ReviewDecisionSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    revision_reviewed = RevisionSerializer(read_only=True)

    class Meta:
        model = ReviewDecision
        fields = [
            'id', 'entity', 'reviewer', 'revision_reviewed',
            'verdict', 'conflict_handling', 'confidence_override',
            'verification_method', 'feedback', 'reconciliation_note',
            'internal_note', 'escalated_to', 'created_at'
        ]
        read_only_fields = ['id', 'reviewer', 'created_at']


class ReviewDecisionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for submitting a review decision.
    The three-panel review workspace submits through this.
    """
    class Meta:
        model = ReviewDecision
        fields = [
            'verdict', 'conflict_handling', 'confidence_override',
            'verification_method', 'feedback', 'reconciliation_note',
            'internal_note', 'escalated_to'
        ]

    def validate(self, data):
        verdict = data.get('verdict')
        request = self.context.get('request')

        # Community reviewers cannot override confidence
        if data.get('confidence_override') and hasattr(request.user, 'reviewer_role'):
            role = request.user.reviewer_role
            if not role.can_override_confidence and not request.user.is_staff:
                raise serializers.ValidationError(
                    "Community reviewers cannot override confidence scores."
                )

        # Reject requires feedback
        if verdict == 'reject' and not data.get('feedback'):
            raise serializers.ValidationError(
                "Feedback is required when rejecting a submission."
            )

        # Conflict handling required if there are conflicts
        entity = self.context.get('entity')
        if entity and hasattr(entity, 'review_flags'):
            has_conflicts = entity.review_flags.filter(
                flag_type='contradiction', is_resolved=False
            ).exists()
            if has_conflicts and data.get('conflict_handling', 'not_applicable') == 'not_applicable':
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
            'id', 'entity', 'flag_type', 'flagged_by', 'reason',
            'is_resolved', 'resolved_by', 'resolved_at', 'created_at'
        ]
        read_only_fields = ['id', 'flagged_by', 'resolved_by', 'resolved_at', 'created_at']


class ReviewFlagCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewFlag
        fields = ['entity', 'flag_type', 'reason']


class ReviewWorkspaceSerializer(serializers.ModelSerializer):
    """
    The full three-panel review workspace context:
    - Entity state + provenance history (left panel)
    - Current submission detail (middle panel)
    - Review decisions history (right panel context)
    """
    contributor = UserSerializer(read_only=True)
    current_revision = RevisionSerializer(read_only=True)
    revisions = RevisionSerializer(many=True, read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    review_decisions = ReviewDecisionSerializer(many=True, read_only=True)
    flags = serializers.SerializerMethodField()
    contributor_stats = serializers.SerializerMethodField()

    class Meta:
        model = CulturalEntity
        fields = [
            'entity_id', 'name', 'description', 'category', 'status',
            'contributor', 'current_revision', 'created_at', 'updated_at',
            'revisions', 'activities', 'review_decisions', 'flags',
            'contributor_stats'
        ]

    def get_flags(self, obj):
        flags = obj.review_flags.filter(is_resolved=False)
        return ReviewFlagSerializer(flags, many=True).data

    def get_contributor_stats(self, obj):
        """Contributor track record for reviewer context."""
        user = obj.contributor
        total = CulturalEntity.objects.filter(contributor=user).count()
        accepted = CulturalEntity.objects.filter(
            contributor=user, status='accepted'
        ).count()
        return {
            'total_contributions': total,
            'accepted_contributions': accepted,
            'acceptance_rate': round(accepted / total * 100, 1) if total > 0 else 0,
        }


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
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationMembership
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'role', 'joined_at', 'profile_image']

    def get_profile_image(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.profile_image:
            return obj.user.profile.profile_image.url
        return None


class OrganizationListSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True, default=None)

    class Meta:
        model = Organization
        fields = ['id', 'name', 'short_name', 'description', 'logo',
                  'website', 'country', 'focus_areas', 'is_verified',
                  'member_count', 'owner_username', 'created_at']


class OrganizationDetailSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True, default=None)

    class Meta:
        model = Organization
        fields = ['id', 'name', 'short_name', 'description', 'logo',
                  'website', 'country', 'focus_areas', 'is_verified',
                  'member_count', 'owner_username', 'created_at', 'updated_at',
                  'members']

    def get_members(self, obj):
        memberships = obj.members.select_related('user').order_by('-role', 'joined_at')
        return OrganizationMemberSerializer(memberships, many=True).data


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['name', 'short_name', 'description', 'logo',
                  'website', 'country', 'focus_areas']


class ActivityDetailSerializer(serializers.ModelSerializer):
    """Extended activity serializer with entity context for timeline view."""
    user = UserSerializer(read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    entity_category = serializers.CharField(source='entity.category', read_only=True)
    entity_status = serializers.CharField(source='entity.status', read_only=True)

    class Meta:
        model = Activity
        fields = ['activity_id', 'user', 'activity_type', 'comment',
                  'created_at', 'entity_name', 'entity_category', 'entity_status']
        read_only_fields = ['activity_id', 'user', 'created_at']
