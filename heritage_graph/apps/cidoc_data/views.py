from rest_framework import viewsets
from django.contrib.auth.models import User
from .models import *
from .serializers import *

#################################################################
## CIDOC_DATA
#################################################################
class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

class HistoricalPeriodViewSet(viewsets.ModelViewSet):
    queryset = HistoricalPeriod.objects.all()
    serializer_class = HistoricalPeriodSerializer

class TraditionViewSet(viewsets.ModelViewSet):
    queryset = Tradition.objects.all()
    serializer_class = TraditionSerializer

class SourceViewSet(viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer


# =====================================================================
# NEW ONTOLOGY-DRIVEN VIEWSETS
# =====================================================================

class DeityViewSet(viewsets.ModelViewSet):
    queryset = Deity.objects.all()
    serializer_class = DeitySerializer

class GuthiViewSet(viewsets.ModelViewSet):
    queryset = Guthi.objects.all()
    serializer_class = GuthiSerializer

class ArchitecturalStructureViewSet(viewsets.ModelViewSet):
    queryset = ArchitecturalStructure.objects.all()
    serializer_class = ArchitecturalStructureSerializer

class RitualEventViewSet(viewsets.ModelViewSet):
    queryset = RitualEvent.objects.all()
    serializer_class = RitualEventSerializer

class FestivalViewSet(viewsets.ModelViewSet):
    queryset = Festival.objects.all()
    serializer_class = FestivalSerializer

class IconographicObjectViewSet(viewsets.ModelViewSet):
    queryset = IconographicObject.objects.all()
    serializer_class = IconographicObjectSerializer

class MonumentViewSet(viewsets.ModelViewSet):
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


class AssertionAwareStructureViewSet(viewsets.ModelViewSet):
    """Structure ViewSet that uses assertion-aware serializer for writes."""
    queryset = ArchitecturalStructure.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AssertionAwareStructureSerializer
        # For list/retrieve, also return the assertion-aware serializer
        # so assertions are included in the response
        return AssertionAwareStructureSerializer


class AssertionAwareRitualViewSet(viewsets.ModelViewSet):
    """Ritual ViewSet with assertion support."""
    queryset = RitualEvent.objects.all()

    def get_serializer_class(self):
        return AssertionAwareRitualSerializer


class AssertionAwareDeityViewSet(viewsets.ModelViewSet):
    """Deity ViewSet with assertion support."""
    queryset = Deity.objects.all()

    def get_serializer_class(self):
        return AssertionAwareDeitySerializer


class AssertionAwareGuthiViewSet(viewsets.ModelViewSet):
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
