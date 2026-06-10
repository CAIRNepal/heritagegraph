from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views
from .i18n_views import convert_date, locale_info

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
router.register(
    r'reviewer-applications',
    views.ReviewerApplicationViewSet,
    basename='reviewerapplication',
)
router.register(
    r'platform-admin/users',
    views.PlatformAdminUserViewSet,
    basename='platform-admin-user',
)
router.register(
    r'schema-extension-proposals',
    views.SchemaExtensionProposalViewSet,
    basename='schemaextensionproposal',
)
router.register(
    r'entity-proposals',
    views.EntityProposalViewSet,
    basename='entityproposal',
)
router.register(
    r'relationship-proposals',
    views.RelationshipProposalViewSet,
    basename='relationshipproposal',
)

# Organizations
router.register(r'organizations', views.OrganizationViewSet, basename='organization')

# New: Notifications, Reactions, Forks, Shares
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'reactions', views.ReactionViewSet, basename='reaction')
router.register(r'forks', views.ForkViewSet, basename='fork')
router.register(r'shares', views.ShareViewSet, basename='share')

# Public contributions (QR code scans)
router.register(r'public-contributions', views.PublicContributionViewSet, basename='publiccontribution')

# Legacy workflow: standardized ViewSets
router.register(r"submissions", views.SubmissionViewSet, basename="submission")
router.register(r"comments", views.CommentViewSet, basename="comment")
router.register(r"activity-logs", views.ActivityLogViewSet, basename="activity-log")

# Project-based contribution (final_plan.md §3)
router.register(r"projects", views.ProjectViewSet, basename="project")

