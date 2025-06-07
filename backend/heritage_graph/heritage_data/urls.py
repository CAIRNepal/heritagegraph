from django.urls import path
from .views import SubmissionCreateView, SubmissionListView, ModerationReviewView, UserRegistrationView, CustomUserMeView, ActivityLogView, LeaderboardView, UserDetailView, SubmissionDetailView, FormSubmissionAPIView, SubmissionCreateView

urlpatterns = [
    path('submissions/', SubmissionListView.as_view(), name='submission-list'), 
    path('submissions/<str:title>/', SubmissionDetailView.as_view(), name='submission-detail'),
    path('form-submit/', FormSubmissionAPIView.as_view(), name='create_submission'),
    path('moderation/<int:pk>/', ModerationReviewView.as_view(), name='moderation-review'),  
    path('auth/users/me/', CustomUserMeView.as_view(), name='user-me'),
    path('activity-logs/', ActivityLogView.as_view(), name='activity-logs'),
    path('auth/register/', UserRegistrationView.as_view(), name='user-register'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('user/<str:username>/', UserDetailView.as_view(), name='user-detail'),
    # path('submission/form/create/', create_submission, name="Formm submission")

]
