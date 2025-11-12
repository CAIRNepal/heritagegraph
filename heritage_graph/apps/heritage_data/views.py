import json

# from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from drf_yasg import openapi

from django.db.models import Q
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import CulturalEntity, Revision, Activity
from .serializers import *
from .permissions import IsContributorOrReadOnly, IsEditor


# For Swagger documentation
from drf_yasg.utils import swagger_auto_schema
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    ActivityLog,
    Comments,
    CulturalHeritage,
    Moderation,
    Submission,
    SubmissionEditSuggestion,
    SubmissionVersion,
    UserProfile,
    UserStats,
)
from .serializers import (
    ActivityLogSerializer,
    CommentSerializer,
    CustomUserSerializer,
    ModerationSerializer,
    RegisterSerializer,
    SubmissionEditSuggestionSerializer,
    SubmissionIdSerializer,
    SubmissionSerializer,
    SubmissionVersionSerializer,
    UserProfileSerializer,
    UserSerializer,
    UserSignupSerializer,
    UserStatsSerializer,
)

# from .models import UserProfile, Comments
# from .serializers import UserProfileSerializer


class SubmissionCreateView(generics.CreateAPIView):
    queryset = Submission.objects.all()
    serializer_class = SubmissionSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        serializer.save(contributor=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response(
            {
                "message": "Submission created successfully!",
                "submission": response.data,
            },
            status=status.HTTP_201_CREATED,
        )


class FormSubmissionAPIView(APIView):
    """
    Handles submission of cultural heritage form data.

    Accepts JSON payload with top-level fields
    Stores all submitted data in contribution_data and links optional CulturalHeritage.
    """

    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Submit cultural heritage form",
        operation_description="Creates a new submission",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "title": openapi.Schema(
                    type=openapi.TYPE_STRING, description="Title of the submission"
                ),
                "description": openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description="Description of the submission",
                ),
                "cultural_heritage_id": openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description="ID of related CulturalHeritage",
                ),
                "heritage": openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "title": openapi.Schema(type=openapi.TYPE_STRING),
                        "description": openapi.Schema(type=openapi.TYPE_STRING),
                    },
                    description="Fallback object for title and description",
                ),
                # Swagger won't list all 80+ new fields explicitly to avoid clutter
            },
            required=[],
        ),
        responses={
            201: openapi.Response("Created", SubmissionSerializer),
            400: openapi.Response("Bad Request"),
        },
    )
    def post(self, request):
        data = request.data
        user = request.user

        title = data.get("title") or data.get("heritage", {}).get("title", "")
        description = data.get("description") or data.get("heritage", {}).get(
            "description", ""
        )

        # Optional CulturalHeritage linkage
        cultural_heritage = None
        cultural_heritage_id = data.get("cultural_heritage_id")
        if cultural_heritage_id:
            try:
                cultural_heritage = CulturalHeritage.objects.get(
                    id=cultural_heritage_id
                )
            except CulturalHeritage.DoesNotExist:
                return Response(
                    {"error": "Invalid cultural_heritage_id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Prepare submission data
        submission_data = {
            "title": title,
            "description": description,
            "contributor": user,
            "cultural_heritage": cultural_heritage,
            "status": "pending",
        }

        # List of all new fields added to Submission model
        new_fields = [
            "Activity",
            "Alternative_name_s",
            "Anglicized_name",
            "Base_plinth_depth",
            "Base_plinth_height",
            "Base_plinth_width",
            "Cakula_depth",
            "Cakula_height",
            "Cakula_width",
            "Capital_depth",
            "Capital_height",
            "Capital_width",
            "Circumference",
            "City_quarter_tola",
            "Column_depth",
            "Column_height",
            "Column_width",
            "Commentary",
            "Date_BCE_CE",
            "Date_VS_NS",
            "Depth",
            "Description_for_past_interventions",
            "Description_in_Nepali",
            "Details",
            "District",
            "Edge_at_platform",
            "Editorial_team",
            "End_date",
            "Event_name",
            "Forms_of_columns",
            "Gate",
            "Height",
            "Heritage_focus_area",
            "Identified_threats",
            "Image_declaration",
            "Inscription_identification_number",
            "Lintel_depth",
            "Lintel_height",
            "Main_deity_in_the_sanctum",
            "Maps_and_drawing_type",
            "Monument_assessment",
            "Monument_depth",
            "Monument_diameter",
            "Monument_height_approximate",
            "Monument_length",
            "Monument_name",
            "Monument_shape",
            "Monument_type",
            "Municipality_village_council",
            "Name",
            "Name_in_Devanagari",
            "Nepali_month",
            "Number_of_bays_front",
            "Number_of_bays_sides",
            "Number_of_doors",
            "Number_of_plinth",
            "Number_of_roofs",
            "Number_of_storeys",
            "Number_of_struts",
            "Number_of_wood_carved_windows",
            "Object_ID_number",
            "Object_location",
            "Object_material",
            "Object_type",
            "Paksa",
            "Peculiarities",
            "Period",
            "Platforms_floor",
            "Profile_at_base",
            "Province_number",
            "Reference_source",
            "Religion",
            "Roofing",
            "Short_description",
            "Sources",
            "Thickness_of_main_wall",
            "Tithi",
            "Top_plinth_depth",
            "Top_plinth_height",
            "Top_plinth_width",
            "Type_of_bricks",
            "Type_of_roof",
            "Width",
            "Year_SS_NS_VS",
        ]

        # Populate new fields if provided
        for field in new_fields:
            if field in data:
                submission_data[field] = data[field]

        # Store all extra fields in contribution_data
        submission_data["contribution_data"] = data

        # Create submission
        submission = Submission.objects.create(**submission_data)

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
        moderation.comment = data.get("comment", "")
        moderation.save()

        # Update submission status
        submission.status = data.get("status", submission.status)
        submission.save()

        return Response(
            {
                "submission": SubmissionSerializer(submission).data,
                "moderation": ModerationSerializer(moderation).data,
            }
        )


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
        logs = ActivityLog.objects.order_by("-timestamp")[:50]
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
            return Response(
                {
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    },
                    "profile": {
                        "organization": profile.organization,
                        "position": profile.position,
                        "birth_date": profile.birth_date,
                        "university_school": profile.university_school,
                    },
                    "message": "User created successfully",
                },
                status=status.HTTP_201_CREATED,
            )

        # If validation fails, return the validation errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LeaderboardView(APIView):
    def get(self, request):
        leaderboard = User.objects.annotate(
            total_submissions=Count("submissions", distinct=True),
            accepted_submissions=Count(
                "submissions", filter=Q(submissions__status="accepted")
            ),
            score=Count("submissions", filter=Q(submissions__status="accepted")) * 10,
        ).order_by("-score", "-accepted_submissions", "-total_submissions")

        ranked_data = []
        current_rank = 1

        for idx, user in enumerate(leaderboard):
            if idx > 0 and (
                user.score != leaderboard[idx - 1].score
                or user.accepted_submissions
                != leaderboard[idx - 1].accepted_submissions
                or user.total_submissions != leaderboard[idx - 1].total_submissions
            ):
                current_rank = idx + 1

            ranked_data.append(
                {
                    "total_submission": user.total_submissions,
                    "rank": current_rank,
                    "user_id": user.id,
                    "username": user.username,
                    "institution": (
                        user.institution if hasattr(user, "institution") else "N/A"
                    ),
                    "country": user.country if hasattr(user, "country") else "N/A",
                    "score": user.score,
                }
            )

        return Response(ranked_data)


class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_object(self):
        username = self.kwargs.get("username")
        try:
            user = User.objects.get(username=username)
            return user
        except User.DoesNotExist:
            raise NotFound(detail="User not found", code=404)


class SubmissionDetailView(generics.RetrieveAPIView):
    queryset = Submission.objects.all()
    serializer_class = SubmissionSerializer
    lookup_field = "submission_id"

    def get_queryset(self):
        submission_id = self.kwargs["submission_id"]
        return Submission.objects.filter(submission_id=submission_id)


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
            return Response(
                {"message": "User created successfully!"},
                status=status.HTTP_201_CREATED,
            )
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
        return Response(
            {
                "username": user.username,
                "email": user.email,
            }
        )


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

            Submission.objects.create(
                title=title,
                description=description,
                contributor=user,
                status=status,
                contribution_data=data,
            )

            return JsonResponse(
                {"message": "Submission saved successfully!"}, status=201
            )

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)

    return JsonResponse({"error": "Invalid request method"}, status=405)


