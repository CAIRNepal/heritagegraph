from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.serializers import ModelSerializer, ValidationError

from .models import (
    ActivityLog,
    Comments,
    Moderation,
    Submission,
    SubmissionEditSuggestion,
    SubmissionVersion,
    UserProfile,
)
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CulturalEntity, Revision, Activity


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
    
    class Meta:
        model = CulturalEntity
        fields = [
            'entity_id', 'name', 'category', 'status', 'contributor',
            'created_at', 'current_revision', 'latest_revision', 'activity_count'
        ]
    
    def get_latest_revision(self, obj):
        latest = obj.get_latest_revision()
        if latest:
            return RevisionSerializer(latest).data
        return None
    
    def get_activity_count(self, obj):
        return obj.activities.count()