urlpatterns = [
    # Canonical API prefix for this app (kept for backwards compatibility)
    path("api/", include(router.urls)),
    # Preferred (clean) prefix for app resources: /data/<resource>/
    path("", include(router.urls)),

    # Review workspace and decision endpoints
    path(
        "api/review-workspace/<uuid:entity_id>/",
        views.ReviewWorkspaceView.as_view(),
        name='review-workspace',
    ),
    path(
        "api/review-workspace/<uuid:entity_id>/decide/",
        views.SubmitReviewDecisionView.as_view(),
        name='submit-review-decision',
    ),
    path(
        "api/reviewer-dashboard/",
        views.ReviewerDashboardView.as_view(),
        name='reviewer-dashboard',
    ),
    path(
        "api/review-decisions-profile/",
        views.UserReviewDecisionsListView.as_view(),
        name="review-decisions-profile",
    ),
    path(
        "review-decisions-profile/",
        views.UserReviewDecisionsListView.as_view(),
        name="review-decisions-profile-clean",
    ),

    # Revision diff endpoint
    path(
        "api/entities/<uuid:entity_id>/diff/",
        views.RevisionDiffView.as_view(),
        name='revision-diff',
    ),

    # Entity comments (threaded, with reactions)
    path(
        "api/entities/<uuid:entity_id>/comments/",
        views.EntityCommentViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='entity-comments',
    ),
    path(
        "api/entities/<uuid:entity_id>/comments/<int:pk>/",
        views.EntityCommentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}),
        name='entity-comment-detail',
    ),
    
    # Legacy API endpoints (consider migrating these to ViewSets over time)
    path("api/submissions/", views.SubmissionListView.as_view(), name="submission-list"),
    path("submissions/", views.SubmissionListView.as_view(), name="submission-list-clean"),
    path(
        "api/submissions/<str:submission_id>/",
        views.SubmissionDetailView.as_view(),
        name="submission-detail",
    ),
    path(
        "submissions/<str:submission_id>/",
        views.SubmissionDetailView.as_view(),
        name="submission-detail-clean",
    ),
    path(
        "api/form-submit/", views.FormSubmissionAPIView.as_view(), name="create_submission"
    ),
    path(
        "form-submit/", views.FormSubmissionAPIView.as_view(), name="create-submission-clean"
    ),
    path(
        "api/moderations/<int:pk>/",
        views.ModerationReviewView.as_view(),
        name="moderation-review",
    ),
    path(
        "moderations/<int:pk>/",
        views.ModerationReviewView.as_view(),
        name="moderation-review-clean",
    ),
    path("api/activity-logs/", views.ActivityLogView.as_view(), name="activity-logs"),
    path("activity-logs/", views.ActivityLogView.as_view(), name="activity-logs-clean"),
    path("api/leaderboard/", views.LeaderboardView.as_view(), name="leaderboard-legacy"),
    path("leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),
    path("api/contributors/", views.ContributorsListView.as_view(), name="contributors-list"),
    path("contributors/", views.ContributorsListView.as_view(), name="contributors-list-clean"),
    path("api/personal-stats/", views.PersonalStatsView.as_view(), name="personal-stats"),
    path("personal-stats/", views.PersonalStatsView.as_view(), name="personal-stats-clean"),
    path("api/progression/", views.ProgressionView.as_view(), name="progression"),
    path("progression/", views.ProgressionView.as_view(), name="progression-clean"),
    
    # Comment URLs
    path(
        "api/comments/", views.CommentListCreateView.as_view(), name="comment-list-create"
    ),
    path(
        "comments/", views.CommentListCreateView.as_view(), name="comment-list-create-clean"
    ),
    path(
        "api/comments/<str:pk>/", views.CommentListCreateView.as_view(), name="comment-detail"
    ),
    path(
        "comments/<str:pk>/", views.CommentListCreateView.as_view(), name="comment-detail-clean"
    ),
    
    # submission edit suggestion URLs
    path(
        "api/submission-suggestions/",
        views.SubmissionSuggestionViewSet.as_view({"post": "create"}),
        name="submission-suggestion-create",
    ),
    path(
        "submission-suggestions/",
        views.SubmissionSuggestionViewSet.as_view({"post": "create"}),
        name="submission-suggestion-create-clean",
    ),
    path(
        "api/submission-suggestions/<int:pk>/approve/",
        views.SubmissionSuggestionViewSet.as_view({"post": "approve"}),
        name="submission-suggestion-approve",
    ),
    path(
        "submission-suggestions/<int:pk>/approve/",
        views.SubmissionSuggestionViewSet.as_view({"post": "approve"}),
        name="submission-suggestion-approve-clean",
    ),
    path(
        "api/submission-suggestions/<int:pk>/reject/",
        views.SubmissionSuggestionViewSet.as_view({"post": "reject"}),
        name="submission-suggestion-reject",
    ),
    path(
        "submission-suggestions/<int:pk>/reject/",
        views.SubmissionSuggestionViewSet.as_view({"post": "reject"}),
        name="submission-suggestion-reject-clean",
    ),
    path(
        "api/submissions/<str:submission_id>/versions/",
        views.SubmissionVersionListView.as_view(),
        name="submission-versions-list",
    ),
    path(
        "submissions/<str:submission_id>/versions/",
        views.SubmissionVersionListView.as_view(),
        name="submission-versions-list-clean",
    ),
    path(
        "api/submissions/<str:submission_id>/edit-suggestions",
        views.SubmissionEditSuggestionListView.as_view(),
        name="submission-edit-suggestions-list",
    ),
    path(
        "submissions/<str:submission_id>/edit-suggestions",
        views.SubmissionEditSuggestionListView.as_view(),
        name="submission-edit-suggestions-list-clean",
    ),
    path(
        "api/submissions/ids", views.SubmissionIdListView.as_view(), name="submission_ids"
    ),
    path(
        "submissions/ids", views.SubmissionIdListView.as_view(), name="submission-ids-clean"
    ),
    path("api/testthelogin", views.UserViewSet.as_view({"get": "list"}), name="user-list"),
    path("testthelogin", views.UserViewSet.as_view({"get": "list"}), name="user-list-clean"),
    path("api/user-stats/", views.UserStatsAPIView.as_view(), name="user-stats"),
    path("user-stats/", views.UserStatsAPIView.as_view(), name="user-stats-clean"),
    
    # test endpoints
    path("api/testme/", views.TestView.as_view(), name="Test this for auth health"),
    path("testme/", views.TestView.as_view(), name="testme-clean"),
    
    # user details — current user's own profile (must come before slug pattern)
    path(
        "api/user/me/",
        views.UserProfileMeView.as_view(),
        name="user-profile-me",
    ),
    path(
        "user/me/",
        views.UserProfileMeView.as_view(),
        name="user-profile-me-clean",
    ),
    # user details — public profile by slug (UUID)
    path(
        "api/user/<uuid:slug>/",
        views.UserProfileDetail.as_view(),
        name="user-profile-detail",
    ),
    path(
        "user/<uuid:slug>/",
        views.UserProfileDetail.as_view(),
        name="user-profile-detail-clean",
    ),
    # user details — public profile by username string
    path(
        "api/user/by-username/<str:username>/",
        views.UserProfileByUsernameView.as_view(),
        name="user-profile-by-username",
    ),
    path(
        "user/by-username/<str:username>/",
        views.UserProfileByUsernameView.as_view(),
        name="user-profile-by-username-clean",
    ),
    # profile image upload
    path(
        "api/user/profile-image/",
        views.UserProfileImageView.as_view(),
        name="user-profile-image",
    ),
    path(
        "user/profile-image/",
        views.UserProfileImageView.as_view(),
        name="user-profile-image-clean",
    ),

    # ── i18n / Bikram Sambat endpoints ──────────────────────────────────────
    path("api/i18n/locale-info/", locale_info, name="locale-info"),
    path("api/i18n/convert-date/", convert_date, name="convert-date"),

    # ── Project-scoped sub-resources (final_plan.md §3) ─────────────────────
    path(
        "projects/<slug:project_slug>/memberships/",
        views.ProjectMembershipViewSet.as_view({"get": "list", "post": "create"}),
        name="project-membership-list",
    ),
    path(
        "projects/<slug:project_slug>/memberships/<uuid:pk>/",
        views.ProjectMembershipViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-membership-detail",
    ),
    path(
        "projects/<slug:project_slug>/assets/",
        views.ProjectAssetViewSet.as_view({"get": "list", "post": "create"}),
        name="project-asset-list",
    ),
    path(
        "projects/<slug:project_slug>/assets/upload/",
        views.ProjectAssetViewSet.as_view({"post": "upload"}),
        name="project-asset-upload",
    ),
    path(
        "projects/<slug:project_slug>/assets/<uuid:pk>/",
        views.ProjectAssetViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-asset-detail",
    ),
    path(
        "projects/<slug:project_slug>/assets/<uuid:pk>/start-ocr/",
        views.ProjectAssetViewSet.as_view({"post": "start_ocr"}),
        name="project-asset-start-ocr",
    ),
    path(
        "projects/<slug:project_slug>/entities/",
        views.ProjectEntityViewSet.as_view({"get": "list", "post": "create"}),
        name="project-entity-list",
    ),
    path(
        "projects/<slug:project_slug>/entities/<uuid:pk>/",
        views.ProjectEntityViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-entity-detail",
    ),
    # ── Project comments (final_plan.md §10.1) ──────────────────────────────
    path(
        "projects/<slug:project_slug>/comments/",
        views.ProjectCommentViewSet.as_view({"get": "list", "post": "create"}),
        name="project-comment-list",
    ),
    path(
        "projects/<slug:project_slug>/comments/<str:comment_id>/",
        views.ProjectCommentViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-comment-detail",
    ),
]