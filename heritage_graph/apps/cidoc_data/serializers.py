from rest_framework import serializers
from django.contrib.auth.models import User
from .models import *

# --- User Serializer ---
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

# --- Main models serializers ---
class HistoricalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricalPeriod
        fields = '__all__'

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'

class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = '__all__'

class ArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Artifact
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'

class TraditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tradition
        fields = '__all__'

class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = '__all__'

# --- Revision serializers ---
class HistoricalPeriodRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricalPeriodRevision
        fields = '__all__'

class LocationRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationRevision
        fields = '__all__'

class PersonRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonRevision
        fields = '__all__'

class ArtifactRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArtifactRevision
        fields = '__all__'

class EventRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRevision
        fields = '__all__'

class TraditionRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TraditionRevision
        fields = '__all__'

class SourceRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceRevision
        fields = '__all__'

# --- Comment serializers ---
class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = '__all__'

# Generic comment serializer generator
def create_comment_serializer(model_name):
    class CommentSerializer(serializers.ModelSerializer):
        class Meta:
            model = model_name
            fields = '__all__'
    return CommentSerializer

HistoricalPeriodCommentSerializer = create_comment_serializer(HistoricalPeriodComment)
LocationCommentSerializer = create_comment_serializer(LocationComment)
PersonCommentSerializer = create_comment_serializer(PersonComment)
ArtifactCommentSerializer = create_comment_serializer(ArtifactComment)
EventCommentSerializer = create_comment_serializer(EventComment)
TraditionCommentSerializer = create_comment_serializer(TraditionComment)
SourceCommentSerializer = create_comment_serializer(SourceComment)

HistoricalPeriodRevisionCommentSerializer = create_comment_serializer(HistoricalPeriodRevisionComment)
LocationRevisionCommentSerializer = create_comment_serializer(LocationRevisionComment)
PersonRevisionCommentSerializer = create_comment_serializer(PersonRevisionComment)
ArtifactRevisionCommentSerializer = create_comment_serializer(ArtifactRevisionComment)
EventRevisionCommentSerializer = create_comment_serializer(EventRevisionComment)
TraditionRevisionCommentSerializer = create_comment_serializer(TraditionRevisionComment)
SourceRevisionCommentSerializer = create_comment_serializer(SourceRevisionComment)

class NotificationForUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationForUser
        fields = '__all__'
