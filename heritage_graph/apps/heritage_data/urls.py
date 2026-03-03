from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router
router = DefaultRouter()
router.register(r'cultural-entities', views.CulturalEntityViewSet, basename='culturalentity')
router.register(r'contribution-queue', views.ContributionQueueViewSet, basename='contributionqueue')
router.register(r'revisions', views.RevisionViewSet, basename='revision')
router.register(r'activities', views.ActivityViewSet, basename='activity')

# Review system routes
router.register(r'review-queue', views.ReviewQueueViewSet, basename='reviewqueue')
router.register(r'review-flags', views.ReviewFlagViewSet, basename='reviewflag')
router.register(r'reviewer-roles', views.ReviewerRoleViewSet, basename='reviewerrole')

# Organizations
router.register(r'organizations', views.OrganizationViewSet, basename='organization')

# New: Notifications, Reactions, Forks, Shares
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'reactions', views.ReactionViewSet, basename='reaction')
router.register(r'forks', views.ForkViewSet, basename='fork')
router.register(r'shares', views.ShareViewSet, basename='share')

# Public contributions (QR code scans)
router.register(r'public-contributions', views.PublicContributionViewSet, basename='publiccontribution')

# router.register(r'submissions', views.SubmissionViewSet, basename='submission')
# router.register(r'comments', views.CommentViewSet, basename='comment')

urlpatterns = [
    # Include all ViewSet URLs under /api/
    path('api/', include(router.urls)),

    # Review workspace and decision endpoints
    path(
        'api/review-workspace/<uuid:entity_id>/',
        views.ReviewWorkspaceView.as_view(),
        name='review-workspace',
    ),
    path(
        'api/review-workspace/<uuid:entity_id>/decide/',
        views.SubmitReviewDecisionView.as_view(),
        name='submit-review-decision',
    ),
    path(
        'api/reviewer-dashboard/',
        views.ReviewerDashboardView.as_view(),
        name='reviewer-dashboard',
    ),

    # Revision diff endpoint
    path(
        'api/entities/<uuid:entity_id>/diff/',
        views.RevisionDiffView.as_view(),
        name='revision-diff',
    ),

    # Entity comments (threaded, with reactions)
    path(
        'api/entities/<uuid:entity_id>/comments/',
        views.EntityCommentViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='entity-comments',
    ),
    path(
        'api/entities/<uuid:entity_id>/comments/<int:pk>/',
        views.EntityCommentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}),
        name='entity-comment-detail',
    ),
    
    # Legacy API endpoints (consider migrating these to ViewSets over time)
    path("api/submissions/", views.SubmissionListView.as_view(), name="submission-list"),
    path(
        "api/submissions/<str:submission_id>/",
        views.SubmissionDetailView.as_view(),
        name="submission-detail",
    ),
    path(
        "api/form-submit/", views.FormSubmissionAPIView.as_view(), name="create_submission"
    ),
    path(
        "api/moderations/<int:pk>/",
        views.ModerationReviewView.as_view(),
        name="moderation-review",
    ),
    path("api/activity-logs/", views.ActivityLogView.as_view(), name="activity-logs"),
    path("api/leaderboard/", views.LeaderboardView.as_view(), name="leaderboard-legacy"),
    path("leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),
    path("api/personal-stats/", views.PersonalStatsView.as_view(), name="personal-stats"),
    
    # Comment URLs
    path(
        "api/comments/", views.CommentListCreateView.as_view(), name="comment-list-create"
    ),
    path(
        "api/comments/<str:pk>/", views.CommentListCreateView.as_view(), name="comment-detail"
    ),
    
    # submission edit suggestion URLs
    path(
        "api/submission-suggestions/",
        views.SubmissionSuggestionViewSet.as_view({"post": "create"}),
        name="submission-suggestion-create",
    ),
    path(
        "api/submission-suggestions/<int:pk>/approve/",
        views.SubmissionSuggestionViewSet.as_view({"post": "approve"}),
        name="submission-suggestion-approve",
    ),
    path(
        "api/submission-suggestions/<int:pk>/reject/",
        views.SubmissionSuggestionViewSet.as_view({"post": "reject"}),
        name="submission-suggestion-reject",
    ),
    path(
        "api/submissions/<str:submission_id>/versions/",
        views.SubmissionVersionListView.as_view(),
        name="submission-versions-list",
    ),
    path(
        "api/submissions/<str:submission_id>/edit-suggestions",
        views.SubmissionEditSuggestionListView.as_view(),
        name="submission-edit-suggestions-list",
    ),
    path(
        "api/submissions/ids", views.SubmissionIdListView.as_view(), name="submission_ids"
    ),
    path("api/testthelogin", views.UserViewSet.as_view({"get": "list"}), name="user-list"),
    path("api/user-stats/", views.UserStatsAPIView.as_view(), name="user-stats"),
    
    # test endpoints
    path("api/testme/", views.TestView.as_view(), name="Test this for auth health"),
    
    # user details
    path(
        "api/user/<str:username>/",
        views.UserProfileDetail.as_view(),
        name="user-profile-detail",
    ),
    # profile image upload
    path(
        "api/user/profile-image/",
        views.UserProfileImageView.as_view(),
        name="user-profile-image",
    ),
]