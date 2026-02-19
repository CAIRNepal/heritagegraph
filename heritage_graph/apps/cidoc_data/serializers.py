from rest_framework import serializers
from django.contrib.auth.models import User
from .models import *

##########################################
#           CIDOC_DATA CLASSES
##########################################


class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = '__all__'

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'


class HistoricalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricalPeriod
        fields = '__all__'


class TraditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tradition
        fields = '__all__'

class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = '__all__'


# =====================================================================
# NEW ONTOLOGY-DRIVEN SERIALIZERS
# =====================================================================

class DeitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Deity
        fields = '__all__'

class GuthiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guthi
        fields = '__all__'

class ArchitecturalStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArchitecturalStructure
        fields = '__all__'

class RitualEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = RitualEvent
        fields = '__all__'

class FestivalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Festival
        fields = '__all__'

class IconographicObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = IconographicObject
        fields = '__all__'

class MonumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Monument
        fields = '__all__'

class PersonRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonRevision
        fields = '__all__'


# =====================================================================
# PROVENANCE SERIALIZERS
# =====================================================================

class DataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSource
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class HeritageAssertionSerializer(serializers.ModelSerializer):
    content_type_name = serializers.SerializerMethodField()

    class Meta:
        model = HeritageAssertion
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_content_type_name(self, obj):
        return obj.content_type.model if obj.content_type else None


class InlineAssertionSerializer(serializers.Serializer):
    """
    Lightweight serializer for assertion data submitted inline
    with an entity creation form. Used in the contribution wizard.
    """
    source_type = serializers.ChoiceField(
        choices=[
            ('archival', 'Archival Record'),
            ('field_survey', 'Field Survey'),
            ('oral_history', 'Oral History'),
            ('published', 'Published Source'),
            ('inscription', 'Inscription'),
            ('web', 'Web Resource'),
        ],
        required=False,
    )
    source_citation = serializers.CharField(required=False, allow_blank=True)
    source_url = serializers.URLField(required=False, allow_blank=True)
    confidence = serializers.ChoiceField(
        choices=[
            ('certain', 'Certain'),
            ('likely', 'Likely'),
            ('uncertain', 'Uncertain'),
            ('speculative', 'Speculative'),
        ],
        default='likely',
    )
    data_quality_note = serializers.CharField(required=False, allow_blank=True)


class AssertionAwareStructureSerializer(serializers.ModelSerializer):
    """
    Structure serializer that accepts inline assertion data on create
    and returns linked assertions on read.
    """
    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = ArchitecturalStructure
        fields = '__all__'

    def create(self, validated_data):
        assertion_data = validated_data.pop('assertion', None)
        structure = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(structure)

            # Create a DataSource if citation is provided
            source = None
            if assertion_data.get('source_citation') or assertion_data.get('source_url'):
                source = DataSource.objects.create(
                    name=assertion_data.get('source_citation', 'Untitled source')[:300],
                    source_type=assertion_data.get('source_type', 'published'),
                    citation=assertion_data.get('source_citation', ''),
                    url=assertion_data.get('source_url', ''),
                )

            # Get contributor from request context
            request = self.context.get('request')
            contributed_by = ''
            if request and hasattr(request, 'user') and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=structure.id,
                assertion_content=f"Created record for {structure.name}",
                source=source,
                source_citation=assertion_data.get('source_citation', ''),
                contributed_by=contributed_by,
                confidence=assertion_data.get('confidence', 'likely'),
                data_quality_note=assertion_data.get('data_quality_note', ''),
            )

        return structure


class AssertionAwareRitualSerializer(serializers.ModelSerializer):
    """Ritual serializer with inline assertion support."""
    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = RitualEvent
        fields = '__all__'

    def create(self, validated_data):
        assertion_data = validated_data.pop('assertion', None)
        ritual = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(ritual)

            source = None
            if assertion_data.get('source_citation') or assertion_data.get('source_url'):
                source = DataSource.objects.create(
                    name=assertion_data.get('source_citation', 'Untitled source')[:300],
                    source_type=assertion_data.get('source_type', 'published'),
                    citation=assertion_data.get('source_citation', ''),
                    url=assertion_data.get('source_url', ''),
                )

            request = self.context.get('request')
            contributed_by = ''
            if request and hasattr(request, 'user') and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=ritual.id,
                assertion_content=f"Created record for {ritual.name}",
                source=source,
                source_citation=assertion_data.get('source_citation', ''),
                contributed_by=contributed_by,
                confidence=assertion_data.get('confidence', 'likely'),
                data_quality_note=assertion_data.get('data_quality_note', ''),
            )

        return ritual


