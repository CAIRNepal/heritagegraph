from django.urls import path

from . import views

urlpatterns = [
    path("submissions/", views.SubmissionListView.as_view(), name="submission-list"),
    path(
        "submissions/<str:submission_id>/",
        views.SubmissionDetailView.as_view(),
        name="submission-detail",
    ),
    path(
        "form-submit/", views.FormSubmissionAPIView.as_view(), name="create_submission"
    ),
    path(
        "moderation/<int:pk>/",
        views.ModerationReviewView.as_view(),
        name="moderation-review",
    ),
    # path('auth/users/me/', views.CustomUserMeView.as_view(), name='user-me'),
    path("activity-logs/", views.ActivityLogView.as_view(), name="activity-logs"),
    path("leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),
    path("personal-stats/", views.PersonalStatsView.as_view(), name="personal-stats"),
    # path('user/<str:username>/', views.UserDetailView.as_view(), name='user-detail'),
    # Comment URLs
    path(
        "comments/", views.CommentListCreateView.as_view(), name="comment-list-create"
    ),
    path(
        "comments/<str:pk>/", views.CommentDetailView.as_view(), name="comment-detail"
    ),
    # path('submission/form/create/', create_submission, name="Formm submission")
    # submission edit suggestion URLs here
    path(
        "submission-suggestions/",
        views.SubmissionSuggestionViewSet.as_view({"post": "create"}),
        name="submission-suggestion-create",
    ),
    path(
        "submission-suggestions/<int:pk>/approve/",
        views.SubmissionSuggestionViewSet.as_view({"post": "approve"}),
        name="submission-suggestion-approve",
    ),
    path(
        "submission-suggestions/<int:pk>/reject/",
        views.SubmissionSuggestionViewSet.as_view({"post": "reject"}),
        name="submission-suggestion-reject",
    ),
    path(
        "submissions/<str:submission_id>/versions/",
        views.SubmissionVersionListView.as_view(),
        name="submission-versions-list",
    ),
    path(
        "submissions/<str:submission_id>/edit-suggestions",
        views.SubmissionEditSuggestionListView.as_view(),
        name="submission-edit-suggestions-list",
    ),
    path(
        "submissions/ids", views.SubmissionIdListView.as_view(), name="submission_ids"
    ),
    path("testthelogin", views.UserViewSet.as_view({"get": "list"}), name="user-list"),
    path("user-stats/", views.UserStatsAPIView.as_view(), name="user-stats"),
]
