import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from drf_yasg import openapi

from django.db.models import Q
from rest_framework import mixins, parsers, viewsets, status, permissions
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import (
    CulturalEntity,
    Revision,
    Activity,
    ReviewDecision,
    ReviewFlag,
    ReviewerRole,
    ReviewerApplication,
    SchemaExtensionAuditEvent,
    SchemaExtensionProposal,
    EntityProposal,
    RelationshipProposal,
)
from .models import Organization, OrganizationMembership
from .models import Notification, Reaction, Fork, Share
from .models import PublicContribution
from .serializers import *
from .permissions import (
    IsContributorOrReadOnly,
    IsEditor,
    IsReviewerOrAdmin,
    IsCommunityReviewer,
    IsDomainExpert,
    IsExpertCurator,
    IsStaffOrExpertCurator,
    IsSchemaExtensionModerator,
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

User = get_user_model()

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


# ---------------------------------------------------------------------
# Legacy workflow: ViewSets (preferred routing via DefaultRouter)
# ---------------------------------------------------------------------


class SubmissionViewSet(viewsets.ModelViewSet):
    """
    Legacy `Submission` CRUD.

    Exposes:
      - /data/submissions/
      - /data/api/submissions/ (alias maintained in urls.py)
    """

    queryset = Submission.objects.all().order_by("-created_at")
    serializer_class = SubmissionSerializer

    def get_permissions(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "form_submit",
        ):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    @action(detail=False, methods=["post"], url_path="form-submit")
    def form_submit(self, request):
        # Reuse the existing implementation to avoid behavior drift.
        return FormSubmissionAPIView().post(request)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Legacy activity log feed.

    Exposes:
      - /data/activity-logs/
      - /data/api/activity-logs/ (alias maintained in urls.py)
    """

    queryset = ActivityLog.objects.all().order_by("-timestamp")
    serializer_class = ActivityLogSerializer
    permission_classes = [AllowAny]


class CommentViewSet(viewsets.ModelViewSet):
    """
    Legacy flat comments API (submission/entity scoped).

    List supports ?submission_id=<id> (kept for backwards compatibility).
    """

    queryset = Comments.objects.all().order_by("-created_at")
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        submission_id = self.request.query_params.get("submission_id")
        if submission_id:
            return Comments.objects.filter(entity_id=submission_id).order_by(
                "-created_at"
            )
        return super().get_queryset()

    def perform_create(self, serializer):
        submission_id = self.request.data.get("submission_id")
        if not submission_id:
            raise ValidationError({"submission_id": "This field is required."})

        try:
            submission = Submission.objects.get(id=submission_id)
        except Submission.DoesNotExist:
            raise ValidationError({"submission_id": "Invalid submission ID."})

        serializer.save(user=self.request.user, submission=submission)


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
    Public leaderboard with server-side pagination, search, and filtering.

    Scoring:
      - Each accepted CulturalEntity    = 10 pts
      - Each submitted CulturalEntity    =  3 pts
      - Each review decision             =  5 pts
      - Each revision created            =  2 pts
      - Each accepted legacy Submission  = 10 pts
      - Each legacy Submission           =  3 pts

    Query params:
      - search: filter by username or full name
      - institution: filter by institution name
      - page: page number (default 1)
      - page_size: items per page (default 20, max 100)

    Ranks are always global (assigned before any filtering).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        search = request.query_params.get("search", "").strip().lower()
        institution = request.query_params.get("institution", "").strip()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except (TypeError, ValueError):
            page_size = 20

        qs = (
            User.objects.select_related("profile")
            .annotate(
                entity_count=Count("contributed_entities", distinct=True),
                accepted_entities=Count(
                    "contributed_entities",
                    filter=Q(contributed_entities__status="accepted"),
                    distinct=True,
                ),
                review_count=Count("review_decisions", distinct=True),
                revision_count=Count("created_revisions", distinct=True),
                submission_count=Count("submissions", distinct=True),
                accepted_submissions=Count(
                    "submissions",
                    filter=Q(submissions__status="accepted"),
                    distinct=True,
                ),
            )
            .filter(
                Q(entity_count__gt=0)
                | Q(review_count__gt=0)
                | Q(revision_count__gt=0)
                | Q(submission_count__gt=0)
            )
        )

        users = list(qs.order_by("username"))

        entries = []
        all_institutions = set()
        total_score = 0
        total_entities = 0
        total_reviews = 0

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
            inst = getattr(profile, "organization", "") or ""
            if inst:
                all_institutions.add(inst)
            total_score += score
            total_entities += user.entity_count
            total_reviews += user.review_count
            entries.append(
                {
                    "user_id": user.id,
                    "username": user.username,
                    "full_name": (
                        f"{profile.first_name} {profile.last_name}".strip()
                        if profile
                        else ""
                    ),
                    "institution": inst,
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

        entries.sort(
            key=lambda e: (-e["score"], -e["accepted_entities"], e["username"])
        )

        rank = 1
        for idx, entry in enumerate(entries):
            if idx > 0 and entries[idx - 1]["score"] != entry["score"]:
                rank = idx + 1
            entry["rank"] = rank

        stats = {
            "total_contributors": len(entries),
            "total_score": total_score,
            "total_entities": total_entities,
            "total_reviews": total_reviews,
        }

        if search:
            entries = [
                e
                for e in entries
                if search in e["username"].lower() or search in e["full_name"].lower()
            ]
        if institution:
            entries = [e for e in entries if e["institution"] == institution]

        total = len(entries)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, total_pages)
        start = (page - 1) * page_size
        paginated = entries[start : start + page_size]

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "institutions": sorted(all_institutions),
                "stats": stats,
                "results": paginated,
            }
        )


class ContributorsListView(APIView):
    """
    List platform contributors with contribution, fork, and review stats.
    GET /data/api/contributors/?search=&page=&page_size=
    """

    permission_classes = [AllowAny]

    def get(self, request):
        search = request.query_params.get("search", "").strip().lower()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except (TypeError, ValueError):
            page_size = 20

        qs = (
            User.objects.select_related("profile")
            .annotate(
                contributions_count=Count("contributed_entities", distinct=True),
                accepted_count=Count(
                    "contributed_entities",
                    filter=Q(contributed_entities__status="accepted"),
                    distinct=True,
                ),
                forks_count=Count("forked_entities", distinct=True),
                merged_forks_count=Count(
                    "forked_entities",
                    filter=Q(forked_entities__fork_status__in=["merged", "promoted"]),
                    distinct=True,
                ),
                reviews_count=Count("review_decisions", distinct=True),
                revisions_count=Count("created_revisions", distinct=True),
            )
            .filter(
                Q(contributions_count__gt=0)
                | Q(forks_count__gt=0)
                | Q(reviews_count__gt=0)
                | Q(revisions_count__gt=0)
            )
        )

        users = list(qs.order_by("username"))
        entries = []
        for user in users:
            profile = getattr(user, "profile", None)
            score = (
                user.accepted_count * 10
                + (user.contributions_count - user.accepted_count) * 3
                + user.reviews_count * 5
                + user.revisions_count * 2
                + user.merged_forks_count * 20
            )
            entries.append(
                {
                    "user_id": user.id,
                    "username": user.username,
                    "full_name": (
                        f"{profile.first_name} {profile.last_name}".strip()
                        if profile
                        else ""
                    ),
                    "profile_image": (
                        profile.profile_image.url
                        if profile and profile.profile_image
                        else ""
                    ),
                    "avatar_url": getattr(profile, "avatar_url", "") or "",
                    "contributions_count": user.contributions_count,
                    "accepted_count": user.accepted_count,
                    "forks_count": user.forks_count,
                    "merged_forks_count": user.merged_forks_count,
                    "reviews_count": user.reviews_count,
                    "revisions_count": user.revisions_count,
                    "score": score,
                    "date_joined": user.date_joined.isoformat(),
                }
            )

        entries.sort(key=lambda e: (-e["score"], e["username"]))

        rank = 1
        for idx, entry in enumerate(entries):
            if idx > 0 and entries[idx - 1]["score"] != entry["score"]:
                rank = idx + 1
            entry["rank"] = rank

        if search:
            entries = [
                e
                for e in entries
                if search in e["username"].lower() or search in e["full_name"].lower()
            ]

        total = len(entries)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, total_pages)
        start = (page - 1) * page_size
        paginated = entries[start : start + page_size]

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": paginated,
            }
        )


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
    Return the currently authenticated user's info including platform roles.

    This endpoint requires a valid JWT token in the Authorization header.
    Returns username, email, Django groups, staff status, and reviewer role.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = list(user.groups.values_list("name", flat=True))

        reviewer_role_data = None
        if hasattr(user, "reviewer_role"):
            rr = user.reviewer_role
            reviewer_role_data = {
                "role": rr.role,
                "is_active": rr.is_active,
                "can_override_confidence": rr.can_override_confidence,
                "can_resolve_conflicts": rr.can_resolve_conflicts,
                "can_manage_roles": rr.can_manage_roles,
            }

        application_data = None
        latest_app = (
            ReviewerApplication.objects.filter(user=user)
            .order_by("-created_at")
            .only("id", "status", "created_at", "message")
            .first()
        )
        if latest_app:
            application_data = {
                "id": str(latest_app.id),
                "status": latest_app.status,
                "message": (latest_app.message or "")[:500],
                "created_at": latest_app.created_at.isoformat(),
            }

        return Response(
            {
                "username": user.username,
                "email": user.email,
                "groups": groups,
                "is_staff": user.is_staff,
                "reviewer_role": reviewer_role_data,
                "reviewer_application": application_data,
            }
        )


class PlatformAdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List/detail of Django users for the in-app platform admin UI.
    Staff or expert curators (read-only).
    """

    permission_classes = [IsAuthenticated, IsStaffOrExpertCurator]
    serializer_class = PlatformAdminUserSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["email", "username", "first_name", "last_name"]
    ordering_fields = ["date_joined", "email", "username"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        return (
            User.objects.all()
            .select_related("reviewer_role")
            .prefetch_related("groups")
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
        """List comments for a single entity (submission_id) or a user (username / user_id)."""
        params = self.request.query_params
        submission_id = (params.get("submission_id") or "").strip()
        username = (params.get("username") or "").strip()
        user_id = (params.get("user_id") or "").strip()

        base = Comments.objects.select_related("user", "submission").order_by(
            "-created_at"
        )

        if submission_id:
            return base.filter(submission_id=submission_id)
        if user_id:
            return base.filter(user_id=user_id)
        if username:
            return base.filter(user__username__iexact=username)
        return Comments.objects.none()

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
    GET: Public endpoint to fetch a user's profile by slug (UUID).
    POST: Protected endpoint to update user's own profile.
    """

    permission_classes = [AllowAny]  # default, overridden per method

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, *args, **kwargs):
        slug = kwargs.get("slug")
        if not slug:
            return Response(
                {"error": "slug is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            profile = UserProfile.objects.select_related("user").get(slug=slug)
        except UserProfile.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        data = request.data
        slug = kwargs.get("slug")

        if not slug:
            return Response(
                {"error": "slug is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            profile = UserProfile.objects.select_related("user").get(slug=slug)
        except UserProfile.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Only allow the authenticated user to update their own profile
        if request.user != profile.user:
            return Response(
                {"error": "You do not have permission to update this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Update fields with serializer
        serializer = UserProfileSerializer(profile, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileMeView(APIView):
    """
    GET: Returns the authenticated user's own profile (including slug).
    Used by the frontend to get the current user's slug for navigation
    and isOwn detection.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserProfileByUsernameView(APIView):
    """
    GET: Public endpoint to fetch a user's profile by username string.
    Used by heritage tables and contributor links that only know the username.
    """

    permission_classes = [AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CulturalEntityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Cultural Entities
    """

    queryset = CulturalEntity.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["category", "status", "contributor"]
    search_fields = ["name", "description"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return CulturalEntityCreateSerializer
        elif self.action == "update" or self.action == "partial_update":
            return CulturalEntityUpdateSerializer
        elif self.action == "list":
            return CulturalEntityListSerializer
        return CulturalEntityDetailSerializer

    def get_permissions(self):
        if self.action in ["create", "my_contributions", "create_revision"]:
            permission_classes = [permissions.IsAuthenticated]
        elif self.action in ["update", "partial_update", "destroy"]:
            permission_classes = [permissions.IsAuthenticated, IsContributorOrReadOnly]
        elif self.action in ["lineage", "child_forks", "fork_diff"]:
            permission_classes = [permissions.IsAuthenticatedOrReadOnly]
        else:
            permission_classes = [permissions.IsAuthenticatedOrReadOnly]
        return [permission() for permission in permission_classes]

    def filter_queryset(self, queryset):
        """When filtering by contributor, hide non-accepted work except for the owner (or staff)."""
        qs = super().filter_queryset(queryset)
        if self.action != "list":
            return qs
        contributor_param = self.request.query_params.get("contributor")
        if not contributor_param:
            return qs
        from uuid import UUID

        try:
            cid = UUID(str(contributor_param))
        except (ValueError, TypeError):
            return qs
        is_owner = self.request.user.is_authenticated and self.request.user.id == cid
        if not is_owner and not self.request.user.is_staff:
            return qs.filter(status="accepted")
        return qs

    def get_queryset(self):
        queryset = CulturalEntity.objects.all()

        # For list action, only show accepted entities to non-staff users
        if self.action == "list" and not self.request.user.is_staff:
            queryset = queryset.filter()

        # Prefetch related data for performance
        if self.action == "list":
            from django.db.models import Prefetch

            queryset = queryset.select_related(
                "contributor", "current_revision"
            ).prefetch_related(
                Prefetch(
                    "revisions",
                    queryset=Revision.objects.order_by("-revision_number"),
                    to_attr="prefetched_revisions_newest_first",
                ),
                "activities",
            )
        elif self.action == "retrieve":
            queryset = queryset.select_related(
                "contributor", "current_revision"
            ).prefetch_related("revisions", "activities")

        return queryset

    def perform_create(self, serializer):
        entity = serializer.save(contributor=self.request.user)
        create_notification(
            user=self.request.user,
            actor=self.request.user,
            notification_type="submission_update",
            message=f'Your contribution "{entity.name}" has been created and is in draft status.',
            entity=entity,
            link=f"/knowledge/entity/view/{entity.entity_id}",
        )
        reviewer_users = User.objects.filter(reviewer_role__is_active=True).exclude(
            id=self.request.user.id
        )
        for reviewer in reviewer_users:
            create_notification(
                user=reviewer,
                actor=self.request.user,
                notification_type="submission_update",
                message=f'New contribution "{entity.name}" submitted by {self.request.user.username} — awaiting review.',
                entity=entity,
                link=f"/curation/review/{entity.entity_id}",
            )

    @action(
        detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated]
    )
    def my_contributions(self, request):
        """
        Get contributions by the current user
        """
        from django.db.models import Prefetch

        contributions = (
            CulturalEntity.objects.filter(contributor=request.user)
            .select_related("contributor", "current_revision")
            .prefetch_related(
                Prefetch(
                    "revisions",
                    queryset=Revision.objects.order_by("-revision_number"),
                    to_attr="prefetched_revisions_newest_first",
                ),
            )
        )
        page = self.paginate_queryset(contributions)
        if page is not None:
            serializer = CulturalEntityListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = CulturalEntityListSerializer(contributions, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated, IsContributorOrReadOnly],
    )
    def create_revision(self, request, pk=None):
        """
        Create a new revision for an existing entity
        """
        entity = self.get_object()

        # Only allow revisions for rejected or draft entities
        if entity.status not in ["rejected", "draft"]:
            return Response(
                {"error": "Can only create revisions for rejected or draft entities"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RevisionCreateSerializer(
            data=request.data, context={"entity": entity, "request": request}
        )

        if serializer.is_valid():
            revision = serializer.save()
            return Response(
                RevisionSerializer(revision).data, status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated]
    )
    def submit_for_review(self, request, pk=None):
        """
        Submit a draft entity for review
        """
        entity = self.get_object()

        if entity.status != "draft":
            return Response(
                {"error": "Only draft entities can be submitted for review"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if entity.contributor != request.user:
            return Response(
                {"error": "Only the contributor can submit for review"},
                status=status.HTTP_403_FORBIDDEN,
            )

        entity.submit_for_review()
        return Response(
            {"message": "Entity submitted for review successfully"},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="lineage")
    def lineage(self, request, pk=None):
        """Return the full fork tree rooted at this entity's root."""
        entity = self.get_object()
        root = entity.root_entity if entity.root_entity_id else entity
        serializer = ForkLineageNodeSerializer(root)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="child-forks")
    def child_forks(self, request, pk=None):
        """Return direct child forks of this entity."""
        entity = self.get_object()
        children = CulturalEntity.objects.filter(parent_entity=entity).select_related(
            "contributor"
        )
        forks = Fork.objects.filter(original_entity=entity).select_related(
            "forked_by", "original_entity", "forked_entity"
        )
        return Response(
            {
                "entity_id": str(entity.entity_id),
                "entity_name": entity.name,
                "forks": ForkSerializer(forks, many=True).data,
            }
        )

    @action(
        detail=True, methods=["get"], url_path="fork-diff/(?P<fork_entity_id>[^/.]+)"
    )
    def fork_diff(self, request, pk=None, fork_entity_id=None):
        """Cross-entity diff: compare current revision of this entity vs a fork."""
        entity = self.get_object()
        try:
            fork_entity = CulturalEntity.objects.get(entity_id=fork_entity_id)
        except CulturalEntity.DoesNotExist:
            return Response(
                {"error": "Fork entity not found"}, status=status.HTTP_404_NOT_FOUND
            )

        entity_rev = entity.revisions.order_by("-revision_number").first()
        fork_rev = fork_entity.revisions.order_by("-revision_number").first()

        if not entity_rev or not fork_rev:
            return Response(
                {"error": "One or both entities have no revisions"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entity_data = entity_rev.data if isinstance(entity_rev.data, dict) else {}
        fork_data = fork_rev.data if isinstance(fork_rev.data, dict) else {}

        diff = {}
        all_keys = set(entity_data.keys()) | set(fork_data.keys())
        for key in sorted(all_keys):
            old_val = entity_data.get(key)
            new_val = fork_data.get(key)
            if old_val != new_val:
                diff[key] = {"old": old_val, "new": new_val}

        return Response(
            {
                "entity_id": str(entity.entity_id),
                "entity_name": entity.name,
                "fork_entity_id": str(fork_entity.entity_id),
                "fork_entity_name": fork_entity.name,
                "entity_revision": RevisionSerializer(entity_rev).data,
                "fork_revision": RevisionSerializer(fork_rev).data,
                "diff": diff,
            }
        )


class ContributionQueueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing and moderating contributions.
    - GET requests (list/retrieve) are public.
    - POST /moderate requires authentication + editor permissions.
    """

    serializer_class = ContributionQueueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["category", "status"]
    search_fields = ["name", "description"]

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
            CulturalEntity.objects.filter(
                status__in=["pending_review", "pending_revision"]
            )
            .select_related("contributor")
            .prefetch_related("activities")
        )

    @action(detail=True, methods=["post"])
    def moderate(self, request, pk=None):
        """
        Moderate a contribution (accept or reject).
        Only for authenticated editors.
        """
        entity = self.get_object()
        serializer = ModerationActionSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data["action"]
        comment = serializer.validated_data.get("comment", "")

        if action == "accept":
            entity.accept_contribution(request.user, comment)
            return Response(
                {"message": "Entity accepted successfully"}, status=status.HTTP_200_OK
            )

        elif action == "reject":
            entity.reject_contribution(request.user, comment)
            return Response(
                {"message": "Entity rejected successfully"}, status=status.HTTP_200_OK
            )

        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


class RevisionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing revisions
    """

    serializer_class = RevisionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Revision.objects.select_related("created_by", "entity")
        entity_id = (self.request.query_params.get("entity") or "").strip()
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    @action(detail=True, methods=["get"])
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
    filterset_fields = ["activity_type", "entity"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        username = (self.request.query_params.get("username") or "").strip()

        # If anonymous user → return all (or optionally none)
        if not user or user.is_anonymous:
            qs = Activity.objects.all()
            if username:
                qs = qs.filter(user__username=username)
            return qs.select_related("user", "entity")

        # Staff/admin → return all
        if user.is_staff:
            qs = Activity.objects.all()
            if username:
                qs = qs.filter(user__username=username)
            return qs.select_related("user", "entity")

        # Authenticated non-staff: profile and similar clients pass ?username= to
        # show a specific user’s public activity; do not intersect with “my
        # entities” in that case (otherwise viewing another user while logged
        # in would hide most of their rows).
        if username:
            return Activity.objects.filter(user__username=username).select_related(
                "user", "entity"
            )
        qs = Activity.objects.filter(Q(user=user) | Q(entity__contributor=user))
        return qs.select_related("user", "entity")


class UserReviewDecisionsListView(generics.ListAPIView):
    """
    Public list of a reviewer's decisions (for user profile).
    GET /data/api/review-decisions-profile/?reviewer=<user_uuid>
    """

    permission_classes = [AllowAny]
    serializer_class = ReviewDecisionProfileSerializer

    def get_queryset(self):
        reviewer = (self.request.query_params.get("reviewer") or "").strip()
        if not reviewer:
            return ReviewDecision.objects.none()
        return (
            ReviewDecision.objects.filter(reviewer_id=reviewer)
            .select_related("entity")
            .order_by("-created_at")
        )


# =====================================================================
# REVIEWER / CURATION VIEWS
# =====================================================================


class ReviewQueueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Triaged review queue with tabs: new_claims, conflicts, flagged, expiring.
    Replaces the flat ContributionQueue with epistemic review categories.

    Ordering: default triage_priority (desc). Also supports created_at / updated_at.
    Query precedence: status base → queue_type tab → stale_days / contradictions_only /
    min_worst_source_rank / my_domain → search (see spec FR-016).
    Pagination: ``page`` + ``limit`` (limit default 10, max 100).
    """

    serializer_class = ContributionQueueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["category", "status"]
    search_fields = ["name", "description"]
    pagination_class = None

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), IsCommunityReviewer()]
        return [permissions.IsAuthenticated(), IsCommunityReviewer()]

    def get_queryset(self):
        queryset = (
            CulturalEntity.objects.filter(
                status__in=["pending_review", "pending_revision"]
            )
            .select_related("contributor", "current_revision")
            .prefetch_related(
                "activities", "review_flags", "review_decisions", "revisions"
            )
        )

        # Filter by queue tab type
        queue_type = self.request.query_params.get("queue_type", "all")

        if queue_type == "new_claims":
            queryset = queryset.filter(
                status="pending_review", review_decisions__isnull=True
            )
        elif queue_type == "conflicts":
            queryset = queryset.filter(
                review_flags__flag_type="contradiction", review_flags__is_resolved=False
            ).distinct()
        elif queue_type == "flagged":
            queryset = (
                queryset.filter(review_flags__is_resolved=False)
                .exclude(review_flags__flag_type="contradiction")
                .distinct()
            )
        elif queue_type == "expiring":
            from datetime import timedelta

            cutoff = timezone.now() - timedelta(days=14)
            queryset = queryset.filter(status="pending_review", created_at__lt=cutoff)

        stale_raw = (self.request.query_params.get("stale_days") or "").strip()
        if stale_raw.isdigit() and int(stale_raw) > 0:
            from datetime import timedelta

            days = int(stale_raw)
            cutoff = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(status="pending_review", created_at__lte=cutoff)

        if (
            self.request.query_params.get("contradictions_only") or ""
        ).lower() == "true":
            queryset = queryset.filter(
                review_flags__flag_type="contradiction",
                review_flags__is_resolved=False,
            ).distinct()

        if hasattr(self.request.user, "reviewer_role"):
            expertise = self.request.query_params.get("my_domain", None)
            if expertise == "true":
                areas = self.request.user.reviewer_role.expertise_areas
                if areas:
                    queryset = queryset.filter(category__in=areas)

        return queryset

    def list(self, request, *args, **kwargs):
        from apps.heritage_data.services.triage_scoring import (
            get_active_triage_policy_dict,
            sort_key_for_entity,
        )
        from apps.heritage_data.services.triage_sources import (
            worst_source_type_for_entity,
        )

        queryset = self.filter_queryset(self.get_queryset())
        policy = get_active_triage_policy_dict()

        min_worst = (request.query_params.get("min_worst_source_rank") or "").strip()
        min_worst_i: int | None = int(min_worst) if min_worst.isdigit() else None
        max_trust = (request.query_params.get("max_trust_tier_rank") or "").strip()
        max_trust_i: int | None = int(max_trust) if max_trust.isdigit() else None

        rows = list(queryset)
        worst_map: dict[str, str | None] = {}
        for e in rows:
            worst_map[str(e.entity_id)] = worst_source_type_for_entity(e)

        if min_worst_i is not None:
            from apps.heritage_data.services.triage_scoring import (
                compute_triage_components,
            )

            keep: list = []
            for e in rows:
                c = compute_triage_components(
                    e, worst_source_type=worst_map[str(e.entity_id)], policy=policy
                )
                if c.source_rank >= min_worst_i:
                    keep.append(e)
            rows = keep

        if max_trust_i is not None:
            from apps.heritage_data.services.triage_scoring import (
                compute_triage_components,
            )

            keep = []
            for e in rows:
                c = compute_triage_components(
                    e, worst_source_type=worst_map[str(e.entity_id)], policy=policy
                )
                if c.source_rank <= max_trust_i:
                    keep.append(e)
            rows = keep

        ordering = (request.query_params.get("ordering") or "-triage_priority").strip()
        if "triage_priority" in ordering.replace("-", ""):
            reverse = not ordering.startswith("-")
            rows.sort(
                key=lambda ent: sort_key_for_entity(
                    ent, worst_source_type=worst_map[str(ent.entity_id)], policy=policy
                ),
                reverse=reverse,
            )
        elif ordering.lstrip("-") == "created_at":
            reverse = ordering.startswith("-")
            rows.sort(key=lambda ent: ent.created_at.timestamp(), reverse=reverse)
        elif ordering.lstrip("-") == "updated_at":
            reverse = ordering.startswith("-")
            rows.sort(key=lambda ent: ent.updated_at.timestamp(), reverse=reverse)
        else:
            rows.sort(
                key=lambda ent: sort_key_for_entity(
                    ent, worst_source_type=worst_map[str(ent.entity_id)], policy=policy
                ),
                reverse=True,
            )

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        try:
            limit = min(100, max(1, int(request.query_params.get("limit", 10))))
        except ValueError:
            limit = 10
        total = len(rows)
        start = (page - 1) * limit
        chunk = rows[start : start + limit]

        ser = self.get_serializer(
            chunk,
            many=True,
            context={
                **self.get_serializer_context(),
                "triage_worst_sources": worst_map,
            },
        )
        next_page = page + 1 if start + limit < total else None
        prev_page = page - 1 if page > 1 else None
        base = request.build_absolute_uri(request.path)
        q = request.query_params.copy()

        def _url(p: int) -> str:
            q["page"] = str(p)
            return f"{base}?{q.urlencode()}"

        return Response(
            {
                "count": total,
                "next": _url(next_page) if next_page else None,
                "previous": _url(prev_page) if prev_page else None,
                "results": ser.data,
            }
        )

    @action(detail=False, methods=["get"], url_path="triage-policy")
    def triage_policy(self, request):
        from apps.heritage_data.services.triage_scoring import (
            get_active_triage_policy_dict,
        )

        policy = get_active_triage_policy_dict()
        return Response(policy)

    @action(detail=False, methods=["get"])
    def queue_counts(self, request):
        """Return counts for each queue tab."""
        base = CulturalEntity.objects.filter(
            status__in=["pending_review", "pending_revision"]
        )
        from django.utils import timezone
        from datetime import timedelta

        cutoff = timezone.now() - timedelta(days=14)

        new_claims = base.filter(
            status="pending_review", review_decisions__isnull=True
        ).count()

        conflicts = (
            base.filter(
                review_flags__flag_type="contradiction", review_flags__is_resolved=False
            )
            .distinct()
            .count()
        )

        flagged = (
            base.filter(review_flags__is_resolved=False)
            .exclude(review_flags__flag_type="contradiction")
            .distinct()
            .count()
        )

        expiring = base.filter(status="pending_review", created_at__lt=cutoff).count()

        return Response(
            {
                "new_claims": new_claims,
                "conflicts": conflicts,
                "flagged": flagged,
                "expiring": expiring,
                "total": base.count(),
            }
        )


class SchemaExtensionProposalViewSet(viewsets.ModelViewSet):
    """
    Moderator-gated schema extension proposals (006).
    """

    queryset = SchemaExtensionProposal.objects.all().select_related("author")
    http_method_names = ["get", "post", "patch", "head", "options"]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "create":
            return SchemaExtensionProposalCreateSerializer
        if self.action in ("partial_update", "update"):
            return SchemaExtensionProposalPatchSerializer
        return SchemaExtensionProposalSerializer

    def get_permissions(self):
        if self.action in ("approve", "reject", "publish"):
            return [permissions.IsAuthenticated(), IsSchemaExtensionModerator()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset().order_by("-created_at")
        user = self.request.user
        if user.is_staff or user.groups.filter(name="Moderators").exists():
            return qs
        return qs.filter(author=user)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        proposal = serializer.instance
        if (
            proposal.author_id != self.request.user.id
            and not self.request.user.is_staff
        ):
            raise PermissionDenied()
        if proposal.status != SchemaExtensionProposal.STATUS_DRAFT:
            raise ValidationError("Only draft proposals can be edited.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        proposal = self.get_object()
        if proposal.author_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status != SchemaExtensionProposal.STATUS_DRAFT:
            return Response(
                {"detail": "Not a draft"}, status=status.HTTP_400_BAD_REQUEST
            )
        from apps.cidoc_data.linkml_loader import build_fresh_payload
        from apps.heritage_data.services.schema_proposal_publish import (
            append_audit,
            overlapping_active_proposals,
        )
        from apps.heritage_data.services.schema_proposal_keys import (
            extract_conflict_keys,
        )

        keys = extract_conflict_keys(proposal.proposed_yaml)
        if overlapping_active_proposals(keys=keys, exclude_pk=proposal.pk):
            return Response(
                {"detail": "Overlaps another submitted or approved proposal."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            payload = build_fresh_payload()
            base_ver = payload.get("schema_version") or ""
        except Exception:
            base_ver = ""
        proposal.status = SchemaExtensionProposal.STATUS_SUBMITTED
        proposal.submitted_at = timezone.now()
        proposal.base_schema_version = base_ver
        proposal.conflict_keys = keys
        proposal.save(
            update_fields=[
                "status",
                "submitted_at",
                "base_schema_version",
                "conflict_keys",
                "updated_at",
            ]
        )
        append_audit(
            proposal,
            actor=request.user,
            action="submitted",
            from_status=SchemaExtensionProposal.STATUS_DRAFT,
            to_status=SchemaExtensionProposal.STATUS_SUBMITTED,
        )
        return Response(SchemaExtensionProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        proposal = self.get_object()
        if proposal.author_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status not in (
            SchemaExtensionProposal.STATUS_DRAFT,
            SchemaExtensionProposal.STATUS_SUBMITTED,
        ):
            return Response(
                {"detail": "Cannot withdraw"}, status=status.HTTP_400_BAD_REQUEST
            )
        old = proposal.status
        proposal.status = SchemaExtensionProposal.STATUS_WITHDRAWN
        proposal.resolved_at = timezone.now()
        proposal.save(update_fields=["status", "resolved_at", "updated_at"])
        from apps.heritage_data.services.schema_proposal_publish import append_audit

        append_audit(
            proposal,
            actor=request.user,
            action="withdrawn",
            from_status=old,
            to_status=SchemaExtensionProposal.STATUS_WITHDRAWN,
        )
        return Response(SchemaExtensionProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != SchemaExtensionProposal.STATUS_SUBMITTED:
            return Response(
                {"detail": "Not submitted"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = (request.data.get("comment") or "").strip()
        proposal.status = SchemaExtensionProposal.STATUS_APPROVED
        proposal.moderator_comment = comment
        proposal.save(update_fields=["status", "moderator_comment", "updated_at"])
        from apps.heritage_data.services.schema_proposal_publish import append_audit

        append_audit(
            proposal,
            actor=request.user,
            action="approved",
            from_status=SchemaExtensionProposal.STATUS_SUBMITTED,
            to_status=SchemaExtensionProposal.STATUS_APPROVED,
            comment=comment,
        )
        return Response(SchemaExtensionProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != SchemaExtensionProposal.STATUS_SUBMITTED:
            return Response(
                {"detail": "Not submitted"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = (request.data.get("comment") or "").strip()
        if not comment:
            return Response(
                {"detail": "comment required"}, status=status.HTTP_400_BAD_REQUEST
            )
        proposal.status = SchemaExtensionProposal.STATUS_REJECTED
        proposal.moderator_comment = comment
        proposal.resolved_at = timezone.now()
        proposal.save(
            update_fields=["status", "moderator_comment", "resolved_at", "updated_at"]
        )
        from apps.heritage_data.services.schema_proposal_publish import append_audit

        append_audit(
            proposal,
            actor=request.user,
            action="rejected",
            from_status=SchemaExtensionProposal.STATUS_SUBMITTED,
            to_status=SchemaExtensionProposal.STATUS_REJECTED,
            comment=comment,
        )
        return Response(SchemaExtensionProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != SchemaExtensionProposal.STATUS_APPROVED:
            return Response(
                {"detail": "Not approved"}, status=status.HTTP_400_BAD_REQUEST
            )
        from apps.heritage_data.services.schema_proposal_publish import publish_proposal

        try:
            info = publish_proposal(proposal, request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({**SchemaExtensionProposalSerializer(proposal).data, **info})

    @action(detail=True, methods=["get"], url_path="audit")
    def audit(self, request, pk=None):
        proposal = self.get_object()
        rows = proposal.audit_events.all()
        return Response(SchemaExtensionAuditEventSerializer(rows, many=True).data)


class EntityProposalViewSet(viewsets.ModelViewSet):
    """Contributor entity proposals; moderator approval materializes EntityCluster (007)."""

    queryset = EntityProposal.objects.select_related(
        "author",
        "existing_cluster",
        "materialized_cluster",
    ).all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "create":
            return EntityProposalCreateSerializer
        if self.action in ("partial_update", "update"):
            return EntityProposalPatchSerializer
        return EntityProposalSerializer

    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [permissions.IsAuthenticated(), IsSchemaExtensionModerator()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset().order_by("-created_at")
        user = self.request.user
        if user.is_staff or user.groups.filter(name="Moderators").exists():
            return qs
        return qs.filter(author=user)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        proposal = serializer.instance
        if (
            proposal.author_id != self.request.user.id
            and not self.request.user.is_staff
        ):
            raise PermissionDenied()
        if proposal.status != EntityProposal.STATUS_DRAFT:
            raise ValidationError("Only draft proposals can be edited.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        proposal = self.get_object()
        if proposal.author_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status != EntityProposal.STATUS_DRAFT:
            return Response(
                {"detail": "Not a draft"}, status=status.HTTP_400_BAD_REQUEST
            )
        from apps.heritage_data.services import kg_proposals as kg

        try:
            kg.validate_entity_proposal_ready(proposal)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        old = proposal.status
        proposal.status = EntityProposal.STATUS_SUBMITTED
        proposal.submitted_at = timezone.now()
        proposal.save(update_fields=["status", "submitted_at", "updated_at"])
        kg.append_entity_audit(
            proposal,
            actor=request.user,
            action="submitted",
            from_status=old,
            to_status=EntityProposal.STATUS_SUBMITTED,
        )
        return Response(EntityProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        proposal = self.get_object()
        if proposal.author_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status not in (
            EntityProposal.STATUS_DRAFT,
            EntityProposal.STATUS_SUBMITTED,
        ):
            return Response(
                {"detail": "Cannot withdraw"}, status=status.HTTP_400_BAD_REQUEST
            )
        old = proposal.status
        proposal.status = EntityProposal.STATUS_WITHDRAWN
        proposal.resolved_at = timezone.now()
        proposal.save(update_fields=["status", "resolved_at", "updated_at"])
        from apps.heritage_data.services import kg_proposals as kg

        kg.append_entity_audit(
            proposal,
            actor=request.user,
            action="withdrawn",
            from_status=old,
            to_status=EntityProposal.STATUS_WITHDRAWN,
        )
        return Response(EntityProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != EntityProposal.STATUS_SUBMITTED:
            return Response(
                {"detail": "Not submitted"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = (request.data.get("comment") or "").strip()
        from apps.heritage_data.services import kg_proposals as kg

        try:
            kg.materialize_entity_proposal(proposal, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        proposal.refresh_from_db()
        kg.append_entity_audit(
            proposal,
            actor=request.user,
            action="approved",
            from_status=EntityProposal.STATUS_SUBMITTED,
            to_status=EntityProposal.STATUS_APPROVED,
            comment=comment,
        )
        proposal.moderator_comment = comment
        proposal.save(update_fields=["moderator_comment", "updated_at"])
        return Response(EntityProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != EntityProposal.STATUS_SUBMITTED:
            return Response(
                {"detail": "Not submitted"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = (request.data.get("comment") or "").strip()
        if not comment:
            return Response(
                {"detail": "comment required"}, status=status.HTTP_400_BAD_REQUEST
            )
        proposal.status = EntityProposal.STATUS_REJECTED
        proposal.moderator_comment = comment
        proposal.resolved_at = timezone.now()
        proposal.save(
            update_fields=["status", "moderator_comment", "resolved_at", "updated_at"]
        )
        from apps.heritage_data.services import kg_proposals as kg

        kg.append_entity_audit(
            proposal,
            actor=request.user,
            action="rejected",
            from_status=EntityProposal.STATUS_SUBMITTED,
            to_status=EntityProposal.STATUS_REJECTED,
            comment=comment,
        )
        return Response(EntityProposalSerializer(proposal).data)

    @action(detail=True, methods=["get"], url_path="audit")
    def audit(self, request, pk=None):
        proposal = self.get_object()
        rows = proposal.audit_events.all()
        return Response(EntityProposalAuditEventSerializer(rows, many=True).data)


class RelationshipProposalViewSet(viewsets.ModelViewSet):
    """Relationship proposals; moderator approval creates HeritageAssertion (007)."""

    queryset = RelationshipProposal.objects.select_related(
        "author",
        "predicate",
        "primary_source",
        "materialized_assertion",
    ).all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "create":
            return RelationshipProposalCreateSerializer
        if self.action in ("partial_update", "update"):
            return RelationshipProposalPatchSerializer
        return RelationshipProposalSerializer

    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [permissions.IsAuthenticated(), IsSchemaExtensionModerator()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset().order_by("-created_at")
        user = self.request.user
        if user.is_staff or user.groups.filter(name="Moderators").exists():
            return qs
        return qs.filter(author=user)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        proposal = serializer.instance
        if (
            proposal.author_id != self.request.user.id
            and not self.request.user.is_staff
        ):
            raise PermissionDenied()
        if proposal.status != RelationshipProposal.STATUS_DRAFT:
            raise ValidationError("Only draft proposals can be edited.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        proposal = self.get_object()
        if proposal.author_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status != RelationshipProposal.STATUS_DRAFT:
            return Response(
                {"detail": "Not a draft"}, status=status.HTTP_400_BAD_REQUEST
            )
        from apps.heritage_data.services import kg_proposals as kg

        try:
            kg.validate_relationship_proposal_ready(proposal)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        old = proposal.status
        proposal.status = RelationshipProposal.STATUS_SUBMITTED
        proposal.submitted_at = timezone.now()
        proposal.save(update_fields=["status", "submitted_at", "updated_at"])
        kg.append_relationship_audit(
            proposal,
            actor=request.user,
            action="submitted",
            from_status=old,
            to_status=RelationshipProposal.STATUS_SUBMITTED,
        )
        return Response(RelationshipProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        proposal = self.get_object()
        if proposal.author_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status not in (
            RelationshipProposal.STATUS_DRAFT,
            RelationshipProposal.STATUS_SUBMITTED,
        ):
            return Response(
                {"detail": "Cannot withdraw"}, status=status.HTTP_400_BAD_REQUEST
            )
        old = proposal.status
        proposal.status = RelationshipProposal.STATUS_WITHDRAWN
        proposal.resolved_at = timezone.now()
        proposal.save(update_fields=["status", "resolved_at", "updated_at"])
        from apps.heritage_data.services import kg_proposals as kg

        kg.append_relationship_audit(
            proposal,
            actor=request.user,
            action="withdrawn",
            from_status=old,
            to_status=RelationshipProposal.STATUS_WITHDRAWN,
        )
        return Response(RelationshipProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != RelationshipProposal.STATUS_SUBMITTED:
            return Response(
                {"detail": "Not submitted"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = (request.data.get("comment") or "").strip()
        from apps.heritage_data.services import kg_proposals as kg

        try:
            kg.materialize_relationship_proposal(proposal, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        proposal.refresh_from_db()
        kg.append_relationship_audit(
            proposal,
            actor=request.user,
            action="approved",
            from_status=RelationshipProposal.STATUS_SUBMITTED,
            to_status=RelationshipProposal.STATUS_APPROVED,
            comment=comment,
        )
        proposal.moderator_comment = comment
        proposal.save(update_fields=["moderator_comment", "updated_at"])
        return Response(RelationshipProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        proposal = self.get_object()
        if proposal.status != RelationshipProposal.STATUS_SUBMITTED:
            return Response(
                {"detail": "Not submitted"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = (request.data.get("comment") or "").strip()
        if not comment:
            return Response(
                {"detail": "comment required"}, status=status.HTTP_400_BAD_REQUEST
            )
        proposal.status = RelationshipProposal.STATUS_REJECTED
        proposal.moderator_comment = comment
        proposal.resolved_at = timezone.now()
        proposal.save(
            update_fields=["status", "moderator_comment", "resolved_at", "updated_at"]
        )
        from apps.heritage_data.services import kg_proposals as kg

        kg.append_relationship_audit(
            proposal,
            actor=request.user,
            action="rejected",
            from_status=RelationshipProposal.STATUS_SUBMITTED,
            to_status=RelationshipProposal.STATUS_REJECTED,
            comment=comment,
        )
        return Response(RelationshipProposalSerializer(proposal).data)

    @action(detail=True, methods=["get"], url_path="audit")
    def audit(self, request, pk=None):
        proposal = self.get_object()
        rows = proposal.audit_events.all()
        return Response(RelationshipProposalAuditEventSerializer(rows, many=True).data)


class ReviewWorkspaceView(generics.RetrieveAPIView):
    """
    Three-panel review workspace for a single entity.
    Returns full context: entity state, provenance history, submission detail,
    contributor stats, and review history.
    """

    serializer_class = ReviewWorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsCommunityReviewer]
    lookup_field = "entity_id"
    queryset = CulturalEntity.objects.select_related(
        "contributor", "current_revision"
    ).prefetch_related("revisions", "activities", "review_decisions", "review_flags")


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
                {"error": "Entity not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(
            data=request.data, context={"request": request, "entity": entity}
        )
        serializer.is_valid(raise_exception=True)

        verdict = serializer.validated_data["verdict"]
        feedback = serializer.validated_data.get("feedback", "")

        # Create the review decision record
        decision = ReviewDecision.objects.create(
            entity=entity,
            reviewer=request.user,
            revision_reviewed=entity.get_latest_revision(),
            **serializer.validated_data,
        )

        # Apply the verdict
        if verdict == "accept":
            entity.accept_contribution(request.user, feedback)
        elif verdict == "accept_with_edits":
            entity.accept_contribution(request.user, feedback)
        elif verdict == "reject":
            entity.reject_contribution(request.user, feedback)
        elif verdict == "request_changes":
            entity.status = "pending_revision"
            entity.save()
            Activity.objects.create(
                entity=entity,
                user=request.user,
                activity_type="changes_requested",
                comment=feedback,
            )
        elif verdict == "escalate":
            Activity.objects.create(
                entity=entity,
                user=request.user,
                activity_type="escalated",
                comment=feedback,
            )

        # Handle conflict resolution
        conflict_handling = serializer.validated_data.get(
            "conflict_handling", "not_applicable"
        )
        if conflict_handling != "not_applicable":
            # Resolve contradiction flags
            entity.review_flags.filter(
                flag_type="contradiction", is_resolved=False
            ).update(
                is_resolved=True, resolved_by=request.user, resolved_at=timezone.now()
            )
            Activity.objects.create(
                entity=entity,
                user=request.user,
                activity_type="conflict_resolved",
                comment=serializer.validated_data.get("reconciliation_note", ""),
            )

        # Notify contributor about the review decision
        verdict_labels = {
            "accept": "accepted",
            "accept_with_edits": "accepted with edits",
            "reject": "rejected",
            "request_changes": "sent back for changes",
            "escalate": "escalated to an expert",
        }
        verdict_label = verdict_labels.get(verdict, verdict)
        create_notification(
            user=entity.contributor,
            actor=request.user,
            notification_type="review_decision",
            message=f'Your contribution "{entity.name}" has been {verdict_label} by {request.user.username}.'
            + (f" Feedback: {feedback[:200]}" if feedback else ""),
            entity=entity,
            link=f"/knowledge/entity/view/{entity.entity_id}",
        )

        return Response(
            ReviewDecisionSerializer(decision).data, status=status.HTTP_201_CREATED
        )


class ReviewFlagViewSet(viewsets.ModelViewSet):
    """
    CRUD for review flags — community members can flag entities,
    reviewers can resolve flags.
    """

    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["flag_type", "is_resolved", "entity"]

    def get_serializer_class(self):
        if self.action == "create":
            return ReviewFlagCreateSerializer
        return ReviewFlagSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsCommunityReviewer()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return ReviewFlag.objects.select_related("entity", "flagged_by", "resolved_by")

    def perform_create(self, serializer):
        serializer.save(flagged_by=self.request.user)

    @action(detail=True, methods=["post"])
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
        if self.action == "my_role":
            return [permissions.IsAuthenticated()]
        if self.action == "assign":
            return [permissions.IsAuthenticated(), IsExpertCurator()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsExpertCurator()]
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsStaffOrExpertCurator()]
        return [permissions.IsAuthenticated(), IsStaffOrExpertCurator()]

    def get_queryset(self):
        return ReviewerRole.objects.select_related("user", "assigned_by")

    @action(detail=False, methods=["get"])
    def my_role(self, request):
        """Get the current user's reviewer role."""
        try:
            role = ReviewerRole.objects.get(user=request.user)
            return Response(ReviewerRoleSerializer(role).data)
        except ReviewerRole.DoesNotExist:
            return Response(
                {"detail": "No reviewer role assigned"},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=False, methods=["post"])
    def assign(self, request):
        """Expert Curator assigns a reviewer role to a user."""
        serializer = ReviewerRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=serializer.validated_data["user_id"])
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        role, created = ReviewerRole.objects.update_or_create(
            user=user,
            defaults={
                "role": serializer.validated_data["role"],
                "expertise_areas": serializer.validated_data.get("expertise_areas", []),
                "assigned_by": request.user,
                "is_active": True,
            },
        )

        role_slug = serializer.validated_data["role"]
        try:
            reviewers_g = Group.objects.get(name="Reviewers")
            moderators_g = Group.objects.get(name="Moderators")
            user.groups.add(reviewers_g)
            if role_slug in ("domain_expert", "expert_curator"):
                user.groups.add(moderators_g)
            else:
                user.groups.remove(moderators_g)
        except Group.DoesNotExist:
            pass

        return Response(
            ReviewerRoleSerializer(role).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ReviewerApplicationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Request reviewer access. Staff (or a curator) approves in Django admin.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "head", "options", "get"]

    def get_serializer_class(self):
        if self.action == "create":
            return ReviewerApplicationCreateSerializer
        return ReviewerApplicationSerializer

    @action(detail=False, methods=["get"])
    def mine(self, request):
        app = (
            ReviewerApplication.objects.filter(user=request.user)
            .order_by("-created_at")
            .first()
        )
        if not app:
            return Response(
                {
                    "id": None,
                    "message": None,
                    "status": None,
                    "created_at": None,
                    "updated_at": None,
                }
            )
        return Response(ReviewerApplicationSerializer(app).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            ReviewerApplicationSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
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
            status__in=["pending_review", "pending_revision"]
        )
        queue_count = base_queue.count()
        conflicts_count = (
            base_queue.filter(
                review_flags__flag_type="contradiction", review_flags__is_resolved=False
            )
            .distinct()
            .count()
        )
        flagged_count = (
            base_queue.filter(review_flags__is_resolved=False)
            .exclude(review_flags__flag_type="contradiction")
            .distinct()
            .count()
        )
        expiring_count = base_queue.filter(
            status="pending_review", created_at__lt=expiry_cutoff
        ).count()

        # This week's stats
        decisions_this_week = ReviewDecision.objects.filter(
            reviewer=user, created_at__gte=week_ago
        )
        resolved_this_week = decisions_this_week.count()
        accepted_this_week = decisions_this_week.filter(
            verdict__in=["accept", "accept_with_edits"]
        ).count()
        rejected_this_week = decisions_this_week.filter(verdict="reject").count()

        # Lifetime stats
        all_decisions = ReviewDecision.objects.filter(reviewer=user)
        total_reviewed = all_decisions.count()
        total_accepted = all_decisions.filter(
            verdict__in=["accept", "accept_with_edits"]
        ).count()
        acceptance_rate = (
            round(total_accepted / total_reviewed * 100, 1) if total_reviewed > 0 else 0
        )
        conflicts_resolved = Activity.objects.filter(
            user=user, activity_type="conflict_resolved"
        ).count()

        # Reviewer role
        reviewer_role = None
        if hasattr(user, "reviewer_role"):
            reviewer_role = ReviewerRoleSerializer(user.reviewer_role).data

        # Recent domain activity
        recent_activity = Activity.objects.select_related("entity", "user").order_by(
            "-created_at"
        )[:10]

        recent_domain_activity = [
            {
                "entity_name": a.entity.name,
                "entity_id": str(a.entity.entity_id),
                "activity_type": a.activity_type,
                "user": a.user.username,
                "created_at": a.created_at.isoformat(),
                "comment": a.comment or "",
            }
            for a in recent_activity
        ]

        data = {
            "queue_count": queue_count,
            "conflicts_count": conflicts_count,
            "flagged_count": flagged_count,
            "expiring_count": expiring_count,
            "resolved_this_week": resolved_this_week,
            "accepted_this_week": accepted_this_week,
            "rejected_this_week": rejected_this_week,
            "total_reviewed": total_reviewed,
            "acceptance_rate": acceptance_rate,
            "conflicts_resolved": conflicts_resolved,
            "reviewer_role": reviewer_role,
            "recent_domain_activity": recent_domain_activity,
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
    search_fields = ["name", "short_name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_serializer_class(self):
        if self.action == "create":
            return OrganizationCreateSerializer
        if self.action in ["retrieve"]:
            return OrganizationDetailSerializer
        return OrganizationListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Organization.objects.annotate(
            member_count=Count("members")
        ).select_related("owner")

    def perform_create(self, serializer):
        org = serializer.save(owner=self.request.user)
        # Auto-add creator as admin member
        OrganizationMembership.objects.create(
            user=self.request.user, organization=org, role="admin"
        )

    def perform_update(self, serializer):
        org = self.get_object()
        if org.owner != self.request.user and not self.request.user.is_staff:
            is_admin = OrganizationMembership.objects.filter(
                user=self.request.user, organization=org, role="admin"
            ).exists()
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Only org admins can update this organization.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        """Join an organization as a member."""
        org = self.get_object()
        membership, created = OrganizationMembership.objects.get_or_create(
            user=request.user, organization=org, defaults={"role": "member"}
        )
        if not created:
            return Response(
                {"detail": "Already a member"}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            OrganizationMemberSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        """Leave an organization."""
        org = self.get_object()
        try:
            membership = OrganizationMembership.objects.get(
                user=request.user, organization=org
            )
            if org.owner == request.user:
                return Response(
                    {
                        "detail": "Organization owner cannot leave. Transfer ownership first."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            membership.delete()
            return Response({"detail": "Left organization"}, status=status.HTTP_200_OK)
        except OrganizationMembership.DoesNotExist:
            return Response(
                {"detail": "Not a member"}, status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        """List all members of an organization."""
        org = self.get_object()
        memberships = org.members.select_related("user").order_by("-role", "joined_at")
        return Response(OrganizationMemberSerializer(memberships, many=True).data)

    @action(
        detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated]
    )
    def my_organizations(self, request):
        """Get organizations the current user belongs to."""
        memberships = OrganizationMembership.objects.filter(
            user=request.user
        ).select_related("organization")
        orgs = [m.organization for m in memberships]
        # Re-query with annotation
        org_ids = [o.id for o in orgs]
        queryset = Organization.objects.filter(id__in=org_ids).annotate(
            member_count=Count("members")
        )
        return Response(OrganizationListSerializer(queryset, many=True).data)


class UserProfileImageView(APIView):
    """Upload or remove profile image."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        image = request.FILES.get("profile_image")
        if not image:
            return Response(
                {"error": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST
            )
        profile.profile_image = image
        profile.save()
        return Response(
            {
                "profile_image": profile.profile_image.url
                if profile.profile_image
                else None
            }
        )

    def delete(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.profile_image:
            profile.profile_image.delete()
        return Response({"detail": "Profile image removed"})


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
    filterset_fields = ["notification_type", "is_read"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).select_related(
            "entity", "submission", "actor"
        )

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=["post"])
    def mark_read(self, request):
        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        notification_ids = serializer.validated_data.get("notification_ids", [])
        qs = Notification.objects.filter(user=request.user, is_read=False)
        if notification_ids:
            qs = qs.filter(notification_id__in=notification_ids)

        updated = qs.update(is_read=True)
        return Response({"marked_read": updated})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True
        )
        return Response({"marked_read": updated})


def create_notification(
    user, notification_type, message, entity=None, submission=None, link="", actor=None
):
    """Helper function to create a notification."""
    return Notification.objects.create(
        user=user,
        actor=actor,
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

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        """Toggle a reaction. If the same type exists, remove it. If different, switch it."""
        serializer = ReactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entity_id = serializer.validated_data.get("entity_id")
        comment_id = serializer.validated_data.get("comment_id")
        reaction_type = serializer.validated_data["reaction_type"]

        lookup = {"user": request.user}
        if entity_id:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
            lookup["entity"] = entity
            lookup["comment"] = None
        elif comment_id:
            comment = Comments.objects.get(comment_id=comment_id)
            lookup["comment"] = comment
            lookup["entity"] = None

        try:
            existing = Reaction.objects.get(**lookup)
            if existing.reaction_type == reaction_type:
                # Same reaction — remove it (toggle off)
                existing.delete()
                return Response({"action": "removed", "reaction_type": None})
            else:
                # Different reaction — switch it
                existing.reaction_type = reaction_type
                existing.save()
                return Response({"action": "switched", "reaction_type": reaction_type})
        except Reaction.DoesNotExist:
            # New reaction
            Reaction.objects.create(
                user=request.user,
                entity=lookup.get("entity"),
                comment=lookup.get("comment"),
                reaction_type=reaction_type,
            )

            # Notify entity owner about upvote
            if entity_id and reaction_type == "upvote":
                entity = CulturalEntity.objects.get(entity_id=entity_id)
                if entity.contributor != request.user:
                    create_notification(
                        user=entity.contributor,
                        actor=request.user,
                        notification_type="reaction",
                        message=f'{request.user.username} upvoted your contribution "{entity.name}"',
                        entity=entity,
                        link=f"/knowledge/entity/view/{entity_id}",
                    )

            return Response(
                {"action": "created", "reaction_type": reaction_type},
                status=status.HTTP_201_CREATED,
            )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Get reaction summary for an entity or comment."""
        entity_id = request.query_params.get("entity_id")
        comment_id = request.query_params.get("comment_id")

        if not entity_id and not comment_id:
            return Response(
                {"error": "Provide entity_id or comment_id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if entity_id:
            qs = Reaction.objects.filter(entity_id=entity_id)
        else:
            qs = Reaction.objects.filter(comment__comment_id=comment_id)

        upvotes = qs.filter(reaction_type="upvote").count()
        downvotes = qs.filter(reaction_type="downvote").count()

        user_reaction = None
        if request.user.is_authenticated:
            r = qs.filter(user=request.user).first()
            if r:
                user_reaction = r.reaction_type

        return Response(
            {
                "upvotes": upvotes,
                "downvotes": downvotes,
                "user_reaction": user_reaction,
            }
        )


# =====================================================================
# FORK VIEWS
# =====================================================================


class ForkViewSet(viewsets.ViewSet):
    """
    Fork a contribution to create a new entity based on an existing one.
    """

    permission_classes = [permissions.IsAuthenticated]

    def create(self, request):
        """Fork an entity. POST body: { entity_id, reason, fork_reason_tag, changes }"""
        entity_id = request.data.get("entity_id")
        if not entity_id:
            return Response(
                {"error": "entity_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            original = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response(
                {"error": "Entity not found"}, status=status.HTTP_404_NOT_FOUND
            )

        latest_revision = original.get_latest_revision()
        if not latest_revision:
            return Response(
                {"error": "No revision to fork"}, status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get("reason", "")
        fork_reason_tag = request.data.get("fork_reason_tag", "other")
        valid_tags = [c[0] for c in Fork.FORK_REASON_CHOICES]
        if fork_reason_tag not in valid_tags:
            fork_reason_tag = "other"

        changes = request.data.get("changes", {})

        original_data = (
            latest_revision.data if isinstance(latest_revision.data, dict) else {}
        )
        fork_data = {**original_data, **changes}

        # Compute diff_summary
        diff_summary = {}
        all_keys = set(original_data.keys()) | set(fork_data.keys())
        for key in all_keys:
            old_val = original_data.get(key)
            new_val = fork_data.get(key)
            if old_val != new_val:
                diff_summary[key] = {"old": old_val, "new": new_val}

        # Determine lineage
        root = original.root_entity if original.root_entity_id else original

        forked_entity = CulturalEntity.objects.create(
            name=f"{original.name} (fork by {request.user.username})",
            description=original.description,
            category=original.category,
            contributor=request.user,
            status="draft",
            root_entity=root,
            parent_entity=original,
            fork_depth=original.fork_depth + 1,
        )

        forked_entity.create_revision(request.user, fork_data)

        fork = Fork.objects.create(
            original_entity=original,
            forked_entity=forked_entity,
            forked_by=request.user,
            forked_from_revision=latest_revision,
            reason=reason,
            fork_reason_tag=fork_reason_tag,
            diff_summary=diff_summary,
        )

        Activity.objects.create(
            entity=original,
            user=request.user,
            activity_type="commented",
            comment=f"Forked by {request.user.username} ({fork.get_fork_reason_tag_display()}): {reason}",
        )

        if original.contributor != request.user:
            create_notification(
                user=original.contributor,
                actor=request.user,
                notification_type="fork",
                message=f'{request.user.username} forked your contribution "{original.name}"',
                entity=original,
                link=f"/knowledge/entity/view/{forked_entity.entity_id}",
            )

        return Response(
            ForkSerializer(fork).data,
            status=status.HTTP_201_CREATED,
        )

    def list(self, request):
        """List forks of a specific entity."""
        entity_id = request.query_params.get("entity_id")
        if not entity_id:
            return Response(
                {"error": "entity_id query param required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        forks = Fork.objects.filter(original_entity_id=entity_id).select_related(
            "forked_by", "original_entity", "forked_entity"
        )
        return Response(ForkSerializer(forks, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsReviewerOrAdmin])
    def merge(self, request, pk=None):
        """Merge fork changes into parent entity, creating a new revision on parent."""
        try:
            fork = Fork.objects.select_related("original_entity", "forked_entity").get(
                pk=pk
            )
        except Fork.DoesNotExist:
            return Response(
                {"error": "Fork not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if fork.fork_status != "active":
            return Response(
                {"error": f"Fork is already {fork.fork_status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parent = fork.original_entity
        forked = fork.forked_entity

        forked_rev = forked.revisions.order_by("-revision_number").first()
        parent_rev = parent.revisions.order_by("-revision_number").first()

        if not forked_rev:
            return Response(
                {"error": "Fork has no revisions"}, status=status.HTTP_400_BAD_REQUEST
            )

        parent_data = (
            parent_rev.data if parent_rev and isinstance(parent_rev.data, dict) else {}
        )
        forked_data = forked_rev.data if isinstance(forked_rev.data, dict) else {}

        merged_data = {**parent_data, **forked_data}
        parent.create_revision(request.user, merged_data)

        fork.fork_status = "merged"
        fork.merged_at = timezone.now()
        fork.merged_by = request.user
        fork.save(update_fields=["fork_status", "merged_at", "merged_by"])

        forked.status = "merged"
        forked.save(update_fields=["status"])

        Activity.objects.create(
            entity=parent,
            user=request.user,
            activity_type="revised",
            comment=f"Merged fork by {forked.contributor.username}: {fork.reason}",
        )

        if forked.contributor != request.user:
            create_notification(
                user=forked.contributor,
                actor=request.user,
                notification_type="submission_update",
                message=f'Your fork of "{parent.name}" has been merged!',
                entity=parent,
                link=f"/knowledge/entity/view/{parent.entity_id}",
            )

        return Response(ForkSerializer(fork).data)

    @action(detail=True, methods=["post"], permission_classes=[IsReviewerOrAdmin])
    def promote(self, request, pk=None):
        """Fork becomes the canonical entity; original is superseded."""
        try:
            fork = Fork.objects.select_related("original_entity", "forked_entity").get(
                pk=pk
            )
        except Fork.DoesNotExist:
            return Response(
                {"error": "Fork not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if fork.fork_status != "active":
            return Response(
                {"error": f"Fork is already {fork.fork_status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parent = fork.original_entity
        forked = fork.forked_entity

        parent.status = "superseded"
        parent.save(update_fields=["status"])

        forked.status = "accepted"
        forked.save(update_fields=["status"])

        fork.fork_status = "promoted"
        fork.merged_at = timezone.now()
        fork.merged_by = request.user
        fork.save(update_fields=["fork_status", "merged_at", "merged_by"])

        Activity.objects.create(
            entity=forked,
            user=request.user,
            activity_type="accepted",
            comment=f'Promoted to canonical entity, superseding "{parent.name}"',
        )

        if forked.contributor != request.user:
            create_notification(
                user=forked.contributor,
                actor=request.user,
                notification_type="submission_update",
                message=f'Your fork has been promoted as the canonical version of "{parent.name}"!',
                entity=forked,
                link=f"/knowledge/entity/view/{forked.entity_id}",
            )

        return Response(ForkSerializer(fork).data)

    @action(detail=True, methods=["post"], permission_classes=[IsReviewerOrAdmin])
    def reject(self, request, pk=None):
        """Reject a fork with required reason."""
        try:
            fork = Fork.objects.select_related("original_entity", "forked_entity").get(
                pk=pk
            )
        except Fork.DoesNotExist:
            return Response(
                {"error": "Fork not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if fork.fork_status != "active":
            return Response(
                {"error": f"Fork is already {fork.fork_status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rejection_reason = request.data.get("reason", "")
        if not rejection_reason:
            return Response(
                {"error": "Reason is required when rejecting a fork"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        forked = fork.forked_entity

        fork.fork_status = "rejected"
        fork.save(update_fields=["fork_status"])

        forked.status = "rejected"
        forked.save(update_fields=["status"])

        Activity.objects.create(
            entity=forked,
            user=request.user,
            activity_type="rejected",
            comment=f"Fork rejected: {rejection_reason}",
        )

        if forked.contributor != request.user:
            create_notification(
                user=forked.contributor,
                actor=request.user,
                notification_type="submission_update",
                message=f'Your fork of "{fork.original_entity.name}" was rejected: {rejection_reason}',
                entity=forked,
                link=f"/knowledge/entity/view/{forked.entity_id}",
            )

        return Response(ForkSerializer(fork).data)


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
        from_num = request.query_params.get("from")
        to_num = request.query_params.get("to")

        if not from_num or not to_num:
            return Response(
                {"error": 'Both "from" and "to" query params are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response(
                {"error": "Entity not found"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            rev_from = Revision.objects.get(
                entity=entity, revision_number=int(from_num)
            )
            rev_to = Revision.objects.get(entity=entity, revision_number=int(to_num))
        except Revision.DoesNotExist:
            return Response(
                {"error": "Revision not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Compute field-by-field diff (with lightweight provenance on the "to" side)
        diff = {}
        all_keys = set(list(rev_from.data.keys()) + list(rev_to.data.keys()))
        for key in sorted(all_keys):
            if str(key).startswith("_"):
                continue
            old_val = rev_from.data.get(key)
            new_val = rev_to.data.get(key)
            if old_val != new_val:
                diff[key] = {
                    "old": old_val,
                    "new": new_val,
                    "changed_at": rev_to.created_at.isoformat(),
                    "changed_by": (
                        UserSerializer(rev_to.created_by).data
                        if rev_to.created_by
                        else None
                    ),
                    "revision_from_number": rev_from.revision_number,
                    "revision_to_number": rev_to.revision_number,
                }

        return Response(
            {
                "entity_id": str(entity.entity_id),
                "entity_name": entity.name,
                "revision_from": RevisionSerializer(rev_from).data,
                "revision_to": RevisionSerializer(rev_to).data,
                "diff": diff,
                "field_diffs": [
                    {"field": k, **v}
                    for k, v in sorted(diff.items(), key=lambda kv: kv[0])
                ],
            }
        )


# =====================================================================
# SHARE VIEWS
# =====================================================================


class ShareViewSet(viewsets.ViewSet):
    """Track shares of entities to external platforms."""

    def create(self, request):
        serializer = ShareCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entity_id = serializer.validated_data["entity_id"]
        platform = serializer.validated_data["platform"]

        try:
            entity = CulturalEntity.objects.get(entity_id=entity_id)
        except CulturalEntity.DoesNotExist:
            return Response(
                {"error": "Entity not found"}, status=status.HTTP_404_NOT_FOUND
            )

        share = Share.objects.create(
            user=request.user if request.user.is_authenticated else None,
            entity=entity,
            platform=platform,
        )

        return Response(ShareSerializer(share).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def count(self, request):
        """Get share count for an entity."""
        entity_id = request.query_params.get("entity_id")
        if not entity_id:
            return Response(
                {"error": "entity_id required"}, status=status.HTTP_400_BAD_REQUEST
            )

        total = Share.objects.filter(entity_id=entity_id).count()
        by_platform = {}
        for choice in Share.PLATFORM_CHOICES:
            ct = Share.objects.filter(entity_id=entity_id, platform=choice[0]).count()
            if ct > 0:
                by_platform[choice[0]] = ct

        return Response({"total": total, "by_platform": by_platform})


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
        entity_id = self.kwargs.get("entity_id")
        # Only top-level comments (no parent) — replies are nested
        return (
            Comments.objects.filter(
                submission_id=entity_id,
                parent__isnull=True,
            )
            .select_related("user")
            .prefetch_related("replies", "reactions")
        )

    def perform_create(self, serializer):
        entity_id = self.kwargs.get("entity_id")
        entity = CulturalEntity.objects.get(entity_id=entity_id)
        comment = serializer.save(
            user=self.request.user,
            submission=entity,
        )

        # Create activity
        Activity.objects.create(
            entity=entity,
            user=self.request.user,
            activity_type="commented",
            comment=comment.comment[:200],
        )

        # Notify entity contributor
        if entity.contributor != self.request.user:
            create_notification(
                user=entity.contributor,
                actor=self.request.user,
                notification_type="comment",
                message=f'{self.request.user.username} commented on "{entity.name}": {comment.comment[:100]}',
                entity=entity,
                link=f"/knowledge/entity/view/{entity_id}",
            )

        # If it's a reply, notify the parent comment's author
        if comment.parent and comment.parent.user != self.request.user:
            create_notification(
                user=comment.parent.user,
                actor=self.request.user,
                notification_type="comment",
                message=f'{self.request.user.username} replied to your comment on "{entity.name}"',
                entity=entity,
                link=f"/knowledge/entity/view/{entity_id}",
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
    filterset_fields = ["status", "contribution_type", "submitted_via"]
    search_fields = ["entity_name", "content", "contributor_name"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return PublicContributionCreateSerializer
        elif self.action == "review":
            return PublicContributionReviewSerializer
        return PublicContributionListSerializer

    def get_permissions(self):
        if self.action == "create":
            # Anyone can submit a public contribution (QR scan)
            return [AllowAny()]
        elif self.action in ["list", "retrieve"]:
            # Authenticated users can view
            return [IsAuthenticated()]
        else:
            # Review actions require staff or reviewer
            return [IsAuthenticated(), IsReviewerOrAdmin()]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status if provided
        status_param = self.request.query_params.get("status")
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
                "message": "Thank you for your contribution!",
                "id": str(serializer.instance.id),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        """
        Review (approve/reject/incorporate) a public contribution.
        """
        contribution = self.get_object()

        if contribution.status not in ["pending"]:
            return Response(
                {"error": "This contribution has already been reviewed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublicContributionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        review_notes = serializer.validated_data.get("review_notes", "")
        link_to_entity_id = serializer.validated_data.get("link_to_entity_id")

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

        return Response(
            {
                "message": f"Contribution has been {new_status}.",
                "id": str(contribution.id),
                "status": new_status,
            }
        )

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Get statistics about public contributions."""
        total = PublicContribution.objects.count()
        pending = PublicContribution.objects.filter(status="pending").count()
        approved = PublicContribution.objects.filter(status="approved").count()
        rejected = PublicContribution.objects.filter(status="rejected").count()
        incorporated = PublicContribution.objects.filter(status="incorporated").count()

        by_type = (
            PublicContribution.objects.values("contribution_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        by_source = (
            PublicContribution.objects.values("submitted_via")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        return Response(
            {
                "total": total,
                "pending": pending,
                "approved": approved,
                "rejected": rejected,
                "incorporated": incorporated,
                "by_type": list(by_type),
                "by_source": list(by_source),
            }
        )


# =====================================================================
# PROGRESSION SYSTEM
# =====================================================================

import math
from datetime import timedelta as _td
from django.utils import timezone as _tz


def _compute_score_with_decay(user):
    """
    Compute per-track and total points for a user, applying temporal decay.
    P(t) = BaseScore × e^(−λt)   where t = days since created_at, λ = 0.004
    Contributions < 180 days old get full weight (no decay).
    """
    DECAY_LAMBDA = 0.004
    DECAY_THRESHOLD_DAYS = 180
    now = _tz.now()

    def _decayed(base_score, created_at):
        age_days = (now - created_at).days
        if age_days <= DECAY_THRESHOLD_DAYS:
            return base_score
        return base_score * math.exp(-DECAY_LAMBDA * (age_days - DECAY_THRESHOLD_DAYS))

    # --- Curation: entities submitted / accepted ---
    curation_pts = 0
    for e in CulturalEntity.objects.filter(contributor=user).only(
        "status", "created_at"
    ):
        base = 10 if e.status == "accepted" else 3
        curation_pts += _decayed(base, e.created_at)
    # Also count legacy submissions
    for s in Submission.objects.filter(contributor=user).only("status", "created_at"):
        base = 10 if s.status == "accepted" else 3
        curation_pts += _decayed(base, s.created_at)

    # --- Annotation: revisions authored ---
    annotation_pts = 0
    for r in Revision.objects.filter(created_by=user).only("created_at"):
        annotation_pts += _decayed(2, r.created_at)

    # --- Verification: review decisions ---
    verification_pts = 0
    for rd in ReviewDecision.objects.filter(reviewer=user).only("created_at"):
        verification_pts += _decayed(5, rd.created_at)

    # --- Exhibition: accepted entities that are published (treated as exhibition) ---
    exhibition_pts = 0
    for e in CulturalEntity.objects.filter(contributor=user, status="accepted").only(
        "created_at"
    ):
        exhibition_pts += _decayed(3, e.created_at)

    # --- Fork scoring: points for approved/merged forks based on reason tag ---
    FORK_SCORE_MAP = {
        "correction": 15,
        "expansion": 20,
        "translation": 25,
        "source_addition": 20,
        "dispute": 10,
        "other": 15,
    }
    fork_pts = 0
    for f in Fork.objects.filter(
        forked_by=user, fork_status__in=["merged", "promoted"]
    ).only("fork_reason_tag", "created_at"):
        base = FORK_SCORE_MAP.get(f.fork_reason_tag, 15)
        fork_pts += _decayed(base, f.created_at)

    curation_pts = round(curation_pts)
    annotation_pts = round(annotation_pts)
    verification_pts = round(verification_pts)
    exhibition_pts = round(exhibition_pts)
    fork_pts = round(fork_pts)
    total = curation_pts + annotation_pts + verification_pts + exhibition_pts + fork_pts

    return {
        "curation": curation_pts,
        "annotation": annotation_pts,
        "verification": verification_pts,
        "exhibition": exhibition_pts,
        "fork_contributions": fork_pts,
        "total": total,
    }


# Tier thresholds (total points)
_TIER_THRESHOLDS = [
    (5000, "Grand Keeper", "👑", "grandkeeper"),
    (1500, "Archivist", "📦", "archivist"),
    (500, "Curator", "🏛️", "curator"),
    (100, "Scholar", "📚", "scholar"),
    (0, "Apprentice", "🕯️", "apprentice"),
]

# Per-track tier thresholds
_TRACK_TIER_THRESHOLDS = [
    (200, "Grand Keeper"),
    (100, "Archivist"),
    (40, "Curator"),
    (15, "Scholar"),
    (0, "Apprentice"),
]


def _get_tier(total_points):
    for threshold, name, icon, tier_id in _TIER_THRESHOLDS:
        if total_points >= threshold:
            return {"name": name, "icon": icon, "id": tier_id}
    return {"name": "Apprentice", "icon": "🕯️", "id": "apprentice"}


def _get_track_tier(points):
    for threshold, name in _TRACK_TIER_THRESHOLDS:
        if points >= threshold:
            return name
    return "Apprentice"


def _next_tier_points(current_points, thresholds):
    """Return the point threshold for the next tier above current_points."""
    for threshold, *_ in reversed(thresholds):
        if threshold > current_points:
            return threshold
    return current_points  # already max


def _compute_medals_from_rank(rank, total_users):
    """Simplified medal computation based on overall ranking percentile."""
    if total_users == 0:
        return {"gold": 0, "silver": 0, "bronze": 0}
    percentile = rank / total_users
    gold = 1 if percentile <= 0.10 else 0
    silver = 1 if percentile <= 0.20 else 0
    bronze = 1 if percentile <= 0.40 else 0
    return {"gold": gold, "silver": silver, "bronze": bronze}


PROGRESSION_LEADERBOARD_CACHE_KEY = "progression:leaderboard_entries_v1"
# Short TTL: leaderboard is expensive (full-user scan + per-user scoring) but need not be real-time.
PROGRESSION_LEADERBOARD_CACHE_TTL = 300


def _build_leaderboard():
    """Build the full leaderboard, computing scores per user."""
    cached = cache.get(PROGRESSION_LEADERBOARD_CACHE_KEY)
    if cached is not None:
        return cached

    users = User.objects.select_related("profile").filter(is_active=True)
    entries = []
    for user in users:
        scores = _compute_score_with_decay(user)
        if scores["total"] == 0:
            continue
        tier = _get_tier(scores["total"])
        profile = getattr(user, "profile", None)
        entries.append(
            {
                "user_id": user.id,
                "username": user.username,
                "full_name": (
                    f"{profile.first_name} {profile.last_name}".strip()
                    if profile
                    else user.get_full_name() or user.username
                ),
                "institution": getattr(profile, "organization", "") or "",
                "profile_image": (
                    profile.profile_image.url
                    if profile and profile.profile_image
                    else ""
                ),
                "score": scores["total"],
                "tier_name": tier["name"],
                "tier_icon": tier["icon"],
                "tier_id": tier["id"],
                "tracks": scores,
            }
        )
    entries.sort(key=lambda e: -e["score"])
    # Assign ranks
    for idx, entry in enumerate(entries):
        if idx > 0 and entries[idx - 1]["score"] != entry["score"]:
            entry["rank"] = idx + 1
        else:
            entry["rank"] = entries[idx - 1]["rank"] if idx > 0 else 1
    # Compute medals based on rank
    total_users = len(entries)
    for entry in entries:
        entry["medals"] = _compute_medals_from_rank(entry["rank"], total_users)
    cache.set(
        PROGRESSION_LEADERBOARD_CACHE_KEY, entries, PROGRESSION_LEADERBOARD_CACHE_TTL
    )
    return entries


class ProgressionView(APIView):
    """
    Comprehensive progression data for the current user:
    - Overall tier, rank, total points
    - Per-track progress with tier and next-tier thresholds
    - Medals/seals based on ranking percentile
    - Recent activity (last 10 activities)
    - Contribution streak (consecutive days with contributions)
    - Next milestone description

    Also includes the leaderboard (top 50).
    Unauthenticated users get only the leaderboard.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        # Build leaderboard
        leaderboard = _build_leaderboard()

        # If not authenticated, return leaderboard only
        if not request.user or not request.user.is_authenticated:
            return Response(
                {
                    "user_progress": None,
                    "leaderboard": leaderboard[:50],
                }
            )

        user = request.user
        scores = _compute_score_with_decay(user)
        tier = _get_tier(scores["total"])

        # Find user rank in leaderboard
        user_rank = None
        for entry in leaderboard:
            if entry["user_id"] == user.id:
                user_rank = entry["rank"]
                break
        if user_rank is None:
            user_rank = len(leaderboard) + 1

        # Per-track progress
        track_progress = []
        for track_id in ["curation", "annotation", "verification", "exhibition"]:
            pts = scores[track_id]
            track_tier = _get_track_tier(pts)
            next_pts = _next_tier_points(pts, _TRACK_TIER_THRESHOLDS)
            percentage = (
                min(round((pts / next_pts) * 100), 100) if next_pts > 0 else 100
            )
            track_progress.append(
                {
                    "id": track_id,
                    "tier": track_tier,
                    "points": pts,
                    "nextTierPoints": next_pts,
                    "percentage": percentage,
                }
            )

        # Medals
        total_users = len(leaderboard)
        medals = _compute_medals_from_rank(user_rank, total_users)

        # Next milestone computation
        next_tier_pts = _next_tier_points(scores["total"], _TIER_THRESHOLDS)
        points_needed = max(0, next_tier_pts - scores["total"])
        next_tier_info = _get_tier(next_tier_pts)
        if points_needed > 0:
            next_milestone = f"You need {points_needed} more points to reach {next_tier_info['name']} rank."
        else:
            next_milestone = "You have reached the highest rank! Keep contributing to maintain your standing."

        # Recent activity (last 10)
        recent_activities = []
        for a in Activity.objects.filter(user=user).order_by("-created_at")[:10]:
            pts_map = {
                "submitted": 3,
                "accepted": 10,
                "rejected": 0,
                "revised": 2,
                "commented": 1,
                "escalated": 5,
                "changes_requested": 2,
                "flagged": 2,
                "conflict_resolved": 5,
            }
            recent_activities.append(
                {
                    "type": a.activity_type,
                    "points": pts_map.get(a.activity_type, 0),
                    "label": f"{a.get_activity_type_display()} — {a.entity.name[:40]}",
                    "created_at": a.created_at.isoformat(),
                }
            )

        # Contribution streak (consecutive days with any activity)
        streak = 0
        today = _tz.now().date()
        day = today
        while True:
            has_activity = Activity.objects.filter(
                user=user,
                created_at__date=day,
            ).exists()
            if not has_activity:
                # Also check legacy submissions
                has_activity = Submission.objects.filter(
                    contributor=user,
                    created_at__date=day,
                ).exists()
            if has_activity:
                streak += 1
                day -= _td(days=1)
            else:
                break

        # Breakdown counts (raw)
        entity_count = CulturalEntity.objects.filter(contributor=user).count()
        accepted_entities = CulturalEntity.objects.filter(
            contributor=user, status="accepted"
        ).count()
        revision_count = Revision.objects.filter(created_by=user).count()
        review_count = ReviewDecision.objects.filter(reviewer=user).count()
        submission_count = Submission.objects.filter(contributor=user).count()

        profile = getattr(user, "profile", None)

        user_progress = {
            "tier": tier["name"],
            "tierIcon": tier["icon"],
            "tierId": tier["id"],
            "rank": user_rank,
            "totalPoints": scores["total"],
            "tracks": track_progress,
            "medals": medals,
            "nextMilestone": next_milestone,
            "nextTierPoints": next_tier_pts,
            "pointsToNextTier": points_needed,
            "progressPercent": min(round((scores["total"] / next_tier_pts) * 100), 100)
            if next_tier_pts > 0
            else 100,
            "streak": streak,
            "recentActivity": recent_activities,
            "breakdown": {
                "entities": entity_count,
                "acceptedEntities": accepted_entities,
                "revisions": revision_count,
                "reviews": review_count,
                "submissions": submission_count,
            },
            "fullName": (
                f"{profile.first_name} {profile.last_name}".strip()
                if profile
                else user.get_full_name() or user.username
            ),
            "institution": getattr(profile, "organization", "") or "",
            "profileImage": (
                profile.profile_image.url if profile and profile.profile_image else ""
            ),
        }

        return Response(
            {
                "user_progress": user_progress,
                "leaderboard": leaderboard[:50],
            }
        )


# =====================================================================
# PROJECT-BASED CONTRIBUTION VIEWSETS (final_plan.md §3)
# =====================================================================

from django.db import transaction  # noqa: E402
from django.db.models import Count  # noqa: E402
from .models import (  # noqa: E402
    Media,
    Project,
    ProjectActivity,
    ProjectAsset,
    ProjectEntity,
    ProjectMembership,
)
from .project_services import (  # noqa: E402
    assert_project_ocr_quota,
    can_transition_project,
    infer_media_type_from_filename,
    is_document_media_file,
    queue_ocr_for_media,
    user_can_edit_project as _user_can_edit_project,
    user_can_view_project as _user_can_view_project,
)


class IsProjectOwnerOrReadOnly(permissions.BasePermission):
    """Owner can mutate; collaborators with editor role can mutate; others read if visible."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return _user_can_view_project(request.user, obj)
        return _user_can_edit_project(request.user, obj)


def _log_project_activity(project, actor, action, *, target_kind="", target_id="", payload=None):
    ProjectActivity.objects.create(
        project=project,
        actor=actor if actor and actor.is_authenticated else None,
        action=action,
        target_kind=target_kind,
        target_id=str(target_id) if target_id else "",
        payload=payload or {},
    )


class ProjectViewSet(viewsets.ModelViewSet):
    """CRUD + state machine for contributor projects."""

    queryset = Project.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsProjectOwnerOrReadOnly]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["state", "visibility", "owner"]
    search_fields = ["title", "abstract", "intended_subject"]
    ordering_fields = ["created_at", "updated_at", "submitted_at", "merged_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Project.objects.all()
            .select_related("owner")
            .annotate(
                asset_count=Count("assets", distinct=True),
                entity_count=Count("entities", distinct=True),
                collaborator_count=Count("memberships", distinct=True),
            )
        )
        if not user.is_authenticated:
            return qs.filter(visibility=Project.VISIBILITY_PUBLIC)
        if user.is_staff:
            return qs
        return qs.filter(
            Q(visibility=Project.VISIBILITY_PUBLIC)
            | Q(owner=user)
            | Q(memberships__user=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        if self.action == "create":
            return ProjectCreateSerializer
        if self.action in {"update", "partial_update"}:
            return ProjectUpdateSerializer
        return ProjectDetailSerializer

    def perform_create(self, serializer):
        with transaction.atomic():
            project = serializer.save(owner=self.request.user)
            ProjectMembership.objects.create(
                project=project,
                user=self.request.user,
                role=ProjectMembership.ROLE_OWNER,
                invited_by=self.request.user,
            )
            _log_project_activity(
                project, self.request.user, ProjectActivity.ACTION_CREATED
            )

    def perform_update(self, serializer):
        project = serializer.save()
        _log_project_activity(
            project, self.request.user, ProjectActivity.ACTION_UPDATED
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="transition",
        permission_classes=[permissions.IsAuthenticated],
    )
    def transition(self, request, slug=None):
        project = self.get_object()

        payload = ProjectStateTransitionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = payload.validated_data["target_state"]
        comment = payload.validated_data.get("comment", "")

        if not can_transition_project(request.user, project, target):
            raise PermissionDenied(
                "You do not have permission to perform this state transition."
            )

        with transaction.atomic():
            previous = project.state
            project.state = target
            if target == Project.STATE_IN_REVIEW and not project.submitted_at:
                project.submitted_at = timezone.now()
            if target == Project.STATE_MERGED and not project.merged_at:
                project.merged_at = timezone.now()
            project.save(update_fields=["state", "submitted_at", "merged_at", "updated_at"])

            _log_project_activity(
                project,
                request.user,
                ProjectActivity.ACTION_STATE_CHANGED,
                payload={"from": previous, "to": target, "comment": comment},
            )

        return Response(ProjectDetailSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="activity")
    def activity(self, request, slug=None):
        project = self.get_object()
        qs = project.activities.select_related("actor").all()
        page = self.paginate_queryset(qs)
        serializer = ProjectActivitySerializer(page or qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class _ProjectScopedViewSet(viewsets.ModelViewSet):
    """Base for viewsets that live under a single Project (resolved from URL kwarg)."""

    permission_classes = [permissions.IsAuthenticated]
    project_url_kwarg = "project_slug"

    def _get_project(self):
        slug = self.kwargs.get(self.project_url_kwarg)
        try:
            project = Project.objects.get(slug=slug)
        except Project.DoesNotExist as exc:
            raise NotFound("Project not found.") from exc
        return project

    def _require_view(self, project):
        if not _user_can_view_project(self.request.user, project):
            raise PermissionDenied("You cannot view this project.")

    def _require_edit(self, project):
        if not _user_can_edit_project(self.request.user, project):
            raise PermissionDenied("You cannot modify this project.")


class ProjectMembershipViewSet(_ProjectScopedViewSet):
    serializer_class = ProjectMembershipSerializer

    def get_queryset(self):
        project = self._get_project()
        self._require_view(project)
        return project.memberships.select_related("user", "invited_by")

    def perform_create(self, serializer):
        project = self._get_project()
        self._require_edit(project)
        membership = serializer.save(
            project=project,
            invited_by=self.request.user,
        )
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_MEMBER_ADDED,
            target_kind="membership",
            target_id=membership.id,
            payload={"user_id": str(membership.user_id), "role": membership.role},
        )

    def perform_destroy(self, instance):
        project = self._get_project()
        self._require_edit(project)
        if instance.user_id == project.owner_id:
            raise ValidationError("The project owner's membership cannot be removed.")
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_MEMBER_REMOVED,
            target_kind="membership",
            target_id=instance.id,
            payload={"user_id": str(instance.user_id)},
        )
        instance.delete()


class ProjectAssetViewSet(_ProjectScopedViewSet):
    serializer_class = ProjectAssetSerializer

    def get_queryset(self):
        project = self._get_project()
        self._require_view(project)
        return project.assets.select_related(
            "media",
            "media__ocr_document",
            "uploaded_by",
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def upload(self, request, project_slug=None):
        from .serializers import ProjectAssetUploadSerializer

        project = self._get_project()
        self._require_edit(project)
        if project.state == Project.STATE_MERGED:
            raise ValidationError("Cannot upload assets to a merged project.")

        ser = ProjectAssetUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        run_ocr = bool(data.get("run_ocr"))
        upload_file = data["file"]
        is_doc = is_document_media_file(upload_file)
        media_type = data.get("media_type") or infer_media_type_from_filename(
            upload_file.name
        )

        if run_ocr and is_doc:
            assert_project_ocr_quota(project)

        # Always defer auto-OCR on Media.save; start explicitly when run_ocr=True.
        provenance = {
            k: data.get(k) or ""
            for k in (
                "source_institution",
                "collection_name",
                "language",
                "ocr_language",
                "copyright_note",
            )
            if data.get(k)
        }

        with transaction.atomic():
            media = Media(
                ingestion_contributor=request.user,
                media_type=media_type,
                file=upload_file,
                description=data.get("caption") or "",
                ocr_deferred=is_doc,
            )
            media.full_clean()
            media.save()

            asset = ProjectAsset.objects.create(
                project=project,
                media=media,
                role=data.get("role") or ProjectAsset.ROLE_EVIDENCE,
                caption=data.get("caption") or "",
                uploaded_by=request.user,
            )

            uploaded_document_id = None
            ocr_status = "not_applicable"
            if is_doc:
                if run_ocr:
                    uploaded_document_id = queue_ocr_for_media(
                        media=media, project=project
                    )
                    ocr_status = "pending"
                    if provenance:
                        from apps.document_processing.models import UploadedDocument

                        doc = UploadedDocument.objects.get(id=uploaded_document_id)
                        doc.provenance = provenance
                        doc.save(update_fields=["provenance", "updated_at"])
                else:
                    ocr_status = "not_started"

            _log_project_activity(
                project,
                request.user,
                ProjectActivity.ACTION_ASSET_ADDED,
                target_kind="asset",
                target_id=asset.id,
                payload={
                    "media_id": str(media.id),
                    "role": asset.role,
                    "run_ocr": run_ocr,
                },
            )

        out = ProjectAssetSerializer(asset, context={"request": request}).data
        out["uploaded_document_id"] = uploaded_document_id
        out["ocr_status"] = ocr_status
        return Response(out, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="start-ocr")
    def start_ocr(self, request, project_slug=None, pk=None):
        from apps.document_processing.models import UploadedDocument
        from apps.document_processing.services.ocr_settings import get_ocr_settings

        project = self._get_project()
        self._require_edit(project)
        if project.state == Project.STATE_MERGED:
            raise ValidationError("Cannot run OCR on a merged project.")

        asset = self.get_object()
        media = asset.media
        if not is_document_media_file(media.file):
            raise ValidationError("This asset is not eligible for text extraction.")

        confirm_vision = str(request.data.get("confirm_vision", "")).lower() in (
            "true",
            "1",
            "yes",
        )
        doc = UploadedDocument.objects.filter(media=media).first()
        if doc and doc.claude_vision_invocations >= get_ocr_settings().max_vision_calls:
            if not confirm_vision:
                raise ValidationError(
                    {
                        "confirm_vision": (
                            "Vision fallback was already used for this file. "
                            "Set confirm_vision=true to run extraction again."
                        )
                    }
                )

        if doc and doc.status in ("pending", "processing"):
            out = ProjectAssetSerializer(asset, context={"request": request}).data
            return Response(out)

        assert_project_ocr_quota(project)

        with transaction.atomic():
            media.ocr_deferred = False
            media.save(update_fields=["ocr_deferred"])
            doc_id = queue_ocr_for_media(media=media, project=project)

        asset.refresh_from_db()
        out = ProjectAssetSerializer(asset, context={"request": request}).data
        out["uploaded_document_id"] = doc_id
        return Response(out)

    def perform_create(self, serializer):
        project = self._get_project()
        self._require_edit(project)
        asset = serializer.save(
            project=project,
            uploaded_by=self.request.user,
        )
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_ASSET_ADDED,
            target_kind="asset",
            target_id=asset.id,
            payload={"media_id": str(asset.media_id), "role": asset.role},
        )

    def perform_destroy(self, instance):
        project = self._get_project()
        self._require_edit(project)
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_ASSET_REMOVED,
            target_kind="asset",
            target_id=instance.id,
        )
        instance.delete()


class ProjectEntityViewSet(_ProjectScopedViewSet):
    serializer_class = ProjectEntitySerializer

    def get_queryset(self):
        project = self._get_project()
        self._require_view(project)
        return project.entities.select_related("entity", "added_by")

    def perform_create(self, serializer):
        project = self._get_project()
        self._require_edit(project)
        link = serializer.save(
            project=project,
            added_by=self.request.user,
        )
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_ENTITY_LINKED,
            target_kind="entity",
            target_id=link.id,
            payload={"entity_id": str(link.entity_id)},
        )

    def perform_destroy(self, instance):
        project = self._get_project()
        self._require_edit(project)
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_ENTITY_UNLINKED,
            target_kind="entity",
            target_id=instance.id,
            payload={"entity_id": str(instance.entity_id)},
        )
        instance.delete()


class ProjectCommentViewSet(_ProjectScopedViewSet):
    """Threaded comments scoped to a project (final_plan.md §10.1)."""

    serializer_class = ProjectCommentSerializer
    lookup_field = "comment_id"

    def get_queryset(self):
        from .models import Comments
        project = self._get_project()
        self._require_view(project)
        return Comments.objects.filter(project=project, parent__isnull=True).select_related("user")

    def perform_create(self, serializer):
        project = self._get_project()
        self._require_view(project)
        serializer.save(project=project, user=self.request.user)
        _log_project_activity(
            project,
            self.request.user,
            ProjectActivity.ACTION_COMMENTED,
            target_kind="project",
            target_id=project.id,
        )
