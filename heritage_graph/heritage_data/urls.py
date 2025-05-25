from django.urls import path
from .views import SubmissionCreateView, SubmissionListView, ModerationReviewView, UserRegistrationView, CustomUserMeView, ActivityLogView, LeaderboardView, UserDetailView, SubmissionDetailView, FormSubmissionAPIView, SubmissionCreateView, PersonalStatsView, CommentListCreateView, CommentDetailView, SubmissionSuggestionViewSet, SubmissionVersionListView, SubmissionEditSuggestionListView, SubmissionIdListView

urlpatterns = [
    path('submissions/', SubmissionListView.as_view(), name='submission-list'), 
    path('submissions/<str:submission_id>/', SubmissionDetailView.as_view(), name='submission-detail'),
    path('form-submit/', FormSubmissionAPIView.as_view(), name='create_submission'),
    path('moderation/<int:pk>/', ModerationReviewView.as_view(), name='moderation-review'),  
    path('auth/users/me/', CustomUserMeView.as_view(), name='user-me'),
    path('activity-logs/', ActivityLogView.as_view(), name='activity-logs'),
    path('auth/register/', UserRegistrationView.as_view(), name='user-register'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('personal-stats/', PersonalStatsView.as_view(), name='personal-stats'),
    path('user/<str:username>/', UserDetailView.as_view(), name='user-detail'),

    # Comment URLs
    path('comments/', CommentListCreateView.as_view(), name='comment-list-create'),
    path('comments/<str:pk>/', CommentDetailView.as_view(), name='comment-detail'),
    # path('submission/form/create/', create_submission, name="Formm submission")

    # submission edit suggestion URLs here
    path('submission-suggestions/', SubmissionSuggestionViewSet.as_view({'post': 'create'}), name='submission-suggestion-create'),
    path('submission-suggestions/<int:pk>/approve/', SubmissionSuggestionViewSet.as_view({'post': 'approve'}), name='submission-suggestion-approve'),
    path('submission-suggestions/<int:pk>/reject/', SubmissionSuggestionViewSet.as_view({'post': 'reject'}), name='submission-suggestion-reject'),

    path('submissions/<str:submission_id>/versions/', SubmissionVersionListView.as_view(), name='submission-versions-list'),
    path('submissions/<str:submission_id>/edit-suggestions', SubmissionEditSuggestionListView.as_view(), name='submission-edit-suggestions-list'),

    path('submissions/ids', SubmissionIdListView.as_view(), name='submission_ids'),

]
