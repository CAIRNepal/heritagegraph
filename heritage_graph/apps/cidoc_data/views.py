from django.contrib.auth import get_user_model
from rest_framework import permissions, status as drf_status, viewsets
from rest_framework.response import Response

User = get_user_model()
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
        'KumariTenure': 'ritual',
        'KumariSelection': 'ritual',
        'KumariRetirement': 'ritual',
        'SyncreticRelationship': 'other',
        'CasteGroup': 'other',
        'CalendarSystem': 'other',
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

            # Determine where the user should land when clicking this notification.
            # For CIDOC "Source", we route directly to the source details page rather than
            # the generic CulturalEntity wrapper page.
            contributor_link = f'/knowledge/entity/view/{entity.entity_id}'
            if instance.__class__.__name__ == "Source":
                contributor_link = f'/knowledge/source/view/{instance.pk}'

            Notification.objects.create(
                user=self.request.user,
                actor=self.request.user,
                notification_type='submission_update',
                message=f'Your contribution "{entity_name}" has been submitted and is pending review.',
                entity=entity,
                link=contributor_link,
            )

            reviewer_users = User.objects.filter(
                reviewer_role__is_active=True,
            ).exclude(id=self.request.user.id)
            for reviewer in reviewer_users:
                Notification.objects.create(
                    user=reviewer,
                    actor=self.request.user,
                    notification_type='submission_update',
                    message=f'New contribution "{entity_name}" submitted by {self.request.user.username} — awaiting review.',
                    entity=entity,
                    link=f'/curation/review/{entity.entity_id}',
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
    search_fields = ["name", "aliases", "occupation"]

class LocationViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    search_fields = ["name", "description"]

class EventViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    search_fields = ["name", "description"]

class HistoricalPeriodViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = HistoricalPeriod.objects.all()
    serializer_class = HistoricalPeriodSerializer
    search_fields = ["name", "description"]

class TraditionViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Tradition.objects.all()
    serializer_class = TraditionSerializer
    search_fields = ["name", "description"]

class SourceViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer
    search_fields = ["title", "authors"]


# =====================================================================
# NEW ONTOLOGY-DRIVEN VIEWSETS
# =====================================================================

class DeityViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Deity.objects.all()
    serializer_class = DeitySerializer
    search_fields = ["name", "alternate_names", "religious_tradition"]

class GuthiViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Guthi.objects.all()
    serializer_class = GuthiSerializer
    search_fields = ["name", "location"]

class ArchitecturalStructureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = ArchitecturalStructure.objects.all()
    serializer_class = ArchitecturalStructureSerializer
    search_fields = ["name", "location_name"]

class RitualEventViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = RitualEvent.objects.all()
    serializer_class = RitualEventSerializer
    search_fields = ["name", "location_name", "performed_by"]

class FestivalViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Festival.objects.all()
    serializer_class = FestivalSerializer
    search_fields = ["name", "location_name"]

class IconographicObjectViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = IconographicObject.objects.all()
    serializer_class = IconographicObjectSerializer
    search_fields = ["name", "depicts_deity"]

class MonumentViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = Monument.objects.all()
    serializer_class = MonumentSerializer
    search_fields = ["name", "location_name"]

class KumariTenureViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = KumariTenure.objects.all()
    serializer_class = KumariTenureSerializer
    search_fields = ["name", "had_participant"]

class KumariSelectionViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = KumariSelection.objects.all()
    serializer_class = KumariSelectionSerializer
    search_fields = ["name", "selected_person"]

class KumariRetirementViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = KumariRetirement.objects.all()
    serializer_class = KumariRetirementSerializer
    search_fields = ["name"]

class SyncreticRelationshipViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = SyncreticRelationship.objects.all()
    serializer_class = SyncreticRelationshipSerializer
    search_fields = ["name", "assigned_to_deity"]

class CasteGroupViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = CasteGroup.objects.all()
    serializer_class = CasteGroupSerializer
    search_fields = ["name", "traditional_role"]

class CalendarSystemViewSet(ContributionFlowMixin, viewsets.ModelViewSet):
    queryset = CalendarSystem.objects.all()
    serializer_class = CalendarSystemSerializer
    search_fields = ["name"]


class PersonRevisionViewSet(viewsets.ModelViewSet):
    queryset = PersonRevision.objects.all()
    serializer_class = PersonRevisionSerializer


# =====================================================================
# PROVENANCE VIEWSETS
# =====================================================================

class DataSourceViewSet(viewsets.ModelViewSet):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer
    search_fields = ["name", "author", "citation"]


class HeritageAssertionViewSet(viewsets.ModelViewSet):
    queryset = HeritageAssertion.objects.all()
    serializer_class = HeritageAssertionSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        extra = {}
        if self.request.user.is_authenticated:
            extra['contributed_by'] = self.request.user.email or self.request.user.username
        serializer.save(**extra)

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

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
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
    _get_cultural_entity_id,
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


def _discovery_record_name(instance):
    name = getattr(instance, "name", None)
    if name and str(name).strip():
        return str(name).strip()
    title = getattr(instance, "title", None)
    if title and str(title).strip():
        return str(title).strip()
    return str(instance.pk)


def _discovery_summary(instance):
    for attr in ("description", "biography", "note", "route_description"):
        val = getattr(instance, attr, None)
        if val and str(val).strip():
            s = str(val).strip()
            return f"{s[:277]}…" if len(s) > 280 else s
    return ""


def _discovery_location_hint(instance):
    for attr in ("location_name", "location", "start_place"):
        val = getattr(instance, attr, None)
        if val and str(val).strip():
            return str(val).strip()[:200]
    return ""


def _discovery_is_published(instance):
    raw = (getattr(instance, "status", None) or "").strip().lower()
    if not raw:
        return True
    return raw not in ("pending_review", "draft", "rejected")


def _discovery_row(instance, resource_key):
    return {
        "id": str(instance.pk),
        "resource": resource_key,
        "type": instance.__class__.__name__,
        "name": _discovery_record_name(instance),
        "summary": _discovery_summary(instance),
        "location_hint": _discovery_location_hint(instance),
        "cultural_entity_id": _get_cultural_entity_id(instance),
        "status": (getattr(instance, "status", None) or "").strip(),
        "is_published": _discovery_is_published(instance),
        "has_media": False,
    }


# Maps public landing tabs → model + searchable fields (icontains).
_DISCOVERY_TYPE_MAP = {
    "monuments": (Monument, ["name", "description", "note", "location_name"]),
    "festivals": (
        Festival,
        ["name", "description", "note", "location_name", "route_description"],
    ),
    "deities": (
        Deity,
        ["name", "description", "note", "alternate_names", "religious_tradition"],
    ),
    "persons": (
        Person,
        ["name", "description", "aliases", "occupation", "biography"],
    ),
    "guthis": (
        Guthi,
        ["name", "description", "note", "location", "managed_structures"],
    ),
    "rituals": (
        RitualEvent,
        [
            "name",
            "description",
            "note",
            "location_name",
            "performed_by",
            "route_description",
        ],
    ),
}


def _filtered_discovery_queryset(model, fields, q):
    qs = model.objects.all().order_by("-id")
    q = (q or "").strip()
    if not q:
        return qs
    q_filter = Q()
    for field in fields:
        q_filter |= Q(**{f"{field}__icontains": q})
    return qs.filter(q_filter).distinct()


@api_view(["GET"])
@permission_classes([AllowAny])
def public_discovery(request):
    """
    Public faceted discovery for the marketing site.
    Query params:
      - type: monuments | festivals | deities | persons | guthis | rituals (default persons)
      - q: optional search string (empty = recent records)
    """
    type_key = (request.GET.get("type") or "persons").strip()
    q = request.GET.get("q", "")

    if type_key not in _DISCOVERY_TYPE_MAP:
        return Response(
            {"error": f"Unknown type '{type_key}'."},
            status=400,
        )

    counts = {}
    for key, (model, fields) in _DISCOVERY_TYPE_MAP.items():
        counts[key] = _filtered_discovery_queryset(model, fields, q).count()

    model, fields = _DISCOVERY_TYPE_MAP[type_key]
    qs = _filtered_discovery_queryset(model, fields, q)[:100]
    results = [_discovery_row(obj, type_key) for obj in qs]

    return Response(
        {
            "q": q.strip(),
            "type": type_key,
            "counts": counts,
            "results": results,
        }
    )


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
