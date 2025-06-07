from rest_framework import serializers, generics
from django.contrib.auth.models import User
from .models import Submission, Moderation
from .models import UserProfile
from .models import ActivityLog
from rest_framework.serializers import ModelSerializer, ValidationError
from rest_framework.permissions import AllowAny  

from rest_framework import serializers
from .models import Submission

class SubmissionSerializer(serializers.ModelSerializer):
    contributor_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Submission
        fields = [
            'id',
            'title',
            'description',
            'contributor',
            'contributor_username',
            'status',
            'created_at',
        ]
        read_only_fields = [
            'contributor',
            'contributor_username',
            'status',
            'created_at',
        ]

    def get_contributor_username(self, obj):
        return getattr(obj.contributor, 'username', None)

    
class ModerationSerializer(serializers.ModelSerializer):
    submission = serializers.PrimaryKeyRelatedField(queryset=Submission.objects.filter(status='pending'))
    class Meta:
        model = Moderation
        fields = ['id', 'submission', 'moderator', 'comment', 'reviewed_at']

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['organization', 'score']  

class CustomUserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()  

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']

    

class ActivityLogSerializer(serializers.ModelSerializer):
    permission_classes = [AllowAny]  
    user = serializers.StringRelatedField()  

    class Meta:
        model = ActivityLog
        fields = ['user', 'action', 'description', 'timestamp']



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
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'organization', 'position', 'birth_date', 'university_school']
        extra_kwargs = {
            'password': {'write_only': True}, 
        }

    def create(self, validated_data):
        # Extract the additional profile-related fields
        organization = validated_data.pop('organization', None)
        position = validated_data.pop('position', None)
        birth_date = validated_data.pop('birth_date', None)
        university_school = validated_data.pop('university_school', None)

        # Extract the first name and last name for the user model
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)

        # Create the user with first_name and last_name
        user = User.objects.create_user(**validated_data)
        profile = UserProfile.objects.create(user=user, organization=organization, position=position, birth_date=birth_date, university_school=university_school)
        user.save()
        profile.save()

        # Check if the UserProfile already exists, if not, create one
        if not UserProfile.objects.filter(user=user).exists():
            UserProfile.objects.create(user=user, organization=organization, position=position, birth_date=birth_date, university_school=university_school)

        return user, profile
    
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['email', 'first_name', 'last_name', 'organization', 'score', 'birth_date', 'position', 'university_school']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True) 
    class Meta:
        model = User
        fields = ['username','profile']


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