class PersonalStatsView(APIView):
    """
    API endpoint that returns the logged-in user's personal stats
    including rank, total submissions, accepted submissions, and score.
    """

    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Get personal leaderboard stats",
        operation_description="Returns the leaderboard.",
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "rank": openapi.Schema(
                        type=openapi.TYPE_INTEGER,
                        description="User's rank in the leaderboard",
                    ),
                    "user_id": openapi.Schema(
                        type=openapi.TYPE_INTEGER, description="User ID"
                    ),
                    "username": openapi.Schema(
                        type=openapi.TYPE_STRING, description="Username"
                    ),
                    "total_submissions": openapi.Schema(
                        type=openapi.TYPE_INTEGER,
                        description="Total number of submissions",
                    ),
                    "accepted_submissions": openapi.Schema(
                        type=openapi.TYPE_INTEGER,
                        description="Number of accepted submissions",
                    ),
                    "score": openapi.Schema(
                        type=openapi.TYPE_INTEGER,
                        description="Calculated score",
                    ),
                },
            ),
            404: openapi.Response(description="User not found in leaderboard"),
            401: openapi.Response(
                description="Authentication credentials were not provided or invalid"
            ),
        },
    )
    def get(self, request):
        leaderboard = User.objects.annotate(
            total_submissions=Count("submissions", distinct=True),
            accepted_submissions=Count(
                "submissions", filter=Q(submissions__status="accepted")
            ),
            score=Count("submissions", filter=Q(submissions__status="accepted")) * 10,
        ).order_by("-total_submissions", "-accepted_submissions", "-score")

        current_rank = 1
        user_rank_info = None

        for idx, user in enumerate(leaderboard):
            if idx > 0 and (
                user.total_submissions != leaderboard[idx - 1].total_submissions
                or user.accepted_submissions
                != leaderboard[idx - 1].accepted_submissions
                or user.score != leaderboard[idx - 1].score
            ):
                current_rank = idx + 1

            if user.id == request.user.id:
                user_rank_info = {
                    "rank": current_rank,
                    "user_id": user.id,
                    "username": user.username,
                    "total_submissions": user.total_submissions,
                    "accepted_submissions": user.accepted_submissions,
                    "score": user.score,
                }
                break

        if user_rank_info:
            return Response(user_rank_info)
        else:
            return Response({"detail": "User not found in leaderboard"}, status=404)


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        submission_id = self.request.query_params.get("submission_id")
        print("===========================")
        print(submission_id)
        print("===========================")

        if submission_id:
            return Comments.objects.filter(entity_id=submission_id).order_by(
                "-created_at"
            )
        return Comments.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        submission_id = self.request.data.get("submission_id")
        if not submission_id:
            raise ValidationError({"submission_id": "This field is required."})

        try:
            submission = Submission.objects.get(id=submission_id)
        except Submission.DoesNotExist:
            raise ValidationError({"submission_id": "Invalid submission ID."})

        serializer.save(user=self.request.user, submission=submission)


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Comments.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_update(self, serializer):
        # Only allow comment author to update
        if self.request.user != self.get_object().user:
            raise PermissionDenied("You can only update your own Comments.")
        serializer.save()

    def perform_destroy(self, instance):
        # Only allow comment author to delete
        if self.request.user != instance.user:
            raise PermissionDenied("You can only delete your own Comments.")
        instance.delete()


