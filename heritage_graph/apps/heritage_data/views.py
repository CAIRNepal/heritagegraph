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
from .models import CulturalEntity, Revision, Activity, ReviewDecision, ReviewFlag, ReviewerRole
from .models import Organization, OrganizationMembership
from .models import Notification, Reaction, Fork, Share
from .models import PublicContribution
from .serializers import *
from .permissions import (
    IsContributorOrReadOnly, IsEditor, IsReviewerOrAdmin,
    IsCommunityReviewer, IsDomainExpert, IsExpertCurator,
)


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
    Organization,
    OrganizationMembership,
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
    """
    Public leaderboard that ranks users by their contributions.

    Scoring:
      - Each accepted CulturalEntity    = 10 pts
      - Each submitted CulturalEntity    =  3 pts
      - Each review decision             =  5 pts
      - Each revision created            =  2 pts
      - Each accepted legacy Submission  = 10 pts
      - Each legacy Submission           =  3 pts

    Supports ?search= query param to filter by username.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        search = request.query_params.get("search", "").strip()

        qs = User.objects.select_related("profile").annotate(
            # New workflow – CulturalEntity
            entity_count=Count("contributed_entities", distinct=True),
            accepted_entities=Count(
                "contributed_entities",
                filter=Q(contributed_entities__status="accepted"),
                distinct=True,
            ),
            # Reviews performed
            review_count=Count("review_decisions", distinct=True),
            # Revisions authored
            revision_count=Count("created_revisions", distinct=True),
            # Legacy Submission
            submission_count=Count("submissions", distinct=True),
            accepted_submissions=Count(
                "submissions",
                filter=Q(submissions__status="accepted"),
                distinct=True,
            ),
        )

        if search:
            qs = qs.filter(username__icontains=search)

        # Exclude users with zero activity
        qs = qs.filter(
            Q(entity_count__gt=0)
            | Q(review_count__gt=0)
            | Q(revision_count__gt=0)
            | Q(submission_count__gt=0)
        )

        # Annotate a computed score (Django ORM doesn't allow referencing
        # other annotations in the same annotate() call, so we compute
        # the score in Python after the query).
        users = list(qs.order_by("username"))

        # Compute score + gather profile data
        entries = []
        for user in users:
            score = (
                user.accepted_entities * 10
                + (user.entity_count - user.accepted_entities) * 3
                + user.review_count * 5
                + user.revision_count * 2
                + user.accepted_submissions * 10
                + (user.submission_count - user.accepted_submissions) * 3
            )
            profile = getattr(user, "profile", None)
            entries.append(
                {
                    "user_id": user.id,
                    "username": user.username,
                    "full_name": (
                        f"{profile.first_name} {profile.last_name}".strip()
                        if profile
                        else ""
                    ),
                    "institution": getattr(profile, "organization", "") or "",
                    "country": getattr(profile, "country", "") or "",
                    "profile_image": (
                        profile.profile_image.url
                        if profile and profile.profile_image
                        else ""
                    ),
                    "score": score,
                    "entities": user.entity_count,
                    "accepted_entities": user.accepted_entities,
                    "reviews": user.review_count,
                    "revisions": user.revision_count,
                    "submissions": user.submission_count,
                    "accepted_submissions": user.accepted_submissions,
                }
            )

        # Sort descending by score, then by accepted entities, then username
        entries.sort(key=lambda e: (-e["score"], -e["accepted_entities"], e["username"]))

        # Assign ranks (tied scores get the same rank)
        rank = 1
        for idx, entry in enumerate(entries):
            if idx > 0 and entries[idx - 1]["score"] != entry["score"]:
                rank = idx + 1
            entry["rank"] = rank

        return Response(entries)


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
        entity = serializer.save(contributor=self.request.user)
        # Create notification for the contributor
        create_notification(
            user=self.request.user,
            notification_type='submission_update',
            message=f'Your contribution "{entity.name}" has been created and is in draft status.',
            entity=entity,
            link=f'/dashboard/knowledge/entity/view/{entity.entity_id}',
        )
        # Notify all reviewers about new submission
        reviewer_users = User.objects.filter(
            reviewer_role__is_active=True
        ).exclude(id=self.request.user.id)
        for reviewer in reviewer_users:
            create_notification(
                user=reviewer,
                notification_type='submission_update',
                message=f'New contribution "{entity.name}" submitted by {self.request.user.username} — awaiting review.',
                entity=entity,
                link=f'/dashboard/curation/review/{entity.entity_id}',
            )
    
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


# =====================================================================
# REVIEWER / CURATION VIEWS
# =====================================================================


class ReviewQueueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Triaged review queue with tabs: new_claims, conflicts, flagged, expiring.
    Replaces the flat ContributionQueue with epistemic review categories.
    """
    serializer_class = ContributionQueueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'status']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), IsCommunityReviewer()]
        return [permissions.IsAuthenticated(), IsCommunityReviewer()]

    def get_queryset(self):
        queryset = CulturalEntity.objects.filter(
            status__in=['pending_review', 'pending_revision']
        ).select_related(
            'contributor', 'current_revision'
        ).prefetch_related(
            'activities', 'review_flags', 'review_decisions', 'revisions'
        )

        # Filter by queue tab type
        queue_type = self.request.query_params.get('queue_type', 'all')

        if queue_type == 'new_claims':
            # Freshly submitted, no review decisions yet
            queryset = queryset.filter(
                status='pending_review',
                review_decisions__isnull=True
            )
        elif queue_type == 'conflicts':
            # Has unresolved contradiction flags
            queryset = queryset.filter(
                review_flags__flag_type='contradiction',
                review_flags__is_resolved=False
            ).distinct()
        elif queue_type == 'flagged':
            # Has any unresolved flag (not contradiction)
            queryset = queryset.filter(
                review_flags__is_resolved=False
            ).exclude(
                review_flags__flag_type='contradiction'
            ).distinct()
        elif queue_type == 'expiring':
            # In review for more than 14 days
            from django.utils import timezone
            from datetime import timedelta
            cutoff = timezone.now() - timedelta(days=14)
            queryset = queryset.filter(
                status='pending_review',
                created_at__lt=cutoff
            )

        # Filter by reviewer's domain expertise
        if hasattr(self.request.user, 'reviewer_role'):
            expertise = self.request.query_params.get('my_domain', None)
            if expertise == 'true':
                areas = self.request.user.reviewer_role.expertise_areas
                if areas:
                    queryset = queryset.filter(category__in=areas)

        return queryset

    @action(detail=False, methods=['get'])
    def queue_counts(self, request):
        """Return counts for each queue tab."""
        base = CulturalEntity.objects.filter(
            status__in=['pending_review', 'pending_revision']
        )
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(days=14)

        new_claims = base.filter(
            status='pending_review',
            review_decisions__isnull=True
        ).count()

        conflicts = base.filter(
            review_flags__flag_type='contradiction',
            review_flags__is_resolved=False
        ).distinct().count()

        flagged = base.filter(
            review_flags__is_resolved=False
        ).exclude(
            review_flags__flag_type='contradiction'
        ).distinct().count()

        expiring = base.filter(
            status='pending_review',
            created_at__lt=cutoff
        ).count()

        return Response({
            'new_claims': new_claims,
            'conflicts': conflicts,
            'flagged': flagged,
            'expiring': expiring,
            'total': base.count(),
        })


