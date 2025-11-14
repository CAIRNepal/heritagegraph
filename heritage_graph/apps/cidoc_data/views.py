from rest_framework import viewsets
from django.contrib.auth.models import User
from .models import *
from .serializers import *

# --- User ViewSet ---
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

# --- Main models ViewSets ---
class HistoricalPeriodViewSet(viewsets.ModelViewSet):
    queryset = HistoricalPeriod.objects.all()
    serializer_class = HistoricalPeriodSerializer

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer

class ArtifactViewSet(viewsets.ModelViewSet):
    queryset = Artifact.objects.all()
    serializer_class = ArtifactSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

class TraditionViewSet(viewsets.ModelViewSet):
    queryset = Tradition.objects.all()
    serializer_class = TraditionSerializer

class SourceViewSet(viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer

# --- Revision ViewSets ---
class HistoricalPeriodRevisionViewSet(viewsets.ModelViewSet):
    queryset = HistoricalPeriodRevision.objects.all()
    serializer_class = HistoricalPeriodRevisionSerializer

class LocationRevisionViewSet(viewsets.ModelViewSet):
    queryset = LocationRevision.objects.all()
    serializer_class = LocationRevisionSerializer

class PersonRevisionViewSet(viewsets.ModelViewSet):
    queryset = PersonRevision.objects.all()
    serializer_class = PersonRevisionSerializer

class ArtifactRevisionViewSet(viewsets.ModelViewSet):
    queryset = ArtifactRevision.objects.all()
    serializer_class = ArtifactRevisionSerializer

class EventRevisionViewSet(viewsets.ModelViewSet):
    queryset = EventRevision.objects.all()
    serializer_class = EventRevisionSerializer

class TraditionRevisionViewSet(viewsets.ModelViewSet):
    queryset = TraditionRevision.objects.all()
    serializer_class = TraditionRevisionSerializer

class SourceRevisionViewSet(viewsets.ModelViewSet):
    queryset = SourceRevision.objects.all()
    serializer_class = SourceRevisionSerializer

# --- Activity and Comment ViewSets ---
class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer

# Generate generic comment viewsets
def create_comment_viewset(model, serializer):
    class CommentViewSet(viewsets.ModelViewSet):
        queryset = model.objects.all()
        serializer_class = serializer
    return CommentViewSet

HistoricalPeriodCommentViewSet = create_comment_viewset(HistoricalPeriodComment, HistoricalPeriodCommentSerializer)
LocationCommentViewSet = create_comment_viewset(LocationComment, LocationCommentSerializer)
PersonCommentViewSet = create_comment_viewset(PersonComment, PersonCommentSerializer)
ArtifactCommentViewSet = create_comment_viewset(ArtifactComment, ArtifactCommentSerializer)
EventCommentViewSet = create_comment_viewset(EventComment, EventCommentSerializer)
TraditionCommentViewSet = create_comment_viewset(TraditionComment, TraditionCommentSerializer)
SourceCommentViewSet = create_comment_viewset(SourceComment, SourceCommentSerializer)

HistoricalPeriodRevisionCommentViewSet = create_comment_viewset(HistoricalPeriodRevisionComment, HistoricalPeriodRevisionCommentSerializer)
LocationRevisionCommentViewSet = create_comment_viewset(LocationRevisionComment, LocationRevisionCommentSerializer)
PersonRevisionCommentViewSet = create_comment_viewset(PersonRevisionComment, PersonRevisionCommentSerializer)
ArtifactRevisionCommentViewSet = create_comment_viewset(ArtifactRevisionComment, ArtifactRevisionCommentSerializer)
EventRevisionCommentViewSet = create_comment_viewset(EventRevisionComment, EventRevisionCommentSerializer)
TraditionRevisionCommentViewSet = create_comment_viewset(TraditionRevisionComment, TraditionRevisionCommentSerializer)
SourceRevisionCommentViewSet = create_comment_viewset(SourceRevisionComment, SourceRevisionCommentSerializer)

# --- Notification ViewSet ---
class NotificationForUserViewSet(viewsets.ModelViewSet):
    queryset = NotificationForUser.objects.all()
    serializer_class = NotificationForUserSerializer