class SubmissionSuggestionViewSet(viewsets.ModelViewSet):
    queryset = SubmissionEditSuggestion.objects.all()
    serializer_class = SubmissionEditSuggestionSerializer

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        suggestion = self.get_object()
        submission = suggestion.submission

        # Apply suggestion
        submission.title = suggestion.title
        submission.description = suggestion.description
        submission.contribution_data = suggestion.contribution_data
        submission.save()

        suggestion.approved = True
        suggestion.reviewed_by = request.user
        suggestion.reviewed_at = timezone.now()
        suggestion.save()

        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        suggestion = self.get_object()
        suggestion.approved = False
        suggestion.reviewed_by = request.user
        suggestion.reviewed_at = timezone.now()
        suggestion.save()

        return Response({"status": "rejected"})


class SubmissionVersionListView(APIView):
    def get(self, request, submission_id, *args, **kwargs):
        # Fetch the submission by its submission_id
        try:
            submission = Submission.objects.get(submission_id=submission_id)
        except Submission.DoesNotExist:
            return Response(
                {"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # Get all versions for this submission
        versions = SubmissionVersion.objects.filter(submission=submission).order_by(
            "-version_number"
        )

        # Serialize the versions
        serializer = SubmissionVersionSerializer(versions, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmissionEditSuggestionListView(APIView):
    def get(self, request, submission_id, *args, **kwargs):
        try:
            submission = Submission.objects.get(submission_id=submission_id)
        except Submission.DoesNotExist:
            return Response(
                {"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # Get all edit suggestions for this submission
        suggestions = SubmissionEditSuggestion.objects.filter(
            submission=submission
        ).order_by("-created_at")

        # Serialize the suggestions
        serializer = SubmissionEditSuggestionSerializer(suggestions, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmissionIdListView(APIView):
    def get(self, request):
        # Get all submissions, just the ID field
        submissions = Submission.objects.all()
        serializer = SubmissionIdSerializer(submissions, many=True)
        return Response(
            [submission["submission_id"] for submission in serializer.data],
            status=status.HTTP_200_OK,
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User


class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserStatsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats, _ = UserStats.objects.get_or_create(user=request.user)
        serializer = UserStatsSerializer(stats)
        return Response(serializer.data)


class TestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # request.user is now a Django User object
        roles = []
        return Response({"message": f"Hello {request.user.username}, roles: {roles}"})


class UserProfileDetail(APIView):
    """
    GET: Public endpoint to fetch a user's profile.
    POST: Protected endpoint to update user's own profile
           (requires authentication via Keycloak JWT).
    """

    permission_classes = [AllowAny]  # default, overridden per method

    def get_permissions(self):
        """
        Assign permissions per HTTP method.
        """
        if self.request.method == "POST":
            return [IsAuthenticated()]  # instantiate, protects POST
        return [AllowAny()]  # GET is public

    def get(self, request, *args, **kwargs):
        username = kwargs.get("username")
        if not username:
            return Response(
                {"error": "username is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username=username)
            profile = UserProfile.objects.get(user=user)
        except (User.DoesNotExist, UserProfile.DoesNotExist):
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        data = request.data
        username = kwargs.get("username")
        email = data.get("email")

        if not username:
            return Response(
                {"error": "username is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create User
        user, _ = User.objects.get_or_create(
            username=username, defaults={"email": email}
        )

        # Only allow the authenticated user to update their own profile
        if request.user != user:
            return Response(
                {"error": "You do not have permission to update this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get or create UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=user)

        # Update fields with serializer
        serializer = UserProfileSerializer(profile, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CulturalEntityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Cultural Entities
    """
    queryset = CulturalEntity.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'status']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CulturalEntityCreateSerializer
        elif self.action == 'update' or self.action == 'partial_update':
            return CulturalEntityUpdateSerializer
        elif self.action == 'list':
            return CulturalEntityListSerializer
        return CulturalEntityDetailSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'my_contributions', 'create_revision']:
            permission_classes = [permissions.IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy']:
            permission_classes = [permissions.IsAuthenticated, IsContributorOrReadOnly]
        else:
            permission_classes = [permissions.IsAuthenticatedOrReadOnly]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        queryset = CulturalEntity.objects.all()
        
        # For list action, only show accepted entities to non-staff users
        if self.action == 'list' and not self.request.user.is_staff:
            queryset = queryset.filter()
        
        # Prefetch related data for performance
        if self.action in ['retrieve', 'list']:
            queryset = queryset.select_related('contributor', 'current_revision').prefetch_related('revisions', 'activities')
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(contributor=self.request.user)
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_contributions(self, request):
        """
        Get contributions by the current user
        """
        contributions = CulturalEntity.objects.filter(contributor=request.user)
        page = self.paginate_queryset(contributions)
        if page is not None:
            serializer = CulturalEntityListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = CulturalEntityListSerializer(contributions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsContributorOrReadOnly])
    def create_revision(self, request, pk=None):
        """
        Create a new revision for an existing entity
        """
        entity = self.get_object()
        
        # Only allow revisions for rejected or draft entities
        if entity.status not in ['rejected', 'draft']:
            return Response(
                {'error': 'Can only create revisions for rejected or draft entities'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = RevisionCreateSerializer(
            data=request.data,
            context={'entity': entity, 'request': request}
        )
        
        if serializer.is_valid():
            revision = serializer.save()
            return Response(
                RevisionSerializer(revision).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def submit_for_review(self, request, pk=None):
        """
        Submit a draft entity for review
        """
        entity = self.get_object()
        
        if entity.status != 'draft':
            return Response(
                {'error': 'Only draft entities can be submitted for review'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if entity.contributor != request.user:
            return Response(
                {'error': 'Only the contributor can submit for review'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        entity.submit_for_review()
        return Response(
            {'message': 'Entity submitted for review successfully'},
            status=status.HTTP_200_OK
        )

class ContributionQueueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing and moderating contributions.
    - GET requests (list/retrieve) are public.
    - POST /moderate requires authentication + editor permissions.
    """
    serializer_class = ContributionQueueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['category', 'status']
    search_fields = ['name', 'description']

    def get_permissions(self):
        """
        Make GET public, but restrict other actions to authenticated editors.
        """
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsEditor()]

    def get_queryset(self):
        """
        Only include pending or pending-revision contributions in the queue.
        """
        return (
            CulturalEntity.objects.filter(status__in=['pending_review', 'pending_revision'])
            .select_related('contributor')
            .prefetch_related('activities')
        )

    @action(detail=True, methods=['post'])
    def moderate(self, request, pk=None):
        """
        Moderate a contribution (accept or reject).
        Only for authenticated editors.
        """
        entity = self.get_object()
        serializer = ModerationActionSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        comment = serializer.validated_data.get('comment', '')

        if action == 'accept':
            entity.accept_contribution(request.user, comment)
            return Response({'message': 'Entity accepted successfully'}, status=status.HTTP_200_OK)

        elif action == 'reject':
            entity.reject_contribution(request.user, comment)
            return Response({'message': 'Entity rejected successfully'}, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

class RevisionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing revisions
    """
    serializer_class = RevisionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        return Revision.objects.select_related('created_by', 'entity')
    
    @action(detail=True, methods=['get'])
    def entity_history(self, request, pk=None):
        """
        Get complete history of an entity including revisions and activities
        """
        revision = self.get_object()
        entity = revision.entity
        
        entity_data = CulturalEntityDetailSerializer(entity).data
        return Response(entity_data)

class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing activities.
    Returns:
      - All activities if no authenticated user or user is staff.
      - User-specific activities (their own + ones on entities they contributed) otherwise.
    """
    serializer_class = ActivitySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['activity_type', 'entity']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user

        # If anonymous user → return all (or optionally none)
        if not user or user.is_anonymous:
            return Activity.objects.all().select_related('user', 'entity')

        # Staff/admin → return all
        if user.is_staff:
            return Activity.objects.select_related('user', 'entity')

        # Authenticated non-staff → user-specific
        return Activity.objects.filter(
            Q(user=user) | Q(entity__contributor=user)
        ).select_related('user', 'entity')