class ReviewWorkspaceView(generics.RetrieveAPIView):
    """
    Three-panel review workspace for a single entity.
    Returns full context: entity state, provenance history, submission detail,
    contributor stats, and review history.
    """
    serializer_class = ReviewWorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityReviewer]
    lookup_field = 'entity_id'
    queryset = CulturalEntity.objects.select_related(
        'contributor', 'current_revision'
    ).prefetch_related(
        'revisions', 'activities', 'review_decisions', 'review_flags'
    )


class SubmitReviewDecisionView(generics.CreateAPIView):
    """
    Submit a review decision on an entity.
    Applies the verdict (accept/reject/escalate/request_changes) and
    logs the appropriate activity.
    """
    serializer_class = ReviewDecisionCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityReviewer]

    def create(self, request, entity_id=None, *args, **kwargs):
        try:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response(
                {'error': 'Entity not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(
            data=request.data,
            context={'request': request, 'entity': entity}
        )
        serializer.is_valid(raise_exception=True)

        verdict = serializer.validated_data['verdict']
        feedback = serializer.validated_data.get('feedback', '')

        # Create the review decision record
        decision = ReviewDecision.objects.create(
            entity=entity,
            reviewer=request.user,
            revision_reviewed=entity.get_latest_revision(),
            **serializer.validated_data
        )

        # Apply the verdict
        if verdict == 'accept':
            entity.accept_contribution(request.user, feedback)
        elif verdict == 'accept_with_edits':
            entity.accept_contribution(request.user, feedback)
        elif verdict == 'reject':
            entity.reject_contribution(request.user, feedback)
        elif verdict == 'request_changes':
            entity.status = 'pending_revision'
            entity.save()
            Activity.objects.create(
                entity=entity,
                user=request.user,
                activity_type='changes_requested',
                comment=feedback
            )
        elif verdict == 'escalate':
            Activity.objects.create(
                entity=entity,
                user=request.user,
                activity_type='escalated',
                comment=feedback
            )

        # Handle conflict resolution
        conflict_handling = serializer.validated_data.get('conflict_handling', 'not_applicable')
        if conflict_handling != 'not_applicable':
            # Resolve contradiction flags
            entity.review_flags.filter(
                flag_type='contradiction', is_resolved=False
            ).update(
                is_resolved=True,
                resolved_by=request.user,
                resolved_at=timezone.now()
            )
            Activity.objects.create(
                entity=entity,
                user=request.user,
                activity_type='conflict_resolved',
                comment=serializer.validated_data.get('reconciliation_note', '')
            )

        # Notify contributor about the review decision
        verdict_labels = {
            'accept': 'accepted',
            'accept_with_edits': 'accepted with edits',
            'reject': 'rejected',
            'request_changes': 'sent back for changes',
            'escalate': 'escalated to an expert',
        }
        verdict_label = verdict_labels.get(verdict, verdict)
        create_notification(
            user=entity.contributor,
            notification_type='review_decision',
            message=f'Your contribution "{entity.name}" has been {verdict_label} by {request.user.username}.'
                    + (f' Feedback: {feedback[:200]}' if feedback else ''),
            entity=entity,
            link=f'/dashboard/knowledge/entity/view/{entity.entity_id}',
        )

        return Response(
            ReviewDecisionSerializer(decision).data,
            status=status.HTTP_201_CREATED
        )


class ReviewFlagViewSet(viewsets.ModelViewSet):
    """
    CRUD for review flags — community members can flag entities,
    reviewers can resolve flags.
    """
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['flag_type', 'is_resolved', 'entity']

    def get_serializer_class(self):
        if self.action == 'create':
            return ReviewFlagCreateSerializer
        return ReviewFlagSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsCommunityReviewer()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return ReviewFlag.objects.select_related(
            'entity', 'flagged_by', 'resolved_by'
        )

    def perform_create(self, serializer):
        serializer.save(flagged_by=self.request.user)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve a flag."""
        flag = self.get_object()
        flag.is_resolved = True
        flag.resolved_by = request.user
        flag.resolved_at = timezone.now()
        flag.save()
        return Response(ReviewFlagSerializer(flag).data)


class ReviewerRoleViewSet(viewsets.ModelViewSet):
    """
    Manage reviewer roles. Only Expert Curators can assign/modify roles.
    """
    serializer_class = ReviewerRoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsExpertCurator()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return ReviewerRole.objects.select_related('user', 'assigned_by')

    @action(detail=False, methods=['get'])
    def my_role(self, request):
        """Get the current user's reviewer role."""
        try:
            role = ReviewerRole.objects.get(user=request.user)
            return Response(ReviewerRoleSerializer(role).data)
        except ReviewerRole.DoesNotExist:
            return Response(
                {'detail': 'No reviewer role assigned'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def assign(self, request):
        """Expert Curator assigns a reviewer role to a user."""
        serializer = ReviewerRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=serializer.validated_data['user_id'])
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        role, created = ReviewerRole.objects.update_or_create(
            user=user,
            defaults={
                'role': serializer.validated_data['role'],
                'expertise_areas': serializer.validated_data.get('expertise_areas', []),
                'assigned_by': request.user,
                'is_active': True,
            }
        )
        return Response(
            ReviewerRoleSerializer(role).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class ReviewerDashboardView(APIView):
    """
    Reviewer's homepage dashboard — queue stats, impact metrics,
    and recent activity in their domain.
    """
    permission_classes = [permissions.IsAuthenticated, IsCommunityReviewer]

    def get(self, request):
        user = request.user
        from datetime import timedelta

        now = timezone.now()
        week_ago = now - timedelta(days=7)
        expiry_cutoff = now - timedelta(days=14)

        # Queue counts
        base_queue = CulturalEntity.objects.filter(
            status__in=['pending_review', 'pending_revision']
        )
        queue_count = base_queue.count()
        conflicts_count = base_queue.filter(
            review_flags__flag_type='contradiction',
            review_flags__is_resolved=False
        ).distinct().count()
        flagged_count = base_queue.filter(
            review_flags__is_resolved=False
        ).exclude(
            review_flags__flag_type='contradiction'
        ).distinct().count()
        expiring_count = base_queue.filter(
            status='pending_review',
            created_at__lt=expiry_cutoff
        ).count()

        # This week's stats
        decisions_this_week = ReviewDecision.objects.filter(
            reviewer=user, created_at__gte=week_ago
        )
        resolved_this_week = decisions_this_week.count()
        accepted_this_week = decisions_this_week.filter(
            verdict__in=['accept', 'accept_with_edits']
        ).count()
        rejected_this_week = decisions_this_week.filter(verdict='reject').count()

        # Lifetime stats
        all_decisions = ReviewDecision.objects.filter(reviewer=user)
        total_reviewed = all_decisions.count()
        total_accepted = all_decisions.filter(
            verdict__in=['accept', 'accept_with_edits']
        ).count()
        acceptance_rate = (
            round(total_accepted / total_reviewed * 100, 1)
            if total_reviewed > 0 else 0
        )
        conflicts_resolved = Activity.objects.filter(
            user=user, activity_type='conflict_resolved'
        ).count()

        # Reviewer role
        reviewer_role = None
        if hasattr(user, 'reviewer_role'):
            reviewer_role = ReviewerRoleSerializer(user.reviewer_role).data

        # Recent domain activity
        recent_activity = Activity.objects.select_related(
            'entity', 'user'
        ).order_by('-created_at')[:10]

        recent_domain_activity = [
            {
                'entity_name': a.entity.name,
                'entity_id': str(a.entity.entity_id),
                'activity_type': a.activity_type,
                'user': a.user.username,
                'created_at': a.created_at.isoformat(),
                'comment': a.comment or '',
            }
            for a in recent_activity
        ]

        data = {
            'queue_count': queue_count,
            'conflicts_count': conflicts_count,
            'flagged_count': flagged_count,
            'expiring_count': expiring_count,
            'resolved_this_week': resolved_this_week,
            'accepted_this_week': accepted_this_week,
            'rejected_this_week': rejected_this_week,
            'total_reviewed': total_reviewed,
            'acceptance_rate': acceptance_rate,
            'conflicts_resolved': conflicts_resolved,
            'reviewer_role': reviewer_role,
            'recent_domain_activity': recent_domain_activity,
        }

        serializer = ReviewerDashboardSerializer(data)
        return Response(serializer.data)


# =====================================================================
# ORGANIZATION VIEWS
# =====================================================================


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    CRUD for organizations.
    - List/retrieve: public
    - Create: authenticated users
    - Update/delete: org owner or admin
    """
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'short_name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        if self.action in ['retrieve']:
            return OrganizationDetailSerializer
        return OrganizationListSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Organization.objects.annotate(
            member_count=Count('members')
        ).select_related('owner')

    def perform_create(self, serializer):
        org = serializer.save(owner=self.request.user)
        # Auto-add creator as admin member
        OrganizationMembership.objects.create(
            user=self.request.user,
            organization=org,
            role='admin'
        )

    def perform_update(self, serializer):
        org = self.get_object()
        if org.owner != self.request.user and not self.request.user.is_staff:
            is_admin = OrganizationMembership.objects.filter(
                user=self.request.user, organization=org, role='admin'
            ).exists()
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only org admins can update this organization.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join an organization as a member."""
        org = self.get_object()
        membership, created = OrganizationMembership.objects.get_or_create(
            user=request.user,
            organization=org,
            defaults={'role': 'member'}
        )
        if not created:
            return Response({'detail': 'Already a member'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrganizationMemberSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave an organization."""
        org = self.get_object()
        try:
            membership = OrganizationMembership.objects.get(
                user=request.user, organization=org
            )
            if org.owner == request.user:
                return Response(
                    {'detail': 'Organization owner cannot leave. Transfer ownership first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            membership.delete()
            return Response({'detail': 'Left organization'}, status=status.HTTP_200_OK)
        except OrganizationMembership.DoesNotExist:
            return Response({'detail': 'Not a member'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List all members of an organization."""
        org = self.get_object()
        memberships = org.members.select_related('user').order_by('-role', 'joined_at')
        return Response(OrganizationMemberSerializer(memberships, many=True).data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_organizations(self, request):
        """Get organizations the current user belongs to."""
        memberships = OrganizationMembership.objects.filter(
            user=request.user
        ).select_related('organization')
        orgs = [m.organization for m in memberships]
        # Re-query with annotation
        org_ids = [o.id for o in orgs]
        queryset = Organization.objects.filter(id__in=org_ids).annotate(
            member_count=Count('members')
        )
        return Response(OrganizationListSerializer(queryset, many=True).data)


class UserProfileImageView(APIView):
    """Upload or remove profile image."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        image = request.FILES.get('profile_image')
        if not image:
            return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
        profile.profile_image = image
        profile.save()
        return Response({
            'profile_image': profile.profile_image.url if profile.profile_image else None
        })

    def delete(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.profile_image:
            profile.profile_image.delete()
        return Response({'detail': 'Profile image removed'})


# =====================================================================
# NOTIFICATION VIEWS
# =====================================================================

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for user notifications. 
    - list: All notifications for the authenticated user
    - unread_count: Count of unread notifications
    - mark_read: Mark specific or all notifications as read
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['notification_type', 'is_read']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return Notification.objects.filter(
            user=self.request.user
        ).select_related('entity', 'submission')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(
            user=request.user, is_read=False
        ).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        notification_ids = serializer.validated_data.get('notification_ids', [])
        qs = Notification.objects.filter(user=request.user, is_read=False)
        if notification_ids:
            qs = qs.filter(notification_id__in=notification_ids)

        updated = qs.update(is_read=True)
        return Response({'marked_read': updated})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = Notification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True)
        return Response({'marked_read': updated})


def create_notification(user, notification_type, message, entity=None, submission=None, link=""):
    """Helper function to create a notification."""
    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        message=message,
        entity=entity,
        submission=submission,
        link=link,
    )


# =====================================================================
# REACTION VIEWS
# =====================================================================

class ReactionViewSet(viewsets.ViewSet):
    """
    ViewSet for reactions (upvotes/downvotes) on entities and comments.
    - toggle: Create or switch a reaction (idempotent)
    - summary: Get reaction counts for an entity or comment
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """Toggle a reaction. If the same type exists, remove it. If different, switch it."""
        serializer = ReactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entity_id = serializer.validated_data.get('entity_id')
        comment_id = serializer.validated_data.get('comment_id')
        reaction_type = serializer.validated_data['reaction_type']

        lookup = {'user': request.user}
        if entity_id:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
            lookup['entity'] = entity
            lookup['comment'] = None
        elif comment_id:
            comment = Comments.objects.get(comment_id=comment_id)
            lookup['comment'] = comment
            lookup['entity'] = None

        try:
            existing = Reaction.objects.get(**lookup)
            if existing.reaction_type == reaction_type:
                # Same reaction — remove it (toggle off)
                existing.delete()
                return Response({'action': 'removed', 'reaction_type': None})
            else:
                # Different reaction — switch it
                existing.reaction_type = reaction_type
                existing.save()
                return Response({'action': 'switched', 'reaction_type': reaction_type})
        except Reaction.DoesNotExist:
            # New reaction
            Reaction.objects.create(
                user=request.user,
                entity=lookup.get('entity'),
                comment=lookup.get('comment'),
                reaction_type=reaction_type,
            )

            # Notify entity owner about upvote
            if entity_id and reaction_type == 'upvote':
                entity = CulturalEntity.objects.get(entity_id=entity_id)
                if entity.contributor != request.user:
                    create_notification(
                        user=entity.contributor,
                        notification_type='reaction',
                        message=f'{request.user.username} upvoted your contribution "{entity.name}"',
                        entity=entity,
                        link=f'/dashboard/knowledge/entity/view/{entity_id}',
                    )

            return Response({'action': 'created', 'reaction_type': reaction_type},
                            status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get reaction summary for an entity or comment."""
        entity_id = request.query_params.get('entity_id')
        comment_id = request.query_params.get('comment_id')

        if not entity_id and not comment_id:
            return Response(
                {'error': 'Provide entity_id or comment_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if entity_id:
            qs = Reaction.objects.filter(entity_id=entity_id)
        else:
            qs = Reaction.objects.filter(comment__comment_id=comment_id)

        upvotes = qs.filter(reaction_type='upvote').count()
        downvotes = qs.filter(reaction_type='downvote').count()

        user_reaction = None
        if request.user.is_authenticated:
            r = qs.filter(user=request.user).first()
            if r:
                user_reaction = r.reaction_type

        return Response({
            'upvotes': upvotes,
            'downvotes': downvotes,
            'user_reaction': user_reaction,
        })


# =====================================================================
# FORK VIEWS
# =====================================================================

class ForkViewSet(viewsets.ViewSet):
    """
    Fork a contribution to create a new entity based on an existing one.
    """
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request):
        """Fork an entity. POST body: { entity_id, reason, changes }"""
        entity_id = request.data.get('entity_id')
        if not entity_id:
            return Response({'error': 'entity_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            original = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get the latest revision data
        latest_revision = original.get_latest_revision()
        if not latest_revision:
            return Response({'error': 'No revision to fork'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '')
        changes = request.data.get('changes', {})

        # Merge changes into the revision data
        fork_data = {**latest_revision.data, **changes}

        # Create the new entity
        forked_entity = CulturalEntity.objects.create(
            name=f"{original.name} (fork by {request.user.username})",
            description=original.description,
            category=original.category,
            contributor=request.user,
            status='draft',
        )

        # Create first revision on forked entity
        forked_entity.create_revision(request.user, fork_data)

        # Record the fork relationship
        fork = Fork.objects.create(
            original_entity=original,
            forked_entity=forked_entity,
            forked_by=request.user,
            forked_from_revision=latest_revision,
            reason=reason,
        )

        # Create activity on original
        Activity.objects.create(
            entity=original,
            user=request.user,
            activity_type='commented',
            comment=f'Forked by {request.user.username}: {reason}',
        )

        # Notify original contributor
        if original.contributor != request.user:
            create_notification(
                user=original.contributor,
                notification_type='fork',
                message=f'{request.user.username} forked your contribution "{original.name}"',
                entity=original,
                link=f'/dashboard/knowledge/entity/view/{forked_entity.entity_id}',
            )

        return Response(
            ForkSerializer(fork).data,
            status=status.HTTP_201_CREATED,
        )

    def list(self, request):
        """List forks of a specific entity."""
        entity_id = request.query_params.get('entity_id')
        if not entity_id:
            return Response({'error': 'entity_id query param required'},
                            status=status.HTTP_400_BAD_REQUEST)
        forks = Fork.objects.filter(
            original_entity_id=entity_id
        ).select_related('forked_by', 'original_entity', 'forked_entity')
        return Response(ForkSerializer(forks, many=True).data)


# =====================================================================
# REVISION DIFF VIEWS
# =====================================================================

class RevisionDiffView(APIView):
    """
    Compare two revisions of the same entity.
    GET /api/revisions/<entity_id>/diff/?from=<rev_num>&to=<rev_num>
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, entity_id):
        from_num = request.query_params.get('from')
        to_num = request.query_params.get('to')

        if not from_num or not to_num:
            return Response(
                {'error': 'Both "from" and "to" query params are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            rev_from = Revision.objects.get(entity=entity, revision_number=int(from_num))
            rev_to = Revision.objects.get(entity=entity, revision_number=int(to_num))
        except Revision.DoesNotExist:
            return Response({'error': 'Revision not found'}, status=status.HTTP_404_NOT_FOUND)

        # Compute field-by-field diff
        diff = {}
        all_keys = set(list(rev_from.data.keys()) + list(rev_to.data.keys()))
        for key in sorted(all_keys):
            old_val = rev_from.data.get(key)
            new_val = rev_to.data.get(key)
            if old_val != new_val:
                diff[key] = {
                    'old': old_val,
                    'new': new_val,
                }

        return Response({
            'entity_id': str(entity.entity_id),
            'entity_name': entity.name,
            'revision_from': RevisionSerializer(rev_from).data,
            'revision_to': RevisionSerializer(rev_to).data,
            'diff': diff,
        })


# =====================================================================
# SHARE VIEWS
# =====================================================================

class ShareViewSet(viewsets.ViewSet):
    """Track shares of entities to external platforms."""

    def create(self, request):
        serializer = ShareCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entity_id = serializer.validated_data['entity_id']
        platform = serializer.validated_data['platform']

        try:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        share = Share.objects.create(
            user=request.user if request.user.is_authenticated else None,
            entity=entity,
            platform=platform,
        )

        return Response(ShareSerializer(share).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def count(self, request):
        """Get share count for an entity."""
        entity_id = request.query_params.get('entity_id')
        if not entity_id:
            return Response({'error': 'entity_id required'}, status=status.HTTP_400_BAD_REQUEST)

        total = Share.objects.filter(entity_id=entity_id).count()
        by_platform = {}
        for choice in Share.PLATFORM_CHOICES:
            ct = Share.objects.filter(entity_id=entity_id, platform=choice[0]).count()
            if ct > 0:
                by_platform[choice[0]] = ct

        return Response({'total': total, 'by_platform': by_platform})


# =====================================================================
# ENHANCED COMMENT VIEWS (with threading + reactions)
# =====================================================================

class EntityCommentViewSet(viewsets.ModelViewSet):
    """
    Comments on CulturalEntity with threaded replies and reactions.
    URL pattern: /data/api/entities/<entity_id>/comments/
    """
    serializer_class = CommentWithReactionsSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        entity_id = self.kwargs.get('entity_id')
        # Only top-level comments (no parent) — replies are nested
        return Comments.objects.filter(
            submission_id=entity_id,
            parent__isnull=True,
        ).select_related('user').prefetch_related('replies', 'reactions')

    def perform_create(self, serializer):
        entity_id = self.kwargs.get('entity_id')
        entity = CulturalEntity.objects.get(entity_id=entity_id)
        comment = serializer.save(
            user=self.request.user,
            submission=entity,
        )

        # Create activity
        Activity.objects.create(
            entity=entity,
            user=self.request.user,
            activity_type='commented',
            comment=comment.comment[:200],
        )

        # Notify entity contributor
        if entity.contributor != self.request.user:
            create_notification(
                user=entity.contributor,
                notification_type='comment',
                message=f'{self.request.user.username} commented on "{entity.name}": {comment.comment[:100]}',
                entity=entity,
                link=f'/dashboard/knowledge/entity/view/{entity_id}',
            )

        # If it's a reply, notify the parent comment's author
        if comment.parent and comment.parent.user != self.request.user:
            create_notification(
                user=comment.parent.user,
                notification_type='comment',
                message=f'{self.request.user.username} replied to your comment on "{entity.name}"',
                entity=entity,
                link=f'/dashboard/knowledge/entity/view/{entity_id}',
            )


# =====================================================================
# PUBLIC CONTRIBUTION VIEWS (QR Scan Contributions)
# =====================================================================

class PublicContributionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for public contributions submitted via QR code scans.
    
    - POST /data/public-contributions/ — Anyone can create (no auth required)
    - GET /data/public-contributions/ — Authenticated reviewers can list
    - GET /data/public-contributions/<id>/ — Reviewers can view details
    - POST /data/public-contributions/<id>/review/ — Reviewers can approve/reject
    """
    queryset = PublicContribution.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'contribution_type', 'submitted_via']
    search_fields = ['entity_name', 'content', 'contributor_name']
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PublicContributionCreateSerializer
        elif self.action == 'review':
            return PublicContributionReviewSerializer
        return PublicContributionListSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            # Anyone can submit a public contribution (QR scan)
            return [AllowAny()]
        elif self.action in ['list', 'retrieve']:
            # Authenticated users can view
            return [IsAuthenticated()]
        else:
            # Review actions require staff or reviewer
            return [IsAuthenticated(), IsReviewerOrAdmin()]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status if provided
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create a public contribution (no authentication required)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        return Response(
            {
                'message': 'Thank you for your contribution!',
                'id': str(serializer.instance.id),
            },
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """
        Review (approve/reject/incorporate) a public contribution.
        """
        contribution = self.get_object()
        
        if contribution.status not in ['pending']:
            return Response(
                {'error': 'This contribution has already been reviewed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = PublicContributionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_status = serializer.validated_data['status']
        review_notes = serializer.validated_data.get('review_notes', '')
        link_to_entity_id = serializer.validated_data.get('link_to_entity_id')
        
        # Update contribution status
        contribution.status = new_status
        contribution.reviewed_by = request.user
        contribution.reviewed_at = timezone.now()
        contribution.review_notes = review_notes
        
        # Optionally link to an entity
        if link_to_entity_id and not contribution.entity:
            try:
                entity = CulturalEntity.objects.get(entity_id=link_to_entity_id)
                contribution.entity = entity
            except CulturalEntity.DoesNotExist:
                pass
        
        contribution.save()
        
        return Response({
            'message': f'Contribution has been {new_status}.',
            'id': str(contribution.id),
            'status': new_status,
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get statistics about public contributions."""
        total = PublicContribution.objects.count()
        pending = PublicContribution.objects.filter(status='pending').count()
        approved = PublicContribution.objects.filter(status='approved').count()
        rejected = PublicContribution.objects.filter(status='rejected').count()
        incorporated = PublicContribution.objects.filter(status='incorporated').count()
        
        by_type = PublicContribution.objects.values('contribution_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        by_source = PublicContribution.objects.values('submitted_via').annotate(
            count=Count('id')
        ).order_by('-count')
        
        return Response({
            'total': total,
            'pending': pending,
            'approved': approved,
            'rejected': rejected,
            'incorporated': incorporated,
            'by_type': list(by_type),
            'by_source': list(by_source),
        })
