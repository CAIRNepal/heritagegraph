# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()

# Users
router.register(r'users', UserViewSet)

# Main models
router.register(r'historical_periods', HistoricalPeriodViewSet)
router.register(r'locations', LocationViewSet)
router.register(r'persons', PersonViewSet)
router.register(r'artifacts', ArtifactViewSet)
router.register(r'events', EventViewSet)
router.register(r'traditions', TraditionViewSet)
router.register(r'sources', SourceViewSet)

# Revisions
router.register(r'historical_period_revisions', HistoricalPeriodRevisionViewSet)
router.register(r'location_revisions', LocationRevisionViewSet)
router.register(r'person_revisions', PersonRevisionViewSet)
router.register(r'artifact_revisions', ArtifactRevisionViewSet)
router.register(r'event_revisions', EventRevisionViewSet)
router.register(r'tradition_revisions', TraditionRevisionViewSet)
router.register(r'source_revisions', SourceRevisionViewSet)

# Activities & comments
router.register(r'activities', ActivityViewSet)
router.register(r'historical_period_comments', HistoricalPeriodCommentViewSet)
router.register(r'location_comments', LocationCommentViewSet)
router.register(r'person_comments', PersonCommentViewSet)
router.register(r'artifact_comments', ArtifactCommentViewSet)
router.register(r'event_comments', EventCommentViewSet)
router.register(r'tradition_comments', TraditionCommentViewSet)
router.register(r'source_comments', SourceCommentViewSet)

router.register(r'historical_period_revision_comments', HistoricalPeriodRevisionCommentViewSet)
router.register(r'location_revision_comments', LocationRevisionCommentViewSet)
router.register(r'person_revision_comments', PersonRevisionCommentViewSet)
router.register(r'artifact_revision_comments', ArtifactRevisionCommentViewSet)
router.register(r'event_revision_comments', EventRevisionCommentViewSet)
router.register(r'tradition_revision_comments', TraditionRevisionCommentViewSet)
router.register(r'source_revision_comments', SourceRevisionCommentViewSet)

# Notifications
router.register(r'notifications', NotificationForUserViewSet)

urlpatterns = [
    path('', include(router.urls)),
]