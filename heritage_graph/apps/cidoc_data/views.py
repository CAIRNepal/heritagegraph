from rest_framework import viewsets, permissions, status as drf_status
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import *
from .serializers import *


# =====================================================================
# CONTRIBUTION MIXIN — hooks CIDOC creates into the review workflow
# =====================================================================

def _get_category_for_model(model_class):
    """Map a CIDOC model class to a CulturalEntity category."""
    mapping = {
        'Person': 'other',
        'Location': 'other',
        'Event': 'other',
        'HistoricalPeriod': 'other',
        'Tradition': 'tradition',
        'Source': 'document',
        'Deity': 'other',
        'Guthi': 'tradition',
        'ArchitecturalStructure': 'monument',
        'RitualEvent': 'ritual',
        'Festival': 'festival',
        'IconographicObject': 'artifact',
        'Monument': 'monument',
    }
    return mapping.get(model_class.__name__, 'other')


class ContributionFlowMixin:
    """
    Mixin for CIDOC ViewSets that hooks every create into the
    CulturalEntity → Notification → Review queue workflow.

    On POST (create):
      1. Requires authentication
      2. Sets contributor = username, status = pending_review
      3. Creates a CulturalEntity wrapper in heritage_data
      4. Creates a first Revision with the submitted data as JSON
      5. Fires notifications to the contributor and all active reviewers
    """

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        # Set contributor info on the CIDOC record
        instance = serializer.save(
            contributor=self.request.user.username,
            status='pending_review',
        )

        # Create a CulturalEntity wrapper for the review queue
        try:
            from apps.heritage_data.models import (
                CulturalEntity, Revision, Activity, Notification, ReviewerRole,
            )

            entity_name = getattr(instance, 'name', None) or getattr(instance, 'title', '') or str(instance)
            entity_description = getattr(instance, 'description', '') or ''
            category = _get_category_for_model(instance.__class__)

            entity = CulturalEntity.objects.create(
                name=entity_name,
                description=entity_description,
                category=category,
                status='pending_review',
                contributor=self.request.user,
            )

            # Build revision data from the serialized instance
            revision_data = serializer.data.copy()
            revision_data['_cidoc_model'] = instance.__class__.__name__
            revision_data['_cidoc_id'] = instance.pk

            Revision.objects.create(
                entity=entity,
                data=revision_data,
                revision_number=1,
                created_by=self.request.user,
            )

            Activity.objects.create(
                entity=entity,
                user=self.request.user,
                activity_type='submitted',
                comment=f'Submitted via {instance.__class__.__name__} form',
            )

            # Notify contributor
            Notification.objects.create(
                user=self.request.user,
                notification_type='submission_update',
                message=f'Your contribution "{entity_name}" has been submitted and is pending review.',
                entity=entity,
                link=f'/dashboard/knowledge/entity/{entity.entity_id}',
            )

            # Notify all active reviewers
            reviewer_users = User.objects.filter(
                reviewer_role__is_active=True,
            ).exclude(id=self.request.user.id)
            for reviewer in reviewer_users:
                Notification.objects.create(
                    user=reviewer,
                    notification_type='submission_update',
                    message=f'New contribution "{entity_name}" submitted by {self.request.user.username} — awaiting review.',
                    entity=entity,
                    link=f'/dashboard/curation/review/{entity.entity_id}',
                )

        except Exception as e:
            # Log but don't fail the CIDOC save — the data is still persisted
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f'Failed to create CulturalEntity wrapper: {e}')


#################################################################
## CIDOC_DATA — all ViewSets now use ContributionFlowMixin
#################################################################
class PersonViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer

class LocationViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

class EventViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

class HistoricalPeriodViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = HistoricalPeriod.objects.all()
    serializer_class = HistoricalPeriodSerializer

class TraditionViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Tradition.objects.all()
    serializer_class = TraditionSerializer

class SourceViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer


# =====================================================================
# NEW ONTOLOGY-DRIVEN VIEWSETS
# =====================================================================

class DeityViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Deity.objects.all()
    serializer_class = DeitySerializer

class GuthiViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Guthi.objects.all()
    serializer_class = GuthiSerializer

class ArchitecturalStructureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = ArchitecturalStructure.objects.all()
    serializer_class = ArchitecturalStructureSerializer

class RitualEventViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = RitualEvent.objects.all()
    serializer_class = RitualEventSerializer

class FestivalViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Festival.objects.all()
    serializer_class = FestivalSerializer

class IconographicObjectViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = IconographicObject.objects.all()
    serializer_class = IconographicObjectSerializer

class MonumentViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Monument.objects.all()
    serializer_class = MonumentSerializer


class PersonRevisionViewSet(viewsets.ModelViewSet):
    queryset = PersonRevision.objects.all()
    serializer_class = PersonRevisionSerializer


# =====================================================================
# PROVENANCE VIEWSETS
# =====================================================================

class DataSourceViewSet(viewsets.ModelViewSet):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer


class HeritageAssertionViewSet(viewsets.ModelViewSet):
    queryset = HeritageAssertion.objects.all()
    serializer_class = HeritageAssertionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by entity type and ID
        entity_type = self.request.query_params.get('entity_type')
        entity_id = self.request.query_params.get('entity_id')
        status = self.request.query_params.get('status')

        if entity_type:
            from django.contrib.contenttypes.models import ContentType
            try:
                ct = ContentType.objects.get(model=entity_type)
                qs = qs.filter(content_type=ct)
            except ContentType.DoesNotExist:
                pass

        if entity_id:
            qs = qs.filter(object_id=entity_id)

        if status:
            qs = qs.filter(reconciliation_status=status)

        return qs


class AssertionAwareStructureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Structure ViewSet that uses assertion-aware serializer for writes."""
    queryset = ArchitecturalStructure.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AssertionAwareStructureSerializer
        # For list/retrieve, also return the assertion-aware serializer
        # so assertions are included in the response
        return AssertionAwareStructureSerializer


class AssertionAwareRitualViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Ritual ViewSet with assertion support."""
    queryset = RitualEvent.objects.all()

    def get_serializer_class(self):
        return AssertionAwareRitualSerializer


class AssertionAwareDeityViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Deity ViewSet with assertion support."""
    queryset = Deity.objects.all()

    def get_serializer_class(self):
        return AssertionAwareDeitySerializer


class AssertionAwareGuthiViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    """Guthi ViewSet with assertion support."""
    queryset = Guthi.objects.all()

    def get_serializer_class(self):
        return AssertionAwareGuthiSerializer


#################################################################

from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Q

from apps.cidoc_data.models import (
    Person, Location, Event, Tradition,
    Deity, Guthi, ArchitecturalStructure, RitualEvent, Festival, Monument,
)
from apps.cidoc_data.serializers import (
    PersonSerializer, LocationSerializer, EventSerializer, TraditionSerializer,
    DeitySerializer, GuthiSerializer, ArchitecturalStructureSerializer,
    RitualEventSerializer, FestivalSerializer, MonumentSerializer,
)


@api_view(['GET'])
def universal_search(request):
    q = request.GET.get('q', '').strip()

    if not q:
        return Response({"error": "Query parameter 'q' is required."}, status=400)

    search_map = {
        "persons": {
            "model": Person,
            "fields": ["name", "aliases", "occupation"],
            "serializer": PersonSerializer,
        },
        "locations": {
            "model": Location,
            "fields": ["name", "description"],
            "serializer": LocationSerializer,
        },
        "events": {
            "model": Event,
            "fields": ["name", "description"],
            "serializer": EventSerializer,
        },
        "traditions": {
            "model": Tradition,
            "fields": ["name", "description"],
            "serializer": TraditionSerializer,
        },
        "deities": {
            "model": Deity,
            "fields": ["name", "alternate_names", "religious_tradition"],
            "serializer": DeitySerializer,
        },
        "guthis": {
            "model": Guthi,
            "fields": ["name", "description"],
            "serializer": GuthiSerializer,
        },
        "structures": {
            "model": ArchitecturalStructure,
            "fields": ["name", "description", "location_name"],
            "serializer": ArchitecturalStructureSerializer,
        },
        "rituals": {
            "model": RitualEvent,
            "fields": ["name", "description"],
            "serializer": RitualEventSerializer,
        },
        "festivals": {
            "model": Festival,
            "fields": ["name", "description"],
            "serializer": FestivalSerializer,
        },
        "monuments": {
            "model": Monument,
            "fields": ["name", "description"],
            "serializer": MonumentSerializer,
        },
    }

    results = {}

    for key, cfg in search_map.items():
        model = cfg["model"]
        serializer_class = cfg["serializer"]
        fields = cfg["fields"]

        # Build OR query across all fields
        q_filter = Q()
        for field in fields:
            q_filter |= Q(**{f"{field}__icontains": q})

        queryset = model.objects.filter(q_filter).distinct()
        results[key] = serializer_class(queryset, many=True).data

    return Response(results)





###############################################################






# --- User ViewSet ---
# class UserViewSet(viewsets.ModelViewSet):
#     queryset = User.objects.all()
#     serializer_class = UserSerializer

# --- Main models ViewSets ---


# class ArtifactViewSet(viewsets.ModelViewSet):
#     queryset = Artifact.objects.all()
#     serializer_class = ArtifactSerializer


# # --- Revision ViewSets ---
# class HistoricalPeriodRevisionViewSet(viewsets.ModelViewSet):
#     queryset = HistoricalPeriodRevision.objects.all()
#     serializer_class = HistoricalPeriodRevisionSerializer

# class LocationRevisionViewSet(viewsets.ModelViewSet):
#     queryset = LocationRevision.objects.all()
#     serializer_class = LocationRevisionSerializer


# class ArtifactRevisionViewSet(viewsets.ModelViewSet):
#     queryset = ArtifactRevision.objects.all()
#     serializer_class = ArtifactRevisionSerializer

# class EventRevisionViewSet(viewsets.ModelViewSet):
#     queryset = EventRevision.objects.all()
#     serializer_class = EventRevisionSerializer

# class TraditionRevisionViewSet(viewsets.ModelViewSet):
#     queryset = TraditionRevision.objects.all()
#     serializer_class = TraditionRevisionSerializer

# class SourceRevisionViewSet(viewsets.ModelViewSet):
#     queryset = SourceRevision.objects.all()
#     serializer_class = SourceRevisionSerializer

# # --- Activity and Comment ViewSets ---
# class ActivityViewSet(viewsets.ModelViewSet):
#     queryset = Activity.objects.all()
#     serializer_class = ActivitySerializer

# # Generate generic comment viewsets
# def create_comment_viewset(model, serializer):
#     class CommentViewSet(viewsets.ModelViewSet):
#         queryset = model.objects.all()
#         serializer_class = serializer
#     return CommentViewSet

# HistoricalPeriodCommentViewSet = create_comment_viewset(HistoricalPeriodComment, HistoricalPeriodCommentSerializer)
# LocationCommentViewSet = create_comment_viewset(LocationComment, LocationCommentSerializer)
# PersonCommentViewSet = create_comment_viewset(PersonComment, PersonCommentSerializer)
# ArtifactCommentViewSet = create_comment_viewset(ArtifactComment, ArtifactCommentSerializer)
# EventCommentViewSet = create_comment_viewset(EventComment, EventCommentSerializer)
# TraditionCommentViewSet = create_comment_viewset(TraditionComment, TraditionCommentSerializer)
# SourceCommentViewSet = create_comment_viewset(SourceComment, SourceCommentSerializer)

# HistoricalPeriodRevisionCommentViewSet = create_comment_viewset(HistoricalPeriodRevisionComment, HistoricalPeriodRevisionCommentSerializer)
# LocationRevisionCommentViewSet = create_comment_viewset(LocationRevisionComment, LocationRevisionCommentSerializer)
# PersonRevisionCommentViewSet = create_comment_viewset(PersonRevisionComment, PersonRevisionCommentSerializer)
# ArtifactRevisionCommentViewSet = create_comment_viewset(ArtifactRevisionComment, ArtifactRevisionCommentSerializer)
# EventRevisionCommentViewSet = create_comment_viewset(EventRevisionComment, EventRevisionCommentSerializer)
# TraditionRevisionCommentViewSet = create_comment_viewset(TraditionRevisionComment, TraditionRevisionCommentSerializer)
# SourceRevisionCommentViewSet = create_comment_viewset(SourceRevisionComment, SourceRevisionCommentSerializer)

# # --- Notification ViewSet ---
# class NotificationForUserViewSet(viewsets.ModelViewSet):
#     queryset = NotificationForUser.objects.all()
#     serializer_class = NotificationForUserSerializer
