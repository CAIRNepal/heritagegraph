from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.exceptions import NotFound
from drf_yasg.utils import swagger_auto_schema
from rest_framework.decorators import api_view
from django.shortcuts import render
from django.http import HttpResponse


from .models import UserProfile
from .serializers import UserProfileSerializer


from .models import Submission, Moderation, ActivityLog
from .serializers import SubmissionSerializer, ModerationSerializer, CustomUserSerializer, ActivityLogSerializer, UserSignupSerializer, UserSerializer, RegisterSerializer
from django.db.models import Count, Q

User = get_user_model()

class SubmissionCreateView(generics.CreateAPIView):
    queryset = Submission.objects.all()
    serializer_class = SubmissionSerializer
    permission_classes = [AllowAny]  

    def perform_create(self, serializer):
        serializer.save(contributor=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response({
            "message": "Submission created successfully!",
            "submission": response.data
        }, status=status.HTTP_201_CREATED)


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Submission
from .serializers import SubmissionSerializer

# Optional: For Swagger documentation
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi


class FormSubmissionAPIView(APIView):
    """
    Handles submission of cultural heritage form data.

    This endpoint accepts a JSON payload which can include top-level fields like "title" and "description",
    or nested under a "heritage" key. It stores the full submitted JSON and associates the submission with 
    an optional cultural heritage entity.

    Request fields:
    - title (string): Optional. Title of the submission. Falls back to heritage.title.
    - description (string): Optional. Description of the submission. Falls back to heritage.description.
    - cultural_heritage_id (int): Optional. ID of a CulturalHeritage object to associate with this submission.
    - ... any additional fields are stored in `contribution_data`.

    Returns:
    - 201: JSON representation of the created submission.
    - 400: If `cultural_heritage_id` is invalid.
    """

    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_summary="Submit cultural heritage form",
        operation_description="Creates a new submission with optional linkage to a CulturalHeritage entry.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'title': openapi.Schema(type=openapi.TYPE_STRING, description='Title of the submission'),
                'description': openapi.Schema(type=openapi.TYPE_STRING, description='Description of the submission'),
                'cultural_heritage_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='ID of related CulturalHeritage'),
                'heritage': openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'title': openapi.Schema(type=openapi.TYPE_STRING),
                        'description': openapi.Schema(type=openapi.TYPE_STRING),
                    },
                    description="Fallback object for title and description"
                ),
                # Note: Add more expected fields here as needed
            },
            required=[],
        ),
        responses={
            201: openapi.Response('Created', SubmissionSerializer),
            400: openapi.Response('Bad Request'),
        }
    )
    def post(self, request):
        data = request.data
        user = request.user

        title = data.get("title") or data.get("heritage", {}).get("title", "")
        description = data.get("description") or data.get("heritage", {}).get("description", "")

        cultural_heritage_id = data.get("cultural_heritage_id")
        cultural_heritage = None
        if cultural_heritage_id:
            try:
                from .models import CulturalHeritage
                cultural_heritage = CulturalHeritage.objects.get(id=cultural_heritage_id)
            except CulturalHeritage.DoesNotExist:
                return Response({"error": "Invalid cultural_heritage_id"}, status=status.HTTP_400_BAD_REQUEST)

        submission = Submission.objects.create(
            title=title,
            description=description,
            contributor=user,
            cultural_heritage=cultural_heritage,
            contribution_data=data,
            status="pending"
        )

        serializer = SubmissionSerializer(submission)
        return Response(serializer.data, status=status.HTTP_201_CREATED)



# Public view: List all submissions (pending and reviewed)
class SubmissionListView(generics.ListAPIView):
    queryset = Submission.objects.all()
    serializer_class = SubmissionSerializer

# Moderator view: Review a submission
class ModerationReviewView(generics.UpdateAPIView):
    queryset = Moderation.objects.all()
    serializer_class = ModerationSerializer
    permission_classes = [IsAdminUser]

    def update(self, request, *args, **kwargs):
        moderation = self.get_object()
        submission = moderation.submission
        data = request.data

        # Update moderation details
        moderation.moderator = request.user
        moderation.comment = data.get('comment', '')
        moderation.save()

        # Update submission status
        submission.status = data.get('status', submission.status)
        submission.save()

        return Response({
            "submission": SubmissionSerializer(submission).data,
            "moderation": ModerationSerializer(moderation).data
        })

class CustomUserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = CustomUserSerializer(user)
        return Response(serializer.data)

class ActivityLogView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Fetch the latest activity logs, !!! NEEDS Pagination here !!!
        logs = ActivityLog.objects.order_by('-timestamp')[:50]
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data)




class LogoutView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_200_OK)
        except (ObjectDoesNotExist, TokenError):
            return Response(status=status.HTTP_400_BAD_REQUEST)
        

class UserRegistrationView(APIView):
    """
    View to register a new user.
    """

    def post(self, request, *args, **kwargs):
        # Use the UserSignupSerializer to validate and process the incoming data
        serializer = UserSignupSerializer(data=request.data)

        if serializer.is_valid():
            # If the data is valid, create the user and user profile
            user, profile = serializer.save()

            # Return a response with the user and profile information
            return Response({
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                },
                'profile': {
                    'organization': profile.organization,
                    'position': profile.position,
                    'birth_date': profile.birth_date,
                    'university_school': profile.university_school
                },
                'message': 'User created successfully'
            }, status=status.HTTP_201_CREATED)

        # If validation fails, return the validation errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class LeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Aggregate data based on total submissions, accepted submissions, and score
        leaderboard = User.objects.annotate(
            total_submissions=Count('submissions', distinct=True),
            accepted_submissions=Count('submissions', filter=Q(submissions__status='accepted')),
            score=Count('submissions', filter=Q(submissions__status='accepted')) * 10  # Score calculation logic
        ).order_by('-total_submissions', '-accepted_submissions', '-score')  # Order by total submissions, then accepted submissions, then score

        # Rank the users
        ranked_data = []
        current_rank = 1

        # Loop through the leaderboard and assign ranks
        for idx, user in enumerate(leaderboard):
            if idx > 0 and (user.total_submissions != leaderboard[idx - 1].total_submissions or
                            user.accepted_submissions != leaderboard[idx - 1].accepted_submissions or
                            user.score != leaderboard[idx - 1].score):
                current_rank = idx + 1

            ranked_data.append({
                "rank": current_rank,
                "user_id": user.id,
                "username": user.username,
                "total_submissions": user.total_submissions,
                "accepted_submissions": user.accepted_submissions,
                "score": user.score
            })

        return Response(ranked_data)
    
class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer 

    def get_object(self):
        # Get the username from URL parameters
        username = self.kwargs.get('username')
        try:
            user = User.objects.get(username=username)
            return user
        except User.DoesNotExist:
            raise NotFound(detail="User not found", code=404)


class SubmissionDetailView(generics.RetrieveAPIView):
    queryset = Submission.objects.all()
    serializer_class = SubmissionSerializer
    lookup_field = 'title'

    def get_queryset(self):
        # Fetch the title parameter from the URL
        title = self.kwargs['title']
        return Submission.objects.filter(Q(title__iexact=title))
    

class RegisterView(APIView):
    """
    post:
    Register a new user account.

    Accepts username, email, and password. Validates unique email.
    On success, returns a 201 status with a success message.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User created successfully!"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    


class CurrentUserView(APIView):
    """
    get:
    Return the currently authenticated user's username and email.

    This endpoint requires a valid JWT token in the Authorization header.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "username": user.username,
            "email": user.email,
        })
    

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Submission
import json


@csrf_exempt
@login_required
def create_submission(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user = request.user

            heritage_data = data.get("heritage", {})
            title = heritage_data.get("title", "")
            description = heritage_data.get("description", "")
            status = data.get("status", "pending")

            submission = Submission.objects.create(
                title=title,
                description=description,
                contributor=user,
                status=status,
                contribution_data=data,
            )

            return JsonResponse({"message": "Submission saved successfully!"}, status=201)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)

    return JsonResponse({"error": "Invalid request method"}, status=405)