class AssertionAwareDeitySerializer(serializers.ModelSerializer):
    """Deity serializer with inline assertion support."""
    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = Deity
        fields = '__all__'

    def create(self, validated_data):
        assertion_data = validated_data.pop('assertion', None)
        deity = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(deity)

            source = None
            if assertion_data.get('source_citation') or assertion_data.get('source_url'):
                source = DataSource.objects.create(
                    name=assertion_data.get('source_citation', 'Untitled source')[:300],
                    source_type=assertion_data.get('source_type', 'published'),
                    citation=assertion_data.get('source_citation', ''),
                    url=assertion_data.get('source_url', ''),
                )

            request = self.context.get('request')
            contributed_by = ''
            if request and hasattr(request, 'user') and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=deity.id,
                assertion_content=f"Created record for {deity.name}",
                source=source,
                source_citation=assertion_data.get('source_citation', ''),
                contributed_by=contributed_by,
                confidence=assertion_data.get('confidence', 'likely'),
                data_quality_note=assertion_data.get('data_quality_note', ''),
            )

        return deity


class AssertionAwareGuthiSerializer(serializers.ModelSerializer):
    """Guthi serializer with inline assertion support."""
    assertion = InlineAssertionSerializer(write_only=True, required=False)
    assertions = HeritageAssertionSerializer(many=True, read_only=True)

    class Meta:
        model = Guthi
        fields = '__all__'

    def create(self, validated_data):
        assertion_data = validated_data.pop('assertion', None)
        guthi = super().create(validated_data)

        if assertion_data:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(guthi)

            source = None
            if assertion_data.get('source_citation') or assertion_data.get('source_url'):
                source = DataSource.objects.create(
                    name=assertion_data.get('source_citation', 'Untitled source')[:300],
                    source_type=assertion_data.get('source_type', 'published'),
                    citation=assertion_data.get('source_citation', ''),
                    url=assertion_data.get('source_url', ''),
                )

            request = self.context.get('request')
            contributed_by = ''
            if request and hasattr(request, 'user') and request.user.is_authenticated:
                contributed_by = request.user.email or request.user.username

            HeritageAssertion.objects.create(
                content_type=ct,
                object_id=guthi.id,
                assertion_content=f"Created record for {guthi.name}",
                source=source,
                source_citation=assertion_data.get('source_citation', ''),
                contributed_by=contributed_by,
                confidence=assertion_data.get('confidence', 'likely'),
                data_quality_note=assertion_data.get('data_quality_note', ''),
            )

        return guthi


#########################################








# # --- User Serializer ---
# class UserSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = User
#         fields = ['id', 'username', 'email']


# class ArtifactSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Artifact
#         fields = '__all__'


# # --- Revision serializers ---
# class HistoricalPeriodRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = HistoricalPeriodRevision
#         fields = '__all__'

# class LocationRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = LocationRevision
#         fields = '__all__'

# class ArtifactRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = ArtifactRevision
#         fields = '__all__'

# class EventRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = EventRevision
#         fields = '__all__'

# class TraditionRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = TraditionRevision
#         fields = '__all__'

# class SourceRevisionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = SourceRevision
#         fields = '__all__'

# # --- Comment serializers ---
# class ActivitySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Activity
#         fields = '__all__'

# # Generic comment serializer generator
# def create_comment_serializer(model_name):
#     class CommentSerializer(serializers.ModelSerializer):
#         class Meta:
#             model = model_name
#             fields = '__all__'
#     return CommentSerializer

# HistoricalPeriodCommentSerializer = create_comment_serializer(HistoricalPeriodComment)
# LocationCommentSerializer = create_comment_serializer(LocationComment)
# PersonCommentSerializer = create_comment_serializer(PersonComment)
# ArtifactCommentSerializer = create_comment_serializer(ArtifactComment)
# EventCommentSerializer = create_comment_serializer(EventComment)
# TraditionCommentSerializer = create_comment_serializer(TraditionComment)
# SourceCommentSerializer = create_comment_serializer(SourceComment)

# HistoricalPeriodRevisionCommentSerializer = create_comment_serializer(HistoricalPeriodRevisionComment)
# LocationRevisionCommentSerializer = create_comment_serializer(LocationRevisionComment)
# PersonRevisionCommentSerializer = create_comment_serializer(PersonRevisionComment)
# ArtifactRevisionCommentSerializer = create_comment_serializer(ArtifactRevisionComment)
# EventRevisionCommentSerializer = create_comment_serializer(EventRevisionComment)
# TraditionRevisionCommentSerializer = create_comment_serializer(TraditionRevisionComment)
# SourceRevisionCommentSerializer = create_comment_serializer(SourceRevisionComment)

# class NotificationForUserSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = NotificationForUser
#         fields = '__all__'